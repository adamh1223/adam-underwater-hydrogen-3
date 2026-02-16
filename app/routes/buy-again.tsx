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

function parseLineToken(rawToken: string): CartLineInput | null {
  const token = rawToken.trim();
  if (!token) return null;

  let rawVariantId = token;
  let quantity = 1;
  const lastColonIndex = token.lastIndexOf(':');

  // Parse quantity from the trailing :<int> only.
  // This keeps support for IDs that can contain ':' (for example gid://...).
  if (lastColonIndex > 0) {
    const maybeQuantity = token.slice(lastColonIndex + 1);
    if (/^\d+$/.test(maybeQuantity)) {
      rawVariantId = token.slice(0, lastColonIndex);
      quantity = Math.max(1, Number.parseInt(maybeQuantity, 10));
    }
  }

  const merchandiseId = normalizeVariantId(rawVariantId);
  if (!merchandiseId) return null;

  return {merchandiseId, quantity};
}

function parseLines(lineInputs: Array<string | null>): CartLineInput[] {
  const parsedLines = lineInputs
    .flatMap((value) => (value ?? '').split(','))
    .map(parseLineToken)
    .filter((line): line is CartLineInput => Boolean(line));

  if (!parsedLines.length) return [];

  // Merge duplicate variants so cart.create receives normalized line items.
  const byMerchandiseId = new Map<string, number>();
  for (const line of parsedLines) {
    byMerchandiseId.set(
      line.merchandiseId,
      (byMerchandiseId.get(line.merchandiseId) ?? 0) + line.quantity,
    );
  }

  return Array.from(byMerchandiseId.entries()).map(
    ([merchandiseId, quantity]) => ({
      merchandiseId,
      quantity,
    }),
  );
}

export async function loader({request, context}: LoaderFunctionArgs) {
  const {cart} = context;
  const url = new URL(request.url);
  const encodedLineInputs = [
    ...url.searchParams.getAll('lines'),
    ...url.searchParams.getAll('line'),
  ];

  let lines = parseLines(encodedLineInputs);
  if (!lines.length) {
    const variantInput =
      url.searchParams.get('variant') ?? url.searchParams.get('variantId');
    lines = parseLines([variantInput]);
  }

  if (!lines.length) {
    return redirect(HOME_WITH_CART_OPEN);
  }

  // Rebuild a clean cart that matches the "buy again" selection exactly.
  const result = await cart.create({lines});

  const cartId = result?.cart?.id;
  const headers = cartId ? cart.setCartId(cartId) : new Headers();

  return redirect(HOME_WITH_CART_OPEN, {status: 303, headers});
}

export default function BuyAgainRoute() {
  return null;
}
