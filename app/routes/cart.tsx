import {useCallback, useEffect, useRef, useState} from 'react';
import {type MetaFunction, useLoaderData} from '@remix-run/react';
import type {CartQueryDataReturn} from '@shopify/hydrogen';
import {CartForm} from '@shopify/hydrogen';
import type {
  CartLineInput,
  CartLineUpdateInput,
} from '@shopify/hydrogen/storefront-api-types';
import {
  data,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type HeadersFunction,
} from '@shopify/remix-oxygen';
import {CartMain} from '~/components/CartMain';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import CartPageSkeleton from '~/components/skeletons/CartPageSkeleton';
import {SkeletonGate} from '~/components/skeletons/shared';
import {REVIEW_MEDIA_DISCOUNT_CODE} from '~/lib/reviewMediaDiscountReward';
import {
  getAdminCustomerEmailDiscountUsage,
  getCustomerDiscountUsage,
  setCustomerWelcome15UsesRemainingMetafield,
  WELCOME15_DISCOUNT_CODE,
} from '~/lib/customerDiscountUsage.server';
type VariantProductSummary = {
  productId: string;
  tags: string[];
};

const CUSTOMER_ID_QUERY = `#graphql
  query CustomerIdQuery {
    customer {
      id
      emailAddress {
        emailAddress
      }
    }
  }
` as const;

type IncomingLineWithPreloadHint = {
  merchandiseId?: unknown;
  __productId?: unknown;
  __isVideo?: unknown;
};

const VARIANT_PRODUCT_SUMMARY_QUERY = `#graphql
  query CartVariantProductSummary($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        product {
          id
          tags
        }
      }
    }
  }
`;

function isVideoProduct(tags: string[] | null | undefined) {
  return Array.isArray(tags) && tags.includes('Video');
}

function toCartLineInput(line: unknown): CartLineInput | null {
  if (typeof line !== 'object' || line === null) return null;

  const candidate = line as {
    merchandiseId?: unknown;
    quantity?: unknown;
    attributes?: CartLineInput['attributes'];
    sellingPlanId?: CartLineInput['sellingPlanId'];
  };

  if (typeof candidate.merchandiseId !== 'string' || !candidate.merchandiseId) {
    return null;
  }

  return {
    merchandiseId: candidate.merchandiseId,
    quantity:
      typeof candidate.quantity === 'number' && Number.isFinite(candidate.quantity)
        ? candidate.quantity
        : 1,
    attributes: candidate.attributes,
    sellingPlanId: candidate.sellingPlanId,
  };
}

function getPreloadedVariantSummariesFromLines(lines: unknown[]) {
  const summaryByVariantId = new Map<string, VariantProductSummary>();

  for (const line of lines) {
    if (typeof line !== 'object' || line === null) continue;

    const candidate = line as IncomingLineWithPreloadHint;
    const merchandiseId =
      typeof candidate.merchandiseId === 'string' ? candidate.merchandiseId : '';
    const productId =
      typeof candidate.__productId === 'string' ? candidate.__productId : '';

    if (!merchandiseId || !productId) continue;

    const isVideo = candidate.__isVideo === true;
    summaryByVariantId.set(merchandiseId, {
      productId,
      tags: isVideo ? ['Video'] : [],
    });
  }

  return summaryByVariantId;
}

function toCartLineUpdateInput(line: unknown): CartLineUpdateInput | null {
  if (typeof line !== 'object' || line === null) return null;

  const candidate = line as {
    id?: unknown;
    merchandiseId?: unknown;
    quantity?: unknown;
    attributes?: CartLineUpdateInput['attributes'];
  };

  if (typeof candidate.id !== 'string' || !candidate.id) return null;

  return {
    id: candidate.id,
    merchandiseId:
      typeof candidate.merchandiseId === 'string' ? candidate.merchandiseId : undefined,
    quantity:
      typeof candidate.quantity === 'number' && Number.isFinite(candidate.quantity)
        ? candidate.quantity
        : undefined,
    attributes: candidate.attributes,
  };
}

async function getVariantProductSummaries(
  context: ActionFunctionArgs['context'],
  variantIds: string[],
) {
  const ids = Array.from(new Set(variantIds.filter(Boolean)));
  const summaryByVariantId = new Map<string, VariantProductSummary>();

  if (!ids.length) return summaryByVariantId;

  const response = await context.storefront.query<{
    nodes?: Array<
      | {
          id: string;
          product?: {id?: string | null; tags?: string[] | null} | null;
        }
      | null
    >;
  }>(VARIANT_PRODUCT_SUMMARY_QUERY, {
    variables: {ids},
  });

  for (const node of response?.nodes ?? []) {
    if (!node?.id || !node.product?.id) continue;
    summaryByVariantId.set(node.id, {
      productId: node.product.id,
      tags: Array.isArray(node.product.tags) ? node.product.tags : [],
    });
  }

  return summaryByVariantId;
}

async function runCartMutations({
  cart,
  currentCart,
  updates,
  removeLineIds,
  adds,
}: {
  cart: ActionFunctionArgs['context']['cart'];
  currentCart: CartApiQueryFragment | null;
  updates: CartLineUpdateInput[];
  removeLineIds: string[];
  adds: CartLineInput[];
}) {
  let result: CartQueryDataReturn | null = null;

  if (updates.length) {
    result = await cart.updateLines(updates);
    if (result.errors?.length) return result;
  }

  if (removeLineIds.length) {
    result = await cart.removeLines(removeLineIds);
    if (result.errors?.length) return result;
  }

  if (adds.length) {
    result = await cart.addLines(adds);
    if (result.errors?.length) return result;
  }

  if (result) return result;

  return {
    cart: currentCart,
    errors: [],
    warnings: [],
  } as CartQueryDataReturn;
}

async function handleVideoAwareLineAdd({
  context,
  lines,
}: {
  context: ActionFunctionArgs['context'];
  lines: unknown[];
}) {
  const normalizedLines = lines.map(toCartLineInput).filter(Boolean);
  const preloadedSummaries = getPreloadedVariantSummariesFromLines(lines);
  const allSummariesKnownFromPreload =
    normalizedLines.length > 0 &&
    normalizedLines.every((line) => preloadedSummaries.has(line.merchandiseId));
  const hasAnyVideoFromPreload = normalizedLines.some((line) => {
    const summary = preloadedSummaries.get(line.merchandiseId);
    return summary ? isVideoProduct(summary.tags) : false;
  });

  // Fast path for non-video adds (prints): no cart read + no variant summary query.
  if (allSummariesKnownFromPreload && !hasAnyVideoFromPreload) {
    return context.cart.addLines(normalizedLines);
  }

  const currentCart = await context.cart.get();
  const currentLines = currentCart?.lines.nodes ?? [];
  const missingVariantIds = normalizedLines
    .map((line) => line.merchandiseId)
    .filter((variantId) => !preloadedSummaries.has(variantId));
  const fetchedSummaries = missingVariantIds.length
    ? await getVariantProductSummaries(context, missingVariantIds)
    : new Map<string, VariantProductSummary>();
  const incomingVariantSummaries = new Map<string, VariantProductSummary>([
    ...fetchedSummaries,
    ...preloadedSummaries,
  ]);

  const regularAdds: CartLineInput[] = [];
  const pendingVideoAdds = new Map<string, CartLineInput>();
  const videoLineUpdates = new Map<string, CartLineUpdateInput>();
  const removeLineIds = new Set<string>();

  for (const line of normalizedLines) {
    const summary = incomingVariantSummaries.get(line.merchandiseId);
    if (!summary || !isVideoProduct(summary.tags)) {
      regularAdds.push(line);
      continue;
    }

    const videoLine: CartLineInput = {
      ...line,
      quantity: 1,
    };

    const matchingExistingLines = currentLines.filter(
      (currentLine) => currentLine.merchandise.product.id === summary.productId,
    );

    if (matchingExistingLines.length) {
      const keeperLineId =
        videoLineUpdates.get(summary.productId)?.id ?? matchingExistingLines[0]?.id;

      if (!keeperLineId) {
        pendingVideoAdds.set(summary.productId, videoLine);
        continue;
      }

      videoLineUpdates.set(summary.productId, {
        id: keeperLineId,
        merchandiseId: videoLine.merchandiseId,
        quantity: 1,
        attributes: videoLine.attributes,
      });

      for (const duplicateLine of matchingExistingLines) {
        if (duplicateLine.id !== keeperLineId) {
          removeLineIds.add(duplicateLine.id);
        }
      }
      pendingVideoAdds.delete(summary.productId);
      continue;
    }

    pendingVideoAdds.set(summary.productId, videoLine);
  }

  return runCartMutations({
    cart: context.cart,
    currentCart,
    updates: Array.from(videoLineUpdates.values()),
    removeLineIds: Array.from(removeLineIds),
    adds: [...regularAdds, ...Array.from(pendingVideoAdds.values())],
  });
}

async function handleVideoAwareLineUpdate({
  context,
  lines,
}: {
  context: ActionFunctionArgs['context'];
  lines: unknown[];
}) {
  const normalizedLines = lines.map(toCartLineUpdateInput).filter(Boolean);
  const currentCart = await context.cart.get();
  const currentLines = currentCart?.lines.nodes ?? [];
  const currentLineById = new Map(currentLines.map((line) => [line.id, line]));
  const preloadedSummaries = getPreloadedVariantSummariesFromLines(lines);
  const updateVariantIds = normalizedLines
    .map((line) => line.merchandiseId)
    .filter((merchandiseId): merchandiseId is string => Boolean(merchandiseId));
  const missingVariantIds = updateVariantIds.filter(
    (variantId) => !preloadedSummaries.has(variantId),
  );
  const fetchedSummaries = missingVariantIds.length
    ? await getVariantProductSummaries(context, missingVariantIds)
    : new Map<string, VariantProductSummary>();
  const incomingVariantSummaries = new Map<string, VariantProductSummary>([
    ...fetchedSummaries,
    ...preloadedSummaries,
  ]);

  const regularUpdates: CartLineUpdateInput[] = [];
  const videoUpdates = new Map<string, CartLineUpdateInput>();
  const videoKeeperLineIds = new Map<string, string>();

  for (const line of normalizedLines) {
    const existingLine = currentLineById.get(line.id);
    const summary = line.merchandiseId
      ? incomingVariantSummaries.get(line.merchandiseId)
      : existingLine
        ? {
            productId: existingLine.merchandise.product.id,
            tags: Array.isArray(existingLine.merchandise.product.tags)
              ? existingLine.merchandise.product.tags
              : [],
          }
        : null;

    if (!summary || !isVideoProduct(summary.tags)) {
      regularUpdates.push(line);
      continue;
    }

    videoKeeperLineIds.set(summary.productId, line.id);
    videoUpdates.set(summary.productId, {
      ...line,
      quantity: 1,
    });
  }

  const removeLineIds = new Set<string>();

  for (const [productId, keeperLineId] of videoKeeperLineIds) {
    for (const currentLine of currentLines) {
      if (
        currentLine.merchandise.product.id === productId &&
        currentLine.id !== keeperLineId
      ) {
        removeLineIds.add(currentLine.id);
      }
    }
  }

  return runCartMutations({
    cart: context.cart,
    currentCart,
    updates: [...regularUpdates, ...Array.from(videoUpdates.values())],
    removeLineIds: Array.from(removeLineIds),
    adds: [],
  });
}

export const meta: MetaFunction = () => {
  return [{title: `Adam Underwater | Cart`}];
};

export const headers: HeadersFunction = ({actionHeaders}) => actionHeaders;

export async function action({request, context}: ActionFunctionArgs) {
  const {cart} = context;

  const formData = await request.formData();

  const {action, inputs} = CartForm.getFormInput(formData);

  if (!action) {
    throw new Error('No action provided');
  }

  let status = 200;
  let result: CartQueryDataReturn;

  switch (action) {
    case CartForm.ACTIONS.LinesAdd:
      result = await handleVideoAwareLineAdd({
        context,
        lines: Array.isArray(inputs.lines) ? inputs.lines : [],
      });
      break;
    case CartForm.ACTIONS.LinesUpdate:
      result = await handleVideoAwareLineUpdate({
        context,
        lines: Array.isArray(inputs.lines) ? inputs.lines : [],
      });
      break;
    case CartForm.ACTIONS.LinesRemove:
      result = await cart.removeLines(inputs.lineIds);
      break;
    case CartForm.ACTIONS.DiscountCodesUpdate: {
      const formDiscountCode = inputs.discountCode;

      const discountCodes = Array.from(
        new Set(
          [
            formDiscountCode,
            ...(Array.isArray(inputs.discountCodes) ? inputs.discountCodes : []),
          ]
            .filter((code): code is string => typeof code === 'string')
            .map((code) => code.trim())
            .filter(Boolean),
        ),
      );

      // REVIEW15 + WELCOME15 require the user to be logged in
      const restrictedCodeSet = new Set([
        WELCOME15_DISCOUNT_CODE,
        REVIEW_MEDIA_DISCOUNT_CODE,
      ]);
      const restrictedCode = discountCodes.find((code) =>
        restrictedCodeSet.has(code.toUpperCase()),
      );
      if (restrictedCode) {
        let isLoggedIn = false;
        try {
          isLoggedIn = await context.customerAccount.isLoggedIn();
        } catch {
          isLoggedIn = false;
        }
        if (!isLoggedIn) {
          return data(
            {
              error: `You must be logged in to use the ${restrictedCode.toUpperCase()} discount code.`,
            },
            {status: 401},
          );
        }
      }

      const includesWelcome15 = discountCodes.some(
        (code) => code.toUpperCase() === WELCOME15_DISCOUNT_CODE,
      );
      const includesReview15 = discountCodes.some(
        (code) => code.toUpperCase() === REVIEW_MEDIA_DISCOUNT_CODE,
      );
      if (includesWelcome15 || includesReview15) {
        const customerIdentityResponse = await context.customerAccount
          .query<{
            customer?: {
              id?: string | null;
              emailAddress?: {emailAddress?: string | null} | null;
            } | null;
          }>(CUSTOMER_ID_QUERY)
          .catch(() => null);
        const customerId = customerIdentityResponse?.data?.customer?.id ?? null;
        const customerEmail =
          customerIdentityResponse?.data?.customer?.emailAddress?.emailAddress ??
          null;

        const hasUsedDiscountCode = async (discountCode: string) => {
          const usageByCustomerOrderHistory = await getCustomerDiscountUsage({
            customerAccount: context.customerAccount,
            code: discountCode,
          });
          const usageByCustomerEmail =
            typeof customerEmail === 'string' && customerEmail.trim()
              ? await getAdminCustomerEmailDiscountUsage({
                  env: context.env,
                  customerEmail,
                  code: discountCode,
                })
              : null;

          return Boolean(
            usageByCustomerOrderHistory?.used || usageByCustomerEmail?.used,
          );
        };

        if (includesWelcome15) {
          const welcome15AlreadyUsed = await hasUsedDiscountCode(
            WELCOME15_DISCOUNT_CODE,
          );

          if (welcome15AlreadyUsed) {
            return data(
              {
                error:
                  'WELCOME15 has already been used on this account. Uses remaining: 0.',
              },
              {status: 409},
            );
          }

          if (typeof customerId === 'string' && customerId.trim()) {
            await setCustomerWelcome15UsesRemainingMetafield({
              env: context.env,
              customerId,
              usesRemaining: 1,
            }).catch(() => null);
          }
        }

        if (includesReview15) {
          const review15AlreadyUsed = await hasUsedDiscountCode(
            REVIEW_MEDIA_DISCOUNT_CODE,
          );

          if (review15AlreadyUsed) {
            return data(
              {
                error: `${REVIEW_MEDIA_DISCOUNT_CODE} has already been used on this account. Uses remaining: 0.`,
              },
              {status: 409},
            );
          }
        }
      }

      result = await cart.updateDiscountCodes(discountCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesUpdate: {
      const formGiftCardCode = inputs.giftCardCode;

      // User inputted gift card code
      const giftCardCodes = (
        formGiftCardCode ? [formGiftCardCode] : []
      ) as string[];

      // Combine gift card codes already applied on cart
      giftCardCodes.push(...inputs.giftCardCodes);

      result = await cart.updateGiftCardCodes(giftCardCodes);
      break;
    }
    case CartForm.ACTIONS.BuyerIdentityUpdate: {
      result = await cart.updateBuyerIdentity({
        ...inputs.buyerIdentity,
      });
      break;
    }
    default:
      throw new Error(`${action} cart action is not defined`);
  }

  const cartId = result?.cart?.id;
  const headers = cartId ? cart.setCartId(result.cart.id) : new Headers();
  const {cart: cartResult, errors, warnings} = result;

  const redirectTo = formData.get('redirectTo') ?? null;
  if (typeof redirectTo === 'string') {
    status = 303;
    headers.set('Location', redirectTo);
  }

  return data(
    {
      cart: cartResult,
      errors,
      warnings,
      analytics: {
        cartId,
      },
    },
    {status, headers},
  );
}

export async function loader({context}: LoaderFunctionArgs) {
  const {cart} = context;
  return await cart.get();
}

export default function Cart() {
  const cart = useLoaderData<typeof loader>();
  const [isPageReady, setIsPageReady] = useState(false);
  const hasCalledLoad = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleCartImgLoad = useCallback(() => {
    if (hasCalledLoad.current) return;
    hasCalledLoad.current = true;
    setIsPageReady(true);
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      handleCartImgLoad();
    }
  }, [handleCartImgLoad]);

  return (
    <SkeletonGate isReady={isPageReady} skeleton={<CartPageSkeleton />}>
      <div className="cart">
        <div className="flex justify-center">
          <img
            ref={imgRef}
            src={'https://downloads.adamunderwater.com/store-1-au/public/mycart.png'}
            style={{height: '110px'}}
            alt=""
            className="pt-5"
            onLoad={handleCartImgLoad}
          ></img>
        </div>
        <CartMain layout="page" cart={cart} />
      </div>
    </SkeletonGate>
  );
}
