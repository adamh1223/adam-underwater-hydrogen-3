import React from 'react';
import {CartEmpty, CartMainProps} from '../CartMain';
import {CartLineItem} from '../CartLineItem';
import {CartSummary} from '../CartSummary';
import {DefaultCart} from '~/lib/types';

interface cartPageLayoutProps {
  linesCount: boolean;
  layout: CartMainProps['layout'];
  cart: DefaultCart;
  cartHasItems: boolean | 0 | undefined;
  className: string;
}

export function CartAsideLayout({
  linesCount,
  layout,
  cart,
  cartHasItems,
  className,
}: cartPageLayoutProps) {
  return (
    <>
      <div className={className}>
        <CartEmpty hidden={linesCount} layout={layout} />
        <div className="cart-details">
          <div aria-labelledby="cart-lines">
            <ul>
              {(cart?.lines?.nodes ?? []).map((line) => (
                <CartLineItem key={line.id} line={line} layout={layout} />
              ))}
            </ul>
          </div>
          {cartHasItems && <CartSummary cart={cart} layout={layout} />}
        </div>
      </div>
    </>
  );
}

export default CartAsideLayout;
