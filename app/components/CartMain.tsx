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
