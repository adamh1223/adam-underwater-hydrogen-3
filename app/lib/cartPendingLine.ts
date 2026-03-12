export const CART_PENDING_LINE_ADD_EVENT = 'cart:pending-line:add';

export type CartPendingLineSelectedOption = {
  name: string;
  value: string;
};

export type CartPendingLinePreviewPayload = {
  merchandiseId: string;
  productId?: string;
  productHandle?: string;
  productTitle: string;
  productTags?: string[];
  variantTitle?: string;
  optionValuesByName?: Record<string, string[]>;
  productTypeLabel?: string;
  imageUrl?: string | null;
  priceLabel?: string | null;
  priceAmount?: string | null;
  priceCurrencyCode?: string | null;
  compareAtPriceLabel?: string | null;
  compareAtAmount?: string | null;
  selectedOptions?: CartPendingLineSelectedOption[];
  showQuantityButtons?: boolean;
  isVerticalImage?: boolean;
};

export type CartPendingLinePreview = CartPendingLinePreviewPayload & {
  previewId: string;
  createdAt: number;
};

export function createCartPendingLinePreview(
  payload: CartPendingLinePreviewPayload,
): CartPendingLinePreview {
  const randomId = Math.random().toString(36).slice(2, 10);
  return {
    ...payload,
    previewId: `${payload.merchandiseId}-${Date.now()}-${randomId}`,
    createdAt: Date.now(),
  };
}

export function emitCartPendingLinePreview(
  payload: CartPendingLinePreviewPayload,
) {
  if (typeof window === 'undefined') return;
  if (!payload.merchandiseId) return;

  window.dispatchEvent(
    new CustomEvent<CartPendingLinePreviewPayload>(CART_PENDING_LINE_ADD_EVENT, {
      detail: payload,
    }),
  );
}

export function createPendingOptimisticCartLine(
  preview: CartPendingLinePreview,
) {
  const currencyCode = preview.priceCurrencyCode ?? 'USD';
  const totalAmount = preview.priceAmount ?? '0.00';
  const compareAtAmount = preview.compareAtAmount ?? null;
  const selectedOptions = Array.isArray(preview.selectedOptions)
    ? preview.selectedOptions
    : [];
  const productTags = Array.isArray(preview.productTags)
    ? preview.productTags
    : [];

  return {
    id: `pending-${preview.previewId}`,
    quantity: 1,
    isOptimistic: true,
    merchandise: {
      id: preview.merchandiseId,
      title: preview.variantTitle ?? 'Default Title',
      image: preview.imageUrl
        ? {
            url: preview.imageUrl,
            altText: preview.productTitle,
          }
        : null,
      selectedOptions,
      product: {
        id: preview.productId ?? '',
        title: preview.productTitle,
        handle: preview.productHandle ?? '',
        tags: productTags,
        variants: {nodes: []},
      },
    },
    cost: {
      totalAmount: {
        amount: totalAmount,
        currencyCode,
      },
      subtotalAmount: {
        amount: totalAmount,
        currencyCode,
      },
      compareAtAmountPerQuantity: compareAtAmount
        ? {
            amount: compareAtAmount,
            currencyCode,
          }
        : null,
    },
    __pendingOptionValuesByName: preview.optionValuesByName ?? {},
  };
}
