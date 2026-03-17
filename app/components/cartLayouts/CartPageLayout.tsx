import {CartLineItem} from '../CartLineItem';
import {CartEmpty, CartMainProps} from '../CartMain';
import {CartSummary} from '../CartSummary';
import {DefaultCart} from '~/lib/types';
import type {CartPendingLinePreview} from '~/lib/cartPendingLine';
import {CartPendingLineItem} from '../CartPendingLineItem';

interface CartPageLayoutProps {
  linesCount: boolean;
  layout: CartMainProps['layout'];
  cart: DefaultCart;
  cartHasItems: boolean;
  pendingLinePreviews: CartPendingLinePreview[];
  provisionalDiscountPercentByMerchandiseId: Map<string, number>;
}
export function CartPageLayout({
  linesCount,
  layout,
  cart,
  cartHasItems,
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

  // Calculate per-line code discount amounts from cart-level allocations.
  // Order-level discount codes (e.g. WELCOME15) only appear in cart-level
  // discountAllocations, not per-line. Distribute proportionally by line cost.
  const cartDiscountAllocations = (
    (cart as any)?.discountAllocations ?? []
  ) as any[];
  const totalCodeDiscountSavings = cartDiscountAllocations.reduce(
    (total: number, allocation: any) => {
      if (allocation?.__typename !== 'CartCodeDiscountAllocation') return total;
      const label = (allocation?.code ?? '').toLowerCase();
      if (label.includes('free shipping')) return total;
      return total + (Number(allocation?.discountedAmount?.amount) || 0);
    },
    0,
  );
  const totalLineCosts = visibleCartLines.reduce(
    (total, line) =>
      total + (Number(line?.cost?.totalAmount?.amount) || 0),
    0,
  );
  const codeDiscountByLineId = new Map<string, number>();
  if (totalCodeDiscountSavings > 0.0001 && totalLineCosts > 0.0001) {
    for (const line of visibleCartLines) {
      const lineTotal = Number(line?.cost?.totalAmount?.amount) || 0;
      const lineShare =
        (lineTotal / totalLineCosts) * totalCodeDiscountSavings;
      codeDiscountByLineId.set(line.id, lineShare);
    }
  }

  return (
    <>
      <div>
        <CartEmpty hidden={linesCount} layout={layout} />
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-12 px-5">
        {/* ATTENTION: this class name needs to disappear when the cart is empty otherwise it puts everything into the first column */}
        {/* changed classname for cart page*/}
        {/* Added lg:col-span-8 */}
        <div className="cart-details lg:col-span-8">
          <div aria-labelledby="cart-lines">
            <ul>
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
                  codeDiscountAmount={
                    codeDiscountByLineId.get(line.id) ?? 0
                  }
                />
              ))}
            </ul>
          </div>
        </div>
        {/* put this line inside a div for cart page to mimic old project, gave div a class */}
        {/* I also commented out the css for cart-main */}
        <div className="lg:col-span-4">
          {cartHasItems && (
            <CartSummary
              cart={cart}
              layout={layout}
              pendingLinePreviews={pendingLinePreviews}
            />
          )}
        </div>
        {/* </div> */}
      </div>
    </>
  );
}
