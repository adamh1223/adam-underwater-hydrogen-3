import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {verifyEmailDownloadToken} from '~/lib/email-download-token.server';
import {
  getDownloadFilenameFromObjectKey,
  getR2ObjectKeyFromTagsForVariant,
} from '~/lib/downloads';
import {
  createR2SignedDownloadUrl,
  R2ObjectNotFoundError,
} from '~/lib/r2.server';
import {adminGraphql} from '~/lib/shopify-admin.server';

const EMAIL_DOWNLOAD_ORDER_QUERY = `
  query EmailDownloadOrder($id: ID!) {
    order(id: $id) {
      id
      lineItems(first: 100) {
        nodes {
          id
          title
          variant {
            id
            title
            selectedOptions {
              name
              value
            }
            product {
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
              title?: string | null;
              selectedOptions?: Array<{
                name?: string | null;
                value?: string | null;
              }> | null;
              product?: {
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

  let objectKey: string | null = null;

  if (verifiedToken.vn) {
    // Bundle clip token — resolve the specific clip using candidate keys
    const productTags = lineItem.variant?.product?.tags ?? [];
    if (!productTags.includes('Bundle')) return notFound('Token v-number mismatch.');

    const selectedOptions = lineItem.variant?.selectedOptions ?? [];
    const resOption = selectedOptions.find(
      (o: any) => typeof o.name === 'string' && o.name.toLowerCase() === 'resolution',
    );
    const is4K = (typeof resOption?.value === 'string' ? resOption.value : '8K').toUpperCase() === '4K';
    const vn = verifiedToken.vn;
    const num = Number.parseInt(vn, 10);
    if (!Number.isFinite(num) || num <= 0) return notFound('Invalid clip number.');

    let candidates: string[];
    if (num >= 1 && num <= 93) {
      candidates = is4K
        ? [`shared/stock/UM-8-4K-${num}.mov`, `shared/stock/UM-4K-${num}.mov`]
        : [`shared/stock/UM-8K-${num}.mov`, `shared/stock/UM-8-4K-${num}.mov`];
    } else if (num >= 94 && num <= 157) {
      candidates = is4K
        ? [`shared/stock/UM-5-4K-${num}.mov`, `shared/stock/UM-4K-${num}.mov`]
        : [`shared/stock/UM-5K-${num}.mov`, `shared/stock/UM-5-4K-${num}.mov`];
    } else {
      candidates = [`shared/stock/UM-4K-${num}.mov`];
    }

    const bundleUrl = await createR2SignedDownloadUrl(context.env, {
      objectKeyCandidates: candidates,
      downloadFilename: candidates[0]?.split('/').pop(),
      expiresInSeconds: 60 * 60,
    });
    return redirect(bundleUrl, {headers: {'Cache-Control': 'no-store, private'}});
  } else {
    const productTags = lineItem.variant?.product?.tags ?? [];
    objectKey = getR2ObjectKeyFromTagsForVariant({
      tags: productTags,
      selectedOptions: lineItem.variant?.selectedOptions ?? [],
      variantTitle: lineItem.variant?.title ?? lineItem.title,
      productOptions: lineItem.variant?.product?.options ?? [],
    });
  }

  if (!objectKey) return notFound('No downloadable asset configured.');

  let signedUrl = '';
  try {
    signedUrl = await createR2SignedDownloadUrl(context.env, {
      objectKey,
      downloadFilename: getDownloadFilenameFromObjectKey(objectKey),
      expiresInSeconds: 60 * 60,
    });
  } catch (error) {
    if (error instanceof R2ObjectNotFoundError) {
      return notFound(
        'The downloadable file is configured but not found in R2. Check product tag filename/casing.',
      );
    }
    throw error;
  }

  return redirect(signedUrl, {
    headers: {'Cache-Control': 'no-store, private'},
  });
}

export async function action() {
  return new Response(null, {status: 405});
}
