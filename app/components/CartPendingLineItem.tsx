import type {ComponentProps} from 'react';
import {CartLineItem} from '~/components/CartLineItem';
import type {CartLayout} from '~/components/CartMain';
import {
  createPendingOptimisticCartLine,
  type CartPendingLinePreview,
} from '~/lib/cartPendingLine';

type CartLineItemLine = ComponentProps<typeof CartLineItem>['line'];

export function CartPendingLineItem({
  preview,
  layout,
}: {
  preview: CartPendingLinePreview;
  layout: CartLayout;
}) {
  const pendingLine = createPendingOptimisticCartLine(
    preview,
  ) as unknown as CartLineItemLine;

  return <CartLineItem line={pendingLine} layout={layout} pendingPreview={preview} />;
}
