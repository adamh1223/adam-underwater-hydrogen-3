import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {verifyEmailDownloadToken} from '~/lib/email-download-token.server';
import {
  getDownloadFilenameFromObjectKey,
  getR2ObjectKeyFromTags,
} from '~/lib/downloads';
import {createR2SignedDownloadUrl} from '~/lib/r2.server';
import {adminGraphql} from '~/lib/shopify-admin.server';

const EMAIL_DOWNLOAD_ORDER_QUERY = `#graphql
  query EmailDownloadOrder($id: ID!) {
    order(id: $id) {
      id
      lineItems(first: 100) {
        nodes {
          id
          title
          variant {
            id
            product {
              tags
            }
          }
        }
      }
    }
  }
` as const;

function notFound(message = 'Download not found.') {
  return new Response(message, {status: 404});
}

export async function loader({context, params}: LoaderFunctionArgs) {
  const token = params.token;
  if (!token) return notFound();

  const verifiedToken = await verifyEmailDownloadToken({env: context.env, token});
  if (!verifiedToken) return notFound();

  const response = await adminGraphql<{
    data?: {
      order?: {
        id: string;
        lineItems?: {
          nodes?: Array<{
            id: string;
            title: string;
            variant?: {
              id?: string | null;
              product?: {tags?: string[] | null} | null;
            } | null;
          }>;
        } | null;
      } | null;
    };
  }>({
    env: context.env,
    query: EMAIL_DOWNLOAD_ORDER_QUERY,
    variables: {id: verifiedToken.orderId},
  });

  const order = response?.data?.order;
  if (!order) return notFound('Order not found.');

  const lineItems = order.lineItems?.nodes ?? [];
  const lineItem = lineItems.find(
    (item) => item?.id === verifiedToken.lineItemId,
  );
  if (!lineItem) return notFound('Line item not found.');

  const productTags = lineItem.variant?.product?.tags ?? [];
  const objectKey = getR2ObjectKeyFromTags(productTags);
  if (!objectKey) return notFound('No downloadable asset configured.');

  const signedUrl = await createR2SignedDownloadUrl(context.env, {
    objectKey,
    downloadFilename: getDownloadFilenameFromObjectKey(objectKey),
    expiresInSeconds: 60 * 60,
  });

  return redirect(signedUrl, {
    headers: {'Cache-Control': 'no-store, private'},
  });
}

export async function action() {
  return new Response(null, {status: 405});
}
