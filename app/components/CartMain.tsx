import {useOptimisticCart} from '@shopify/hydrogen';
import {Link, useLocation} from '@remix-run/react';
import {useEffect, useMemo, useState} from 'react';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';
import {DefaultCart} from '~/lib/types';
import {CartPageLayout} from './cartLayouts/CartPageLayout';
import {CartAsideLayout} from './cartLayouts/CartAsideLayout';
import {Button} from './ui/button';
import {
  CART_PENDING_LINE_ADD_EVENT,
  createCartPendingLinePreview,
  type CartPendingLinePreview,
  type CartPendingLinePreviewPayload,
} from '~/lib/cartPendingLine';

export type CartLayout = 'page' | 'aside';

export type CartMainProps = {
  cart: CartApiQueryFragment | null;
  layout: CartLayout;
};

type CartLineNodeForDiscountPreview = {
  isOptimistic?: boolean;
  quantity?: number;
  merchandise: {
    id: string;
    product: {
      tags?: string[] | null;
    };
  };
  cost?: {
    totalAmount?: {
      amount?: string | null;
    };
    subtotalAmount?: {
      amount?: string | null;
    };
  };
};

function parseMoneyAmount(amount?: string | null) {
  const numericAmount = Number(amount);
  return Number.isFinite(numericAmount) ? numericAmount : 0;
}

function isLineOptimistic(
  line: CartLineNodeForDiscountPreview,
) {
  return Boolean((line as {isOptimistic?: boolean}).isOptimistic);
}

function getLineSubtotalBeforeDiscount(
  line: CartLineNodeForDiscountPreview,
) {
  const subtotalAmount = parseMoneyAmount(
    (
      line as unknown as {
        cost?: {subtotalAmount?: {amount?: string | null}};
      }
    )?.cost?.subtotalAmount?.amount,
  );
  if (subtotalAmount > 0.0001) return subtotalAmount;
  return parseMoneyAmount(line?.cost?.totalAmount?.amount);
}

function getLineSubtotalAfterDiscount(
  line: CartLineNodeForDiscountPreview,
) {
  return parseMoneyAmount(line?.cost?.totalAmount?.amount);
}

function isPrintLine(tags: string[]) {
  return tags.some((tag) => tag?.toLowerCase?.() === 'prints');
}

function isStockClipLine(tags: string[]) {
  const loweredTags = tags.map((tag) => tag.toLowerCase());
  return loweredTags.includes('video') && !loweredTags.includes('bundle');
}

function isStockBundleLine(tags: string[]) {
  const loweredTags = tags.map((tag) => tag.toLowerCase());
  return loweredTags.includes('video') && loweredTags.includes('bundle');
}

/**
 * The main cart component that displays the cart items and summary.
 * It is used by both the /cart route and the cart aside dialog.
 */
export function CartMain({layout, cart: originalCart}: CartMainProps) {
  // The useOptimisticCart hook applies pending actions to the cart
  // so the user immediately sees feedback when they modify the cart.
  const cart = useOptimisticCart(originalCart);
  const location = useLocation();
  const currentURL = location.pathname;
  const [pendingLinePreviews, setPendingLinePreviews] = useState<
    CartPendingLinePreview[]
  >([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePendingLineAdd = (event: Event) => {
      const detail = (event as CustomEvent<CartPendingLinePreviewPayload>).detail;
      if (!detail?.merchandiseId) return;

      setPendingLinePreviews((previousPreviews) => {
        const nextPreview = createCartPendingLinePreview(detail);
        return [...previousPreviews, nextPreview];
      });
    };

    window.addEventListener(
      CART_PENDING_LINE_ADD_EVENT,
      handlePendingLineAdd as EventListener,
    );
    return () => {
      window.removeEventListener(
        CART_PENDING_LINE_ADD_EVENT,
        handlePendingLineAdd as EventListener,
      );
    };
  }, []);

  const cartMerchandiseIds = useMemo(
    () =>
      new Set(
        (cart?.lines?.nodes ?? [])
          .filter((line) => !line.isOptimistic)
          .map((line) => line.merchandise.id),
      ),
    [cart?.lines?.nodes],
  );

  useEffect(() => {
    setPendingLinePreviews((previousPreviews) => {
      if (!previousPreviews.length) return previousPreviews;

      const now = Date.now();
      const remainingPreviews = previousPreviews.filter((preview) => {
        const hasResolvedInCart = cartMerchandiseIds.has(preview.merchandiseId);
        const hasExpired = now - preview.createdAt > 12000;
        return !hasResolvedInCart && !hasExpired;
      });

      return remainingPreviews.length === previousPreviews.length
        ? previousPreviews
        : remainingPreviews;
    });
  }, [cartMerchandiseIds]);

  const hasPendingLines = pendingLinePreviews.length > 0;
  const provisionalDiscountPercentByMerchandiseId = useMemo(() => {
    if (!hasPendingLines) return new Map<string, number>();

    const pendingPreviewByMerchandiseId = new Map(
      pendingLinePreviews.map((preview) => [preview.merchandiseId, preview] as const),
    );
    const effectiveLines = (cart?.lines?.nodes ?? []).map((line) => {
      const pendingPreview = pendingPreviewByMerchandiseId.get(line.merchandise.id);
      const applyPendingPreviewAmounts =
        Boolean(pendingPreview) && isLineOptimistic(line);
      const tags = applyPendingPreviewAmounts
        ? (pendingPreview?.productTags ?? [])
        : Array.isArray(line?.merchandise?.product?.tags)
          ? line.merchandise.product.tags
          : [];
      const subtotalBeforeDiscount = applyPendingPreviewAmounts
        ? parseMoneyAmount(pendingPreview?.priceAmount)
        : getLineSubtotalBeforeDiscount(line);
      const subtotalAfterDiscount = applyPendingPreviewAmounts
        ? parseMoneyAmount(pendingPreview?.priceAmount)
        : getLineSubtotalAfterDiscount(line);

      return {
        merchandiseId: line.merchandise.id,
        quantity: line.quantity ?? 1,
        tags,
        hasServerDiscount:
          !applyPendingPreviewAmounts &&
          subtotalBeforeDiscount > subtotalAfterDiscount + 0.0001,
      };
    });

    const cartMerchandiseIds = new Set(
      (cart?.lines?.nodes ?? []).map((line) => line.merchandise.id),
    );
    for (const preview of pendingLinePreviews) {
      if (cartMerchandiseIds.has(preview.merchandiseId)) continue;
      effectiveLines.push({
        merchandiseId: preview.merchandiseId,
        quantity: 1,
        tags: preview.productTags ?? [],
        hasServerDiscount: false,
      });
    }

    const printQuantity = effectiveLines.reduce(
      (runningTotal, line) =>
        runningTotal + (isPrintLine(line.tags) ? line.quantity : 0),
      0,
    );
    const stockClipQuantity = effectiveLines.reduce(
      (runningTotal, line) =>
        runningTotal + (isStockClipLine(line.tags) ? line.quantity : 0),
      0,
    );
    const stockBundleQuantity = effectiveLines.reduce(
      (runningTotal, line) =>
        runningTotal + (isStockBundleLine(line.tags) ? line.quantity : 0),
      0,
    );
    const qualifiesForPrintBulkDiscount = printQuantity >= 3;
    const qualifiesForStockClipBulkDiscount = stockClipQuantity >= 4;
    const qualifiesForStockBundleBulkDiscount = stockBundleQuantity >= 3;

    const discountMap = new Map<string, number>();
    for (const line of effectiveLines) {
      if (line.hasServerDiscount) continue;

      const qualifiesForPrint =
        qualifiesForPrintBulkDiscount && isPrintLine(line.tags);
      const qualifiesForStockClip =
        qualifiesForStockClipBulkDiscount && isStockClipLine(line.tags);
      const qualifiesForStockBundle =
        qualifiesForStockBundleBulkDiscount && isStockBundleLine(line.tags);
      if (qualifiesForPrint || qualifiesForStockClip || qualifiesForStockBundle) {
        if (qualifiesForStockBundle) {
          discountMap.set(line.merchandiseId, 18);
          continue;
        }
        discountMap.set(line.merchandiseId, 15);
      }
    }

    return discountMap;
  }, [cart?.lines?.nodes, hasPendingLines, pendingLinePreviews]);
  const linesCount = Boolean((cart?.lines?.nodes?.length || 0) || hasPendingLines);
  const withDiscount =
    cart &&
    Boolean(cart?.discountCodes?.filter((code) => code.applicable)?.length);
  const className = `cart-main ${withDiscount ? 'with-discount' : ''}`;
  const cartHasItems = (cart?.totalQuantity ?? 0) > 0;

  // CART PAGE (Class name)
  return (
    <>
      {currentURL === '/cart' && (
        <CartPageLayout
          linesCount={linesCount}
          layout={layout}
          cart={cart as DefaultCart}
          cartHasItems={cartHasItems}
          pendingLinePreviews={pendingLinePreviews}
          provisionalDiscountPercentByMerchandiseId={
            provisionalDiscountPercentByMerchandiseId
          }
        />
      )}
      {currentURL != '/cart' && (
        <CartAsideLayout
          linesCount={linesCount}
          layout={layout}
          cart={cart as DefaultCart}
          cartHasItems={cartHasItems}
          className={className}
          pendingLinePreviews={pendingLinePreviews}
          provisionalDiscountPercentByMerchandiseId={
            provisionalDiscountPercentByMerchandiseId
          }
        />
      )}
    </>
  );
}

export function CartEmpty({
  hidden = false,
}: {
  hidden: boolean;
  layout?: CartMainProps['layout'];
}) {
  const {close} = useAside();
  return (
    <div hidden={hidden}>
      <br />
      <div className="flex justify-center p-5">
        <p>
          Looks like you haven&rsquo;t added anything yet, let&rsquo;s get you
          started!
        </p>
        <br />
      </div>
      <div className="flex justify-center">
        <Button variant="default">
          <Link to="/collections/prints" onClick={close} prefetch="viewport">
            Continue shopping →
          </Link>
        </Button>
      </div>
    </div>
  );
}
