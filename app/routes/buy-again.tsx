import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';

const PRODUCT_VARIANT_GID_PREFIX = 'gid://shopify/ProductVariant/';

function normalizeVariantId(rawVariantId: string | null): string | null {
  if (!rawVariantId) return null;

  const trimmed = rawVariantId.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(PRODUCT_VARIANT_GID_PREFIX)) {
    return trimmed;
  }

  if (/^\d+$/.test(trimmed)) {
    return `${PRODUCT_VARIANT_GID_PREFIX}${trimmed}`;
  }

  return null;
}

function getProductPath(
  handle: string,
  selectedOptions: Array<{name?: string | null; value?: string | null}>,
) {
  const searchParams = new URLSearchParams();

  for (const option of selectedOptions) {
    const optionName = option?.name?.trim();
    const optionValue = option?.value?.trim();
    if (!optionName || !optionValue) continue;
    searchParams.append(optionName, optionValue);
  }

  const query = searchParams.toString();
  return query ? `/products/${handle}?${query}` : `/products/${handle}`;
}

export async function loader({request, context}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const variantParam =
    url.searchParams.get('variant') ??
    url.searchParams.get('variantId') ??
    null;
  const variantId = normalizeVariantId(variantParam);

  if (!variantId) {
    return redirect('/');
  }

  const data = await context.storefront
    .query(BUY_AGAIN_VARIANT_QUERY, {
      variables: {id: variantId},
    })
    .catch(() => null);

  const variant = data?.node;
  const productHandle = variant?.product?.handle as string | undefined;
  const selectedOptions = Array.isArray(variant?.selectedOptions)
    ? (variant.selectedOptions as Array<{name?: string | null; value?: string | null}>)
    : [];

  if (!productHandle) {
    return redirect('/');
  }

  return redirect(getProductPath(productHandle, selectedOptions));
}

export default function BuyAgain() {
  return null;
}

const BUY_AGAIN_VARIANT_QUERY = `#graphql
  query BuyAgainVariant($id: ID!) {
    node(id: $id) {
      ... on ProductVariant {
        id
        selectedOptions {
          name
          value
        }
        product {
          handle
        }
      }
    }
  }
`;
