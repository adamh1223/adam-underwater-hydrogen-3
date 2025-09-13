import {useOptimisticCart} from '@shopify/hydrogen';
import {Link, useLocation} from '@remix-run/react';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';
import {CartLineItem} from '~/components/CartLineItem';
import {CartSummary} from './CartSummary';
import {DefaultCart} from '~/lib/types';
import {CartPageLayout} from './cartLayouts/CartPageLayout';
import {CartAsideLayout} from './cartLayouts/CartAsideLayout';
import {Button} from './ui/button';

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
  console.log(currentURL, '373737');

  const linesCount = Boolean(cart?.lines?.nodes?.length || 0);
  const withDiscount =
    cart &&
    Boolean(cart?.discountCodes?.filter((code) => code.applicable)?.length);
  const className = `cart-main ${withDiscount ? 'with-discount' : ''}`;
  const cartHasItems = cart?.totalQuantity && cart?.totalQuantity > 0;

  // CART PAGE (Class name)
  return (
    <>
      {currentURL === '/cart' && (
        <CartPageLayout
          linesCount={linesCount}
          layout={layout}
          cart={cart as DefaultCart}
          cartHasItems={cartHasItems}
        />
      )}
      {currentURL != '/cart' && (
        <CartAsideLayout
          linesCount={linesCount}
          layout={layout}
          cart={cart as DefaultCart}
          cartHasItems={cartHasItems}
          className={className}
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
