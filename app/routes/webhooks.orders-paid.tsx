import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';
import {createEmailDownloadToken} from '~/lib/email-download-token.server';
import {getR2ObjectKeyFromTags} from '~/lib/downloads';
import {sendPurchaseDownloadEmail} from '~/lib/purchase-email.server';
import {adminGraphql} from '~/lib/shopify-admin.server';

type ShopifyOrderPaidWebhookPayload = {
  id?: number;
  admin_graphql_api_id?: string;
  name?: string;
  order_number?: number;
  email?: string;
  created_at?: string;
  subtotal_price?: string;
  total_tax?: string;
  total_price?: string;
  fulfillment_status?: string | null;
  shipping_address?: {
    name?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    province_code?: string | null;
    zip?: string | null;
    country_code?: string | null;
  } | null;
};

const ORDER_DOWNLOADS_QUERY = `#graphql
  query OrderDownloads($id: ID!) {
    order(id: $id) {
      id
      name
      email
      createdAt
      metafield(namespace: "custom", key: "download_email_sent_at") {
        value
      }
      lineItems(first: 100) {
        nodes {
          id
          title
          quantity
          variant {
            id
            image {
              url
            }
            product {
              title
              tags
            }
          }
        }
      }
    }
  }
` as const;

const SET_ORDER_EMAIL_SENT_METAFIELD_MUTATION = `#graphql
  mutation SetOrderDownloadEmailSent($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors {
        field
        message
      }
    }
  }
` as const;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

async function verifyShopifyWebhookHmac({
  secret,
  body,
  receivedHmac,
}: {
  secret: string;
  body: string;
  receivedHmac: string;
}) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expectedHmac = toBase64(new Uint8Array(signature));
  return timingSafeEqual(receivedHmac, expectedHmac);
}

function getPublicSiteUrl(env: Env): string {
  const configured =
    env.PUBLIC_SITE_URL?.trim() || env.PUBLIC_STOREFRONT_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return 'https://www.adamunderwater.com';
}

function toShippingAddressLabel(
  address: ShopifyOrderPaidWebhookPayload['shipping_address'],
) {
  if (!address) return 'N/A';
  const parts = [
    address.name,
    address.address1,
    address.address2,
    [address.city, address.province_code, address.zip].filter(Boolean).join(' '),
    address.country_code,
  ]
    .map((part) => (part ?? '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : 'N/A';
}

function resolveOrderGid(payload: ShopifyOrderPaidWebhookPayload): string | null {
  if (payload.admin_graphql_api_id?.trim()) return payload.admin_graphql_api_id.trim();
  if (typeof payload.id === 'number' && Number.isFinite(payload.id)) {
    return `gid://shopify/Order/${payload.id}`;
  }
  return null;
}

export async function action({request, context}: ActionFunctionArgs) {
  const topic = request.headers.get('X-Shopify-Topic')?.trim();
  if (topic && topic !== 'orders/paid') {
    return json({ok: true, skipped: `Ignored topic ${topic}`});
  }

  const webhookSecret = context.env.SHOPIFY_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error('Missing SHOPIFY_WEBHOOK_SECRET');
    return json({ok: false, error: 'Webhook secret not configured'}, {status: 500});
  }

  const receivedHmac = request.headers.get('X-Shopify-Hmac-Sha256')?.trim();
  if (!receivedHmac) {
    return json({ok: false, error: 'Missing webhook signature'}, {status: 401});
  }

  const rawBody = await request.text();
  const isValidHmac = await verifyShopifyWebhookHmac({
    secret: webhookSecret,
    body: rawBody,
    receivedHmac,
  });
  if (!isValidHmac) {
    return json({ok: false, error: 'Invalid webhook signature'}, {status: 401});
  }

  let payload: ShopifyOrderPaidWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as ShopifyOrderPaidWebhookPayload;
  } catch {
    return json({ok: false, error: 'Invalid webhook payload'}, {status: 400});
  }

  const orderGid = resolveOrderGid(payload);
  if (!orderGid) {
    return json({ok: false, error: 'Missing order id'}, {status: 400});
  }

  const orderResponse = await adminGraphql<{
    data?: {
      order?: {
        id: string;
        name?: string | null;
        email?: string | null;
        createdAt?: string | null;
        metafield?: {value?: string | null} | null;
        lineItems?: {
          nodes?: Array<{
            id: string;
            title?: string | null;
            quantity?: number | null;
            variant?: {
              id?: string | null;
              image?: {url?: string | null} | null;
              product?: {
                title?: string | null;
                tags?: string[] | null;
              } | null;
            } | null;
          }>;
        } | null;
      } | null;
    };
  }>({
    env: context.env,
    query: ORDER_DOWNLOADS_QUERY,
    variables: {id: orderGid},
  });

  const order = orderResponse?.data?.order;
  if (!order) {
    return json({ok: false, error: 'Order not found'}, {status: 404});
  }
  if (order.metafield?.value?.trim()) {
    return json({ok: true, skipped: 'Purchase email already sent for this order'});
  }

  const siteUrl = getPublicSiteUrl(context.env);
  const lineItems = order.lineItems?.nodes ?? [];
  const downloadableItems = await Promise.all(
    lineItems.map(async (lineItem) => {
      const lineItemId = lineItem?.id?.trim();
      if (!lineItemId) return null;

      const tags = lineItem.variant?.product?.tags ?? [];
      const objectKey = getR2ObjectKeyFromTags(tags);
      if (!objectKey) return null;

      const token = await createEmailDownloadToken({
        env: context.env,
        orderId: order.id,
        lineItemId,
      });

      return {
        title:
          lineItem.variant?.product?.title?.trim() ||
          lineItem.title?.trim() ||
          'Stock Footage Clip',
        quantity:
          typeof lineItem.quantity === 'number' && Number.isFinite(lineItem.quantity)
            ? lineItem.quantity
            : 1,
        imageUrl: lineItem.variant?.image?.url ?? null,
        downloadUrl: `${siteUrl}/download/${encodeURIComponent(token)}`,
      };
    }),
  );

  const downloadItems = downloadableItems.filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );

  if (!downloadItems.length) {
    return json({ok: true, skipped: 'No downloadable line items'});
  }

  const customerEmail =
    payload.email?.trim() || order.email?.trim() || null;
  if (!customerEmail) {
    return json({ok: true, skipped: 'Order has no customer email'});
  }

  const orderName =
    order.name?.trim() ||
    payload.name?.trim() ||
    (typeof payload.order_number === 'number'
      ? `Order #${payload.order_number}`
      : 'Order');

  await sendPurchaseDownloadEmail({
    env: context.env,
    toEmail: customerEmail,
    orderName,
    processedAt: payload.created_at ?? order.createdAt ?? null,
    shippingAddress: toShippingAddressLabel(payload.shipping_address),
    status: payload.fulfillment_status || 'Paid',
    subtotal: payload.subtotal_price ?? null,
    tax: payload.total_tax ?? null,
    total: payload.total_price ?? null,
    downloadItems,
  });

  const metafieldMutation = await adminGraphql<{
    data?: {
      metafieldsSet?: {
        userErrors?: Array<{field?: string[]; message?: string}>;
      };
    };
  }>({
    env: context.env,
    query: SET_ORDER_EMAIL_SENT_METAFIELD_MUTATION,
    variables: {
      metafields: [
        {
          ownerId: order.id,
          namespace: 'custom',
          key: 'download_email_sent_at',
          type: 'single_line_text_field',
          value: new Date().toISOString(),
        },
      ],
    },
  });

  const userErrors = metafieldMutation?.data?.metafieldsSet?.userErrors ?? [];
  if (Array.isArray(userErrors) && userErrors.length) {
    console.error('Unable to persist download email sent marker', userErrors);
  }

  return json({ok: true, sent: true, downloadItemCount: downloadItems.length});
}

export async function loader() {
  return new Response(null, {status: 405});
}
