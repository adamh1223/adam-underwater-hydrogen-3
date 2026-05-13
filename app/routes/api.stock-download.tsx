import {json, type ActionFunctionArgs, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {adminGraphql} from '~/lib/shopify-admin.server';
import {createR2SignedDownloadUrl, R2ObjectNotFoundError} from '~/lib/r2.server';

// Pre-signed URL expires after 15 minutes — enough for one download
const EXPIRY_SECONDS = 900;

// Returns all plausible R2 keys for a clip in order of likelihood.
// createR2SignedDownloadUrl will try each one until it finds an existing file.
function buildStockKeyCandidates(vNumber: string, resolution: '8K' | '4K'): string[] {
  const num = Number.parseInt(vNumber, 10);
  if (!Number.isFinite(num) || num <= 0) throw new Error('Invalid clip number');
  const is4K = resolution === '4K';

  if (num >= 1 && num <= 93) {
    return is4K
      ? [`shared/stock/UM-8-4K-${num}.mov`, `shared/stock/UM-4K-${num}.mov`]
      : [`shared/stock/UM-8K-${num}.mov`, `shared/stock/UM-8-4K-${num}.mov`];
  }
  if (num >= 94 && num <= 157) {
    return is4K
      ? [`shared/stock/UM-5-4K-${num}.mov`, `shared/stock/UM-4K-${num}.mov`]
      : [`shared/stock/UM-5K-${num}.mov`, `shared/stock/UM-5-4K-${num}.mov`];
  }
  // 158-174: 4K only source
  return [`shared/stock/UM-4K-${num}.mov`];
}

const CUSTOMER_ORDERS_QUERY = `
  query CustomerOrderProducts($customerId: ID!, $first: Int!) {
    customer(id: $customerId) {
      orders(first: $first, query: "financial_status:paid") {
        nodes {
          lineItems(first: 50) {
            nodes {
              product { id tags }
            }
          }
        }
      }
    }
  }
`;

type OrdersResponse = {
  data?: {
    customer?: {
      orders?: {
        nodes?: Array<{
          lineItems?: {
            nodes?: Array<{
              product?: {id?: string; tags?: string[]} | null;
            }>;
          };
        }>;
      };
    };
  };
};

async function customerOwnsClip(
  env: Env,
  customerId: string,
  vNumber: string,
): Promise<boolean> {
  const individualTag = `v${vNumber}`;
  // Matches clip{pos}-{N} or clip{pos}_{N} bundle tags where N = vNumber
  const bundleClipRegex = new RegExp(`^clip\\d+[-_]${vNumber}$`, 'i');

  const result = await adminGraphql<OrdersResponse>({
    env,
    query: CUSTOMER_ORDERS_QUERY,
    variables: {customerId, first: 250},
  }).catch(() => null);

  const orders = result?.data?.customer?.orders?.nodes ?? [];
  for (const order of orders) {
    for (const item of order.lineItems?.nodes ?? []) {
      const tags = item.product?.tags ?? [];
      // Individual clip purchase
      if (tags.some((t) => t.trim().toLowerCase() === individualTag.toLowerCase())) {
        return true;
      }
      // Bundle purchase containing this clip
      if (tags.some((t) => bundleClipRegex.test(t.trim()))) {
        return true;
      }
    }
  }
  return false;
}

export async function loader({request, context}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const vNumber = url.searchParams.get('v');
  const resolution = (url.searchParams.get('res') ?? '8K') as '8K' | '4K';

  if (!vNumber) {
    return json({error: 'Missing clip identifier'}, {status: 400});
  }

  // Must be logged in
  if (!(await context.customerAccount.isLoggedIn())) {
    return json({error: 'Login required'}, {status: 401});
  }

  // Get customer ID
  const customerData = await context.customerAccount
    .query(`query { customer { id } }`)
    .catch(() => null);
  const customerId = (customerData as any)?.data?.customer?.id;
  if (!customerId) {
    return json({error: 'Could not identify customer'}, {status: 401});
  }

  // Verify purchase
  const owns = await customerOwnsClip(context.env, customerId, vNumber);
  if (!owns) {
    return json({error: 'Purchase required'}, {status: 403});
  }

  // Generate pre-signed URL
  let keyCandidates: string[];
  try {
    keyCandidates = buildStockKeyCandidates(vNumber, resolution);
  } catch {
    return json({error: 'Invalid clip'}, {status: 400});
  }

  let signedUrl: string;
  try {
    signedUrl = await createR2SignedDownloadUrl(context.env, {
      objectKeyCandidates: keyCandidates,
      downloadFilename: keyCandidates[0]?.split('/').pop(),
      expiresInSeconds: EXPIRY_SECONDS,
    });
  } catch (err) {
    if (err instanceof R2ObjectNotFoundError) {
      return json({error: 'File not found'}, {status: 404});
    }
    throw err;
  }

  return json({url: signedUrl});
}

// Block direct POST/etc.
export async function action({}: ActionFunctionArgs) {
  return json({error: 'Method not allowed'}, {status: 405});
}
