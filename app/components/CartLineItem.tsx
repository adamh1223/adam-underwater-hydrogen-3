import type {CartLineUpdateInput} from '@shopify/hydrogen/storefront-api-types';
import type {CartLayout} from '~/components/CartMain';
import {CartForm, Image, type OptimisticCartLine} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';
import {Link} from '@remix-run/react';
import {ProductPrice} from './ProductPrice';
import {useAside} from './Aside';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {Card, CardContent, CardDescription} from './ui/card';
import {Button} from './ui/button';
import {generateCartDescription, includesTagName} from '~/lib/utils';

type CartLine = OptimisticCartLine<CartApiQueryFragment>;

/**
 * A single line item in the cart. It displays the product image, title, price.
 * It also provides controls to update the quantity or remove the line item.
 */
export function CartLineItem({
  layout,
  line,
}: {
  layout: CartLayout;
  line: CartLine;
}) {
  const {id, merchandise} = line;
  const {product, title, image, selectedOptions} = merchandise;
  const lineItemUrl = useVariantUrl(product.handle, selectedOptions);
  const {close} = useAside();
  const hasOnlyDefaultTitle = selectedOptions.some(
    (option) => option.value === 'Default Title',
  );
  // @ts-expect-error fixed when restart
  const hasVideoTag = includesTagName(product.tags, 'Video');
  // @ts-expect-error fixed when restart
  const hasPrintTag = includesTagName(product.tags, 'Prints');
  const cartDescription = generateCartDescription(hasVideoTag || hasPrintTag);
  console.log(cartDescription, '484848');

  return (
    <Card className="mb-4">
      <CardContent>
        <li key={id} className="cart-line">
          {image && (
            <Image
              alt={title}
              aspectRatio="1/1"
              data={image}
              height={120}
              loading="lazy"
              width={120}
            />
          )}

          <div>
            <Link
              prefetch="intent"
              to={lineItemUrl}
              onClick={() => {
                if (layout === 'aside') {
                  close();
                }
              }}
            >
              <div className="flex flex-row">
                <p>
                  <strong>{product.title}</strong>
                </p>
                &nbsp;{cartDescription && <p>{cartDescription}</p>}
              </div>
            </Link>
            <ProductPrice price={line?.cost?.totalAmount} />
            {!hasOnlyDefaultTitle && (
              <ul>
                {selectedOptions.map((option) => (
                  <li key={option.name}>
                    <p className="cart-subheader">
                      {option.name}: {option.value}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
        <CartLineQuantity line={line} hideQuantityButtons={!!hasPrintTag} />
      </CardContent>
    </Card>
  );
}

/**
 * Provides the controls to update the quantity of a line item in the cart.
 * These controls are disabled when the line item is new, and the server
 * hasn't yet responded that it was successfully added to the cart.
 */
function CartLineQuantity({
  line,
  hideQuantityButtons,
}: {
  line: CartLine;
  hideQuantityButtons: boolean;
}) {
  if (!line || typeof line?.quantity === 'undefined') return null;
  const {id: lineId, quantity, isOptimistic} = line;
  const prevQuantity = Number(Math.max(0, quantity - 1).toFixed(0));
  const nextQuantity = Number((quantity + 1).toFixed(0));

  return (
    <div className="cart-line-quantity">
      <p className="cart-subheader">
        Quantity: <span className="text-md font-bold">{quantity}</span>{' '}
        &nbsp;&nbsp;
      </p>
      {hideQuantityButtons && (
        <>
          <CartLineUpdateButton lines={[{id: lineId, quantity: prevQuantity}]}>
            <Button
              aria-label="Decrease quantity"
              disabled={quantity <= 1 || !!isOptimistic}
              name="decrease-quantity"
              value={prevQuantity}
              variant="ghost"
            >
              <span>&#8722; </span>
            </Button>
          </CartLineUpdateButton>
          &nbsp;
          <CartLineUpdateButton lines={[{id: lineId, quantity: nextQuantity}]}>
            <Button
              aria-label="Increase quantity"
              name="increase-quantity"
              value={nextQuantity}
              disabled={!!isOptimistic}
              variant="ghost"
            >
              <span>&#43;</span>
            </Button>
          </CartLineUpdateButton>
        </>
      )}
      &nbsp;
      <CartLineRemoveButton lineIds={[lineId]} disabled={!!isOptimistic} />
    </div>
  );
}

/**
 * A button that removes a line item from the cart. It is disabled
 * when the line item is new, and the server hasn't yet responded
 * that it was successfully added to the cart.
 */
function CartLineRemoveButton({
  lineIds,
  disabled,
}: {
  lineIds: string[];
  disabled: boolean;
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.LinesRemove}
      inputs={{lineIds}}
    >
      <Button disabled={disabled} type="submit" variant="ghost">
        Remove
      </Button>
    </CartForm>
  );
}

function CartLineUpdateButton({
  children,
  lines,
}: {
  children: React.ReactNode;
  lines: CartLineUpdateInput[];
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.LinesUpdate}
      inputs={{lines}}
    >
      {children}
    </CartForm>
  );
}
