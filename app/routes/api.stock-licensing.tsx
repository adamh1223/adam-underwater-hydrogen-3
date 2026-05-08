import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';
import {
  ADMIN_NOTIFICATION_EMAIL,
  sendDirectEmail,
} from '~/lib/email-provider.server';
import {adminGraphql} from '~/lib/shopify-admin.server';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Returns the set of product GIDs the customer has on paid orders.
// Uses read_orders scope (already granted on the app).
const GET_CUSTOMER_PAID_PRODUCTS_QUERY = `
  query GetCustomerPaidProducts($customerId: ID!, $first: Int!) {
    customer(id: $customerId) {
      orders(first: $first, query: "financial_status:paid") {
        nodes {
          lineItems(first: 50) {
            nodes {
              product { id }
            }
          }
        }
      }
    }
  }
`;

type PaidProductsResponse = {
  data?: {
    customer?: {
      orders?: {
        nodes?: Array<{
          lineItems?: {
            nodes?: Array<{product?: {id?: string} | null}>;
          };
        }>;
      };
    };
  };
};

async function getPaidProductIds(env: Env, customerId: string): Promise<Set<string>> {
  const result = await adminGraphql<PaidProductsResponse>({
    env,
    query: GET_CUSTOMER_PAID_PRODUCTS_QUERY,
    variables: {customerId, first: 250},
  }).catch(() => null);

  const paid = new Set<string>();
  const orders = result?.data?.customer?.orders?.nodes ?? [];
  for (const order of orders) {
    for (const item of order.lineItems?.nodes ?? []) {
      if (item.product?.id) paid.add(item.product.id);
    }
  }
  return paid;
}

const FIND_CUSTOMER_QUERY = `
  query FindCustomer($email: String!) {
    customers(first: 1, query: $email) {
      nodes {
        id
        metafield(namespace: "custom", key: "stock_channels") {
          id
          value
        }
      }
    }
  }
`;

const SET_STOCK_CHANNELS_MUTATION = `
  mutation SetStockChannels($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }
`;

type FindCustomerResponse = {
  data?: {
    customers?: {
      nodes?: Array<{
        id: string;
        metafield?: {id: string; value: string} | null;
      }>;
    };
  };
};

type SetMetafieldResponse = {
  data?: {
    metafieldsSet?: {
      metafields?: Array<{id: string}>;
      userErrors?: Array<{field: string; message: string}>;
    };
  };
};

async function saveStockChannelsMetafield({
  env,
  customerGid,
  email,
  channelFields,
  productIds,
  clips,
}: {
  env: Env;
  customerGid?: string | null;
  email: string;
  channelFields: {
    submitterName?: string;
    youtube: string;
    vimeo: string;
    instagram: string;
    tiktok: string;
    facebook: string;
    website: string;
    independent: string;
    advertisement: string;
    other: string;
  };
  productIds?: string[] | null;
  clips: string;
}) {
  let resolvedCustomerId: string | null = customerGid ?? null;
  let existingMetafieldValue: string | null = null;

  if (resolvedCustomerId) {
    // Fetch existing metafield using the provided GID
    const customerLookup = await adminGraphql<FindCustomerResponse>({
      env,
      query: `
        query GetCustomerMetafield($id: ID!) {
          customer(id: $id) {
            id
            metafield(namespace: "custom", key: "stock_channels") {
              id
              value
            }
          }
        }
      `,
      variables: {id: resolvedCustomerId},
    }).catch(() => null);

    const metafieldData = (
      customerLookup as unknown as {
        data?: {customer?: {metafield?: {value: string} | null}};
      }
    )?.data?.customer?.metafield;
    existingMetafieldValue = metafieldData?.value ?? null;
  } else if (email) {
    // Look up customer by email
    const emailLookup = await adminGraphql<FindCustomerResponse>({
      env,
      query: FIND_CUSTOMER_QUERY,
      variables: {email: `email:${email}`},
    }).catch(() => null);

    const customerNode = emailLookup?.data?.customers?.nodes?.[0];
    if (customerNode) {
      resolvedCustomerId = customerNode.id;
      existingMetafieldValue = customerNode.metafield?.value ?? null;
    }
  }

  if (!resolvedCustomerId) {
    // No customer found — skip metafield save silently
    return;
  }

  let existingEntries: unknown[] = [];
  if (existingMetafieldValue) {
    try {
      const parsed = JSON.parse(existingMetafieldValue);
      if (Array.isArray(parsed)) {
        existingEntries = parsed;
      }
    } catch {
      existingEntries = [];
    }
  }

  const submittedAt = new Date().toISOString();
  const channelData = {
    youtube: channelFields.youtube,
    vimeo: channelFields.vimeo,
    instagram: channelFields.instagram,
    tiktok: channelFields.tiktok,
    facebook: channelFields.facebook,
    website: channelFields.website,
    independent: channelFields.independent,
    advertisement: channelFields.advertisement,
    other: channelFields.other,
  };

  const newEntries: unknown[] = [];
  const customerMeta = {customerName: channelFields.submitterName ?? '', customerEmail: email};

  if (productIds && productIds.length > 0) {
    // Only save entries for products the customer has actually paid for.
    const paidProductIds = await getPaidProductIds(env, resolvedCustomerId);
    for (const productId of productIds) {
      if (!paidProductIds.has(productId)) continue; // skip unpurchased
      newEntries.push({
        productId,
        productTitle: clips,
        submittedAt,
        ...customerMeta,
        ...channelData,
      });
    }
  } else {
    // No product IDs provided — save without purchase check (fallback)
    newEntries.push({
      productId: null,
      productTitle: clips,
      submittedAt,
      ...customerMeta,
      ...channelData,
    });
  }

  // Nothing to save — no purchased products matched
  if (newEntries.length === 0) return;

  const updatedEntries = [...existingEntries, ...newEntries];

  const mutationResult = await adminGraphql<SetMetafieldResponse>({
    env,
    query: SET_STOCK_CHANNELS_MUTATION,
    variables: {
      metafields: [
        {
          ownerId: resolvedCustomerId,
          namespace: 'custom',
          key: 'stock_channels',
          type: 'multi_line_text_field',
          value: JSON.stringify(updatedEntries),
        },
      ],
    },
  }).catch((err) => {
    console.error('Failed to save stock_channels metafield', err);
    return null;
  });

  const userErrors =
    mutationResult?.data?.metafieldsSet?.userErrors ?? [];
  if (Array.isArray(userErrors) && userErrors.length > 0) {
    console.error('stock_channels metafield userErrors', userErrors);
  }
}

export async function action({request, context}: ActionFunctionArgs) {
  const body = await request.json();
  try {
    const entries = Object.entries(body as Record<string, unknown>);
    const htmlRows = entries
      .map(
        ([key, value]) =>
          `<tr><td style="padding:6px 10px; border:1px solid #ddd;"><strong>${escapeHtml(
            key,
          )}</strong></td><td style="padding:6px 10px; border:1px solid #ddd;">${escapeHtml(
            String(value ?? ''),
          )}</td></tr>`,
      )
      .join('');

    await sendDirectEmail({
      env: context.env,
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: 'New stock footage licensing form submission',
      text: JSON.stringify(body, null, 2),
      html: `
        <h2>New stock footage licensing form submission</h2>
        <table cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          ${htmlRows}
        </table>
      `,
    });

    // Save channel data to customer metafield
    const typedBody = body as Record<string, unknown>;
    const email = typeof typedBody.email === 'string' ? typedBody.email : '';
    const clips = typeof typedBody.clips === 'string' ? typedBody.clips : '';
    const customerGid =
      typeof typedBody.customerGid === 'string' ? typedBody.customerGid : null;
    const productIds = Array.isArray(typedBody.productIds)
      ? (typedBody.productIds as unknown[]).filter(
          (id): id is string => typeof id === 'string',
        )
      : null;

    const channelFields = {
      submitterName: typeof typedBody.name === 'string' ? typedBody.name : '',
      youtube: typeof typedBody.youtube === 'string' ? typedBody.youtube : '',
      vimeo: typeof typedBody.vimeo === 'string' ? typedBody.vimeo : '',
      instagram:
        typeof typedBody.instagram === 'string' ? typedBody.instagram : '',
      tiktok: typeof typedBody.tiktok === 'string' ? typedBody.tiktok : '',
      facebook:
        typeof typedBody.facebook === 'string' ? typedBody.facebook : '',
      website: typeof typedBody.website === 'string' ? typedBody.website : '',
      independent:
        typeof typedBody.independent === 'string'
          ? typedBody.independent
          : '',
      advertisement:
        typeof typedBody.advertisement === 'string'
          ? typedBody.advertisement
          : '',
      other: typeof typedBody.other === 'string' ? typedBody.other : '',
    };

    if (email || customerGid) {
      await saveStockChannelsMetafield({
        env: context.env,
        customerGid,
        email,
        channelFields,
        productIds,
        clips,
      }).catch((err) => {
        console.error('saveStockChannelsMetafield failed', err);
      });
    }

    return json({success: true});
  } catch (error) {
    console.error(error);
    return json({error: 'request failed', status: 500});
  }
}

export async function loader() {
  return new Response(null, {status: 405});
}
