import React from 'react';
import {CartEmpty, CartMainProps} from '../CartMain';
import {CartLineItem} from '../CartLineItem';
import {CartSummary} from '../CartSummary';
import {DefaultCart} from '~/lib/types';
import type {CartPendingLinePreview} from '~/lib/cartPendingLine';
import {CartPendingLineItem} from '../CartPendingLineItem';

interface CartPageLayoutProps {
  linesCount: boolean;
  layout: CartMainProps['layout'];
  cart: DefaultCart;
  cartHasItems: boolean;
  className: string;
  pendingLinePreviews: CartPendingLinePreview[];
  provisionalDiscountPercentByMerchandiseId: Map<string, number>;
}

export function CartAsideLayout({
  linesCount,
  layout,
  cart,
  cartHasItems,
  className,
  pendingLinePreviews,
  provisionalDiscountPercentByMerchandiseId,
}: CartPageLayoutProps) {
  const cartLines = cart?.lines?.nodes ?? [];
  const isLineOptimistic = (line: (typeof cartLines)[number]) =>
    Boolean((line as {isOptimistic?: boolean}).isOptimistic);
  const nonOptimisticMerchandiseIds = new Set(
    cartLines
      .filter((line) => !isLineOptimistic(line))
      .map((line) => line.merchandise.id),
  );
  const visibleCartLines = cartLines.filter(
    (line) =>
      !(
        isLineOptimistic(line) &&
        nonOptimisticMerchandiseIds.has(line.merchandise.id)
      ),
  );
  const cartMerchandiseIds = new Set(
    visibleCartLines.map((line) => line.merchandise.id),
  );
  const standalonePendingPreviews = pendingLinePreviews.filter(
    (preview) => !cartMerchandiseIds.has(preview.merchandiseId),
  );
  const pendingPreviewByMerchandiseId = new Map<string, CartPendingLinePreview>();
  for (const preview of pendingLinePreviews) {
    pendingPreviewByMerchandiseId.set(preview.merchandiseId, preview);
  }

  return (
    <>
      <div className={className}>
        <CartEmpty hidden={linesCount} layout={layout} />
        <div className="cart-details">
          <div aria-labelledby="cart-lines">
            <div className="mt-5">
              <ul className="mx-2">
                {standalonePendingPreviews.map((preview) => (
                  <CartPendingLineItem
                    key={preview.previewId}
                    preview={preview}
                    layout={layout}
                    provisionalDiscountPercentage={
                      provisionalDiscountPercentByMerchandiseId.get(
                        preview.merchandiseId,
                      ) ?? 0
                    }
                  />
                ))}
                {visibleCartLines.map((line) => (
                  <CartLineItem
                    key={line.id}
                    line={line}
                    layout={layout}
                    pendingPreview={pendingPreviewByMerchandiseId.get(
                      line.merchandise.id,
                    )}
                    provisionalDiscountPercentage={
                      provisionalDiscountPercentByMerchandiseId.get(
                        line.merchandise.id,
                      ) ?? 0
                    }
                  />
                ))}
              </ul>
            </div>
          </div>
          {cartHasItems && (
            <>
              <div className="mx-2">
                <CartSummary
                  cart={cart}
                  layout={layout}
                  pendingLinePreviews={pendingLinePreviews}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default CartAsideLayout;
