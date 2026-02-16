import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';

const PRODUCT_VARIANT_GID_PREFIX = 'gid://shopify/ProductVariant/';
const HOME_WITH_CART_OPEN = '/?open=cart';

type CartLineInput = {
  merchandiseId: string;
  quantity: number;
};

function normalizeVariantId(rawVariantId: string | null): string | null {
  if (!rawVariantId) return null;
  const trimmed = rawVariantId.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(PRODUCT_VARIANT_GID_PREFIX)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `${PRODUCT_VARIANT_GID_PREFIX}${trimmed}`;
  return null;
}

function parseLines(linesValue: string | null): CartLineInput[] {
  if (!linesValue) return [];

  return linesValue
    .split(',')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawVariantId, rawQuantity] = line.split(':');
      const merchandiseId = normalizeVariantId(rawVariantId ?? null);
      if (!merchandiseId) return null;

      const parsedQuantity = Number.parseInt(rawQuantity ?? '1', 10);
      const quantity = Number.isFinite(parsedQuantity)
        ? Math.max(1, parsedQuantity)
        : 1;

      return {merchandiseId, quantity};
    })
    .filter((line): line is CartLineInput => Boolean(line));
}

export async function loader({request, context}: LoaderFunctionArgs) {
  const {cart} = context;
  const url = new URL(request.url);
  const encodedLines = url.searchParams.get('lines');

  let lines = parseLines(encodedLines);
  if (!lines.length) {
    const variantId =
      normalizeVariantId(
        url.searchParams.get('variant') ?? url.searchParams.get('variantId'),
      ) ?? '';
    if (variantId) {
      lines = [{merchandiseId: variantId, quantity: 1}];
    }
  }

  if (!lines.length) {
    return redirect(HOME_WITH_CART_OPEN);
  }

  let result: any;

  const existingCart = await cart.get();
  if (existingCart?.id) {
    result = await cart.addLines(lines);
  } else {
    result = await cart.create({lines});
  }

  const cartId = result?.cart?.id;
  const headers = cartId ? cart.setCartId(cartId) : new Headers();

  return redirect(HOME_WITH_CART_OPEN, {status: 303, headers});
}

export default function BuyAgainRoute() {
  return null;
}
