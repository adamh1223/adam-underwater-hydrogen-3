import {json, type ActionFunctionArgs, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {S3Client, GetObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {adminGraphql} from '~/lib/shopify-admin.server';

// Pre-signed URL expires after 15 minutes — enough for one download
const EXPIRY_SECONDS = 900;

// Stock file path patterns in R2
function buildStockKey(vNumber: string, resolution: '8K' | '4K'): string {
  const num = Number.parseInt(vNumber, 10);
  if (!Number.isFinite(num) || num <= 0) throw new Error('Invalid clip number');

  // Filenames match the UM folder naming convention on the source drive
  if (num >= 1 && num <= 93) {
    // Source: UM/8K/UM-8-4K-{N}.mov  (8K source files)
    return `shared/stock/UM-8-4K-${num}.mov`;
  }
  if (num >= 94 && num <= 157) {
    // Source: UM/5K/UM-5-4K-{N}.mov  (5K source files)
    return `shared/stock/UM-5-4K-${num}.mov`;
  }
  // 158-174: Source: UM/4K/UM-4K-{N}.mov
  return `shared/stock/UM-4K-${num}.mov`;
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
  let key: string;
  try {
    key = buildStockKey(vNumber, resolution);
  } catch {
    return json({error: 'Invalid clip'}, {status: 400});
  }

  const s3 = new S3Client({
    region: context.env.R2_REGION ?? 'auto',
    endpoint: context.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: context.env.R2_ACCESS_KEY_ID,
      secretAccessKey: context.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const command = new GetObjectCommand({
    Bucket: context.env.R2_PRIVATE_STOCK_BUCKET ?? 'au-stock-private',
    Key: key,
    ResponseContentDisposition: `attachment; filename="${key.split('/').pop()}"`,
  });

  const signedUrl = await getSignedUrl(s3, command, {expiresIn: EXPIRY_SECONDS});

  // Redirect directly to the signed URL so the browser handles the download
  return new Response(null, {
    status: 302,
    headers: {Location: signedUrl},
  });
}

// Block direct POST/etc.
export async function action({}: ActionFunctionArgs) {
  return json({error: 'Method not allowed'}, {status: 405});
}
