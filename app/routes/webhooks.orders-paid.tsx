import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';
import {createEmailDownloadToken} from '~/lib/email-download-token.server';
import {
  getAdminCustomerEmailDiscountUsage,
  getAdminCustomerDiscountUsage,
  setCustomerWelcome15UsesRemainingMetafield,
  WELCOME15_DISCOUNT_CODE,
} from '~/lib/customerDiscountUsage.server';
import {
  getLowResolutionThumbnailUrlForVariant,
  getR2ObjectKeyFromTagsForVariant,
} from '~/lib/downloads';
import {sendPurchaseDownloadEmail} from '~/lib/purchase-email.server';
import {sendReviewRequestEmail} from '~/lib/review-email.server';
import {adminGraphql} from '~/lib/shopify-admin.server';

type ShopifyOrderPaidWebhookPayload = {
  id?: number;
  admin_graphql_api_id?: string;
  name?: string;
  order_number?: number;
  email?: string;
  contact_email?: string;
  customer?: {
    email?: string | null;
  } | null;
  financial_status?: string | null;
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

type ShopifyCustomerWebhookPayload = {
  id?: number;
  admin_graphql_api_id?: string;
  email?: string | null;
};

const ACCEPTED_TOPICS = new Set([
  'orders/paid',
  'orders/create',
  'customers/create',
]);
const PAID_STATUSES = new Set(['paid', 'partially_paid']);

const ORDER_DOWNLOADS_QUERY = `
  query OrderDownloads($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      metafield(namespace: "custom", key: "download_email_sent_at") {
        value
      }
      customer {
        id
      }
      lineItems(first: 100) {
        nodes {
          id
          title
          quantity
          variant {
            id
            title
            selectedOptions {
              name
              value
            }
            image {
              url
            }
            product {
              title
              tags
              options {
                name
                optionValues {
                  name
                }
              }
            }
          }
        }
      }
    }
  }
` as const;

const SET_ORDER_EMAIL_SENT_METAFIELD_MUTATION = `
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

function getPublicSiteUrl(env: Env, request?: Request): string {
  if (request) {
    try {
      const requestOrigin = new URL(request.url).origin.trim();
      if (requestOrigin) return requestOrigin.replace(/\/+$/, '');
    } catch {
      // Ignore malformed request URLs and fall back to env configuration.
    }
  }

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

function resolveCustomerGid(
  payload: ShopifyCustomerWebhookPayload | ShopifyOrderPaidWebhookPayload,
): string | null {
  if (payload.admin_graphql_api_id?.trim()) {
    const gid = payload.admin_graphql_api_id.trim();
    if (gid.includes('/Customer/')) return gid;
  }
  if (typeof payload.id === 'number' && Number.isFinite(payload.id)) {
    return `gid://shopify/Customer/${payload.id}`;
  }
  return null;
}

async function syncWelcome15UsesRemainingForCustomer({
  context,
  customerId,
  customerEmail,
}: {
  context: ActionFunctionArgs['context'];
  customerId: string;
  customerEmail?: string | null;
}) {
  const trimmedCustomerId = customerId.trim();
  if (!trimmedCustomerId) return false;

  const usageByCustomerHistory = await getAdminCustomerDiscountUsage({
    env: context.env,
    customerId: trimmedCustomerId,
    code: WELCOME15_DISCOUNT_CODE,
  });
  const usageByCustomerEmail =
    typeof customerEmail === 'string' && customerEmail.trim()
      ? await getAdminCustomerEmailDiscountUsage({
          env: context.env,
          customerEmail,
          code: WELCOME15_DISCOUNT_CODE,
        })
      : null;

  const welcome15Used = Boolean(
    usageByCustomerHistory?.used || usageByCustomerEmail?.used,
  );

  if (!usageByCustomerHistory && !usageByCustomerEmail) {
    return false;
  }

  await setCustomerWelcome15UsesRemainingMetafield({
    env: context.env,
    customerId: trimmedCustomerId,
    usesRemaining: welcome15Used ? 0 : 1,
  }).catch(() => null);

  return true;
}

export async function action({request, context}: ActionFunctionArgs) {
  try {
    const topic = request.headers.get('X-Shopify-Topic')?.trim();
    if (topic && !ACCEPTED_TOPICS.has(topic)) {
      return json({ok: true, skipped: `Ignored topic ${topic}`});
    }

    const webhookSecret = context.env.SHOPIFY_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      console.error('Missing SHOPIFY_WEBHOOK_SECRET');
      return json(
        {ok: false, error: 'Webhook secret not configured'},
        {status: 500},
      );
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

    let payload:
      | ShopifyOrderPaidWebhookPayload
      | ShopifyCustomerWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as
        | ShopifyOrderPaidWebhookPayload
        | ShopifyCustomerWebhookPayload;
    } catch {
      return json({ok: false, error: 'Invalid webhook payload'}, {status: 400});
    }

    if (topic === 'customers/create') {
      const customerPayload = payload as ShopifyCustomerWebhookPayload;
      const customerGid = resolveCustomerGid(customerPayload);
      if (!customerGid) {
        return json({ok: false, error: 'Missing customer id'}, {status: 400});
      }

      const synced = await syncWelcome15UsesRemainingForCustomer({
        context,
        customerId: customerGid,
        customerEmail: customerPayload.email,
      });
      return json({
        ok: true,
        synced,
        customerId: customerGid,
      });
    }

    const orderPayload = payload as ShopifyOrderPaidWebhookPayload;

    if (topic === 'orders/create') {
      const financialStatus =
        orderPayload.financial_status?.trim().toLowerCase() ?? '';
      const rawTotalPrice =
        typeof orderPayload.total_price === 'string'
          ? orderPayload.total_price.trim()
          : '';
      const parsedTotalPrice =
        rawTotalPrice.length > 0 ? Number(rawTotalPrice) : null;
      const isZeroDollarOrder =
        parsedTotalPrice !== null &&
        Number.isFinite(parsedTotalPrice) &&
        parsedTotalPrice <= 0;

      if (
        financialStatus &&
        !PAID_STATUSES.has(financialStatus) &&
        !isZeroDollarOrder
      ) {
        return json({
          ok: true,
          skipped: `Order not paid yet (financial_status=${financialStatus}, total=${rawTotalPrice || 'unknown'})`,
        });
      }
    }

    const orderGid = resolveOrderGid(orderPayload);
    if (!orderGid) {
      return json({ok: false, error: 'Missing order id'}, {status: 400});
    }

    const orderResponse = await adminGraphql<{
      data?: {
        order?: {
          id: string;
          name?: string | null;
          createdAt?: string | null;
          metafield?: {value?: string | null} | null;
          customer?: {id?: string | null} | null;
          lineItems?: {
            nodes?: Array<{
              id: string;
              title?: string | null;
              quantity?: number | null;
              variant?: {
                id?: string | null;
                title?: string | null;
                selectedOptions?: Array<{
                  name?: string | null;
                  value?: string | null;
                }> | null;
                image?: {url?: string | null} | null;
                product?: {
                  title?: string | null;
                  tags?: string[] | null;
                  options?: Array<{
                    name?: string | null;
                    optionValues?: Array<{name?: string | null}> | null;
                  }> | null;
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

    const customerId = order.customer?.id?.trim() ?? null;
    if (customerId) {
      await syncWelcome15UsesRemainingForCustomer({
        context,
        customerId,
        customerEmail:
          orderPayload.email ??
          orderPayload.contact_email ??
          orderPayload.customer?.email ??
          null,
      });
    }

    if (order.metafield?.value?.trim()) {
      return json({ok: true, skipped: 'Purchase email already sent for this order'});
    }

    const siteUrl = getPublicSiteUrl(context.env, request);
    const lineItems = order.lineItems?.nodes ?? [];
    const downloadableItems = await Promise.all(
      lineItems.map(async (lineItem) => {
        const lineItemId = lineItem?.id?.trim();
        if (!lineItemId) return null;

        const tags = lineItem.variant?.product?.tags ?? [];
        const objectKey = getR2ObjectKeyFromTagsForVariant({
          tags,
          selectedOptions: lineItem.variant?.selectedOptions ?? [],
          variantTitle: lineItem.variant?.title ?? lineItem.title,
          productOptions: lineItem.variant?.product?.options ?? [],
        });
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
            typeof lineItem.quantity === 'number' &&
            Number.isFinite(lineItem.quantity)
              ? lineItem.quantity
              : 1,
          imageUrl:
            getLowResolutionThumbnailUrlForVariant({
              tags,
              productOptions: lineItem.variant?.product?.options ?? [],
              publicBaseUrl: context.env.R2_PUBLIC_BASE_URL,
            }) ??
            lineItem.variant?.image?.url ??
            null,
          downloadUrl: `${siteUrl}/download/${encodeURIComponent(token)}`,
          isBundle: tags.includes('Bundle'),
        };
      }),
    );

    const downloadItems = downloadableItems.filter(
      (item): item is NonNullable<typeof item> => Boolean(item),
    );

    // Collect print items for review request email
    const printItems = lineItems
      .filter((lineItem) => {
        const tags = lineItem.variant?.product?.tags ?? [];
        return tags.includes('Prints') && !tags.includes('Video');
      })
      .map((lineItem) => ({
        title:
          lineItem.variant?.product?.title?.trim() ||
          lineItem.title?.trim() ||
          'Print',
        imageUrl: lineItem.variant?.image?.url ?? null,
      }));

    if (!downloadItems.length && !printItems.length) {
      return json({ok: true, skipped: 'No downloadable or print line items'});
    }

    const customerEmail =
      orderPayload.email?.trim() ||
      orderPayload.contact_email?.trim() ||
      orderPayload.customer?.email?.trim() ||
      null;
    if (!customerEmail) {
      return json({
        ok: true,
        skipped: 'Order has no customer email in webhook payload',
      });
    }

    const orderName =
      order.name?.trim() ||
      orderPayload.name?.trim() ||
      (typeof orderPayload.order_number === 'number'
        ? `Order #${orderPayload.order_number}`
        : 'Order');

    // Send download email if there are downloadable items
    if (downloadItems.length) {
      await sendPurchaseDownloadEmail({
        env: context.env,
        toEmail: customerEmail,
        orderName,
        processedAt: orderPayload.created_at ?? order.createdAt ?? null,
        shippingAddress: toShippingAddressLabel(orderPayload.shipping_address),
        status: orderPayload.fulfillment_status || 'Paid',
        subtotal: orderPayload.subtotal_price ?? null,
        tax: orderPayload.total_tax ?? null,
        total: orderPayload.total_price ?? null,
        downloadItems,
      });
    }

    // Send review request email if there are print items
    if (printItems.length) {
      try {
        const encodedOrderId = encodeURIComponent(btoa(order.id));
        const orderUrl = `${siteUrl}/account/orders/${encodedOrderId}`;
        await sendReviewRequestEmail({
          env: context.env,
          toEmail: customerEmail,
          orderName,
          orderUrl,
          printItems,
        });
      } catch (reviewEmailError) {
        console.error('Failed to send review request email', reviewEmailError);
      }
    }

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

    return json({
      ok: true,
      sent: true,
      downloadItemCount: downloadItems.length,
      reviewEmailSent: printItems.length > 0,
    });
  } catch (error) {
    console.error('orders-paid webhook failed', error);
    return json({ok: false, error: 'Webhook handler failed'}, {status: 500});
  }
}

export async function loader() {
  return new Response(null, {status: 405});
}
