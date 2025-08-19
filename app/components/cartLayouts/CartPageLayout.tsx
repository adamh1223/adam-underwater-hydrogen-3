import {OptimisticCart} from '@shopify/hydrogen';
import {CartLineItem} from '../CartLineItem';
import {CartEmpty, CartMainProps} from '../CartMain';
import {CartSummary} from '../CartSummary';
import {DefaultCart} from '~/lib/types';

interface cartPageLayoutProps {
  linesCount: boolean;
  layout: CartMainProps['layout'];
  cart: DefaultCart;
  cartHasItems: boolean | 0 | undefined;
}
export function CartPageLayout({
  linesCount,
  layout,
  cart,
  cartHasItems,
}: cartPageLayoutProps) {
  return (
    <>
      <div className="mt-8 grid gap-4 lg:grid-cols-12 px-5">
        {/* changed classname for cart page*/}
        <CartEmpty hidden={linesCount} layout={layout} />
        {/* Added lg:col-span-8 */}
        <div className="cart-details lg:col-span-8">
          <div aria-labelledby="cart-lines">
            <ul>
              {(cart?.lines?.nodes ?? []).map((line) => (
                <CartLineItem key={line.id} line={line} layout={layout} />
              ))}
            </ul>
          </div>
        </div>
        {/* put this line inside a div for cart page to mimic old project, gave div a class */}
        {/* I also commented out the css for cart-main */}
        <div className="lg:col-span-4">
          {cartHasItems && <CartSummary cart={cart} layout={layout} />}
        </div>
        {/* </div> */}
      </div>
      ;
    </>
  );
}

CartPageLayout;
