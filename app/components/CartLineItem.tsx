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
import {useEffect, useState} from 'react';

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

  console.log(image, 'img3');
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });
  return (
    <Card className="mb-4">
      <CardContent>
        <li
          key={id}
          className={`${
            image?.altText != undefined &&
            image.altText.includes('horizontal') &&
            'cart-line-horizontal-product'
          } ${
            image?.altText != undefined &&
            !image.altText.includes('horizontal') &&
            !image.altText.includes('vert') &&
            'cart-line-stock-product'
          } ${
            image?.altText != undefined &&
            image.altText.includes('vert') &&
            'cart-line-vertical-product'
          }`}
        >
          {/* ✔0-600px landscape print in cart */}
          {windowWidth != undefined &&
            windowWidth <= 600 &&
            image?.altText != undefined &&
            image.altText.includes('horizontal') && (
              <>
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
                      {image?.altText != undefined &&
                        image.altText.includes('horizontal') && (
                          <img
                            alt={title}
                            src={image.url}
                            loading="lazy"
                            className="cart-line-horizontal-product-img"
                          />
                        )}
                      <div className="ps-3">
                        <strong>{product.title}</strong>
                        <ProductPrice price={line?.cost?.totalAmount} />
                      </div>
                    </div>
                  </Link>
                </div>

                {!hasOnlyDefaultTitle && (
                  <div className="pt-1">
                    {cartDescription && (
                      <div className="cart-description">{cartDescription}</div>
                    )}
                    <ul>
                      {selectedOptions.map((option) => (
                        <li key={option.name}>
                          <div className="flex justify-start items-center">
                            <p className="cart-subheader">
                              {option.name}: {option.value}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          {/* ✔601px+ landscape print in cart */}
          {windowWidth != undefined &&
            windowWidth > 600 &&
            image?.altText != undefined &&
            image.altText.includes('horizontal') && (
              <>
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
                      {image?.altText != undefined &&
                        image.altText.includes('horizontal') && (
                          <img
                            alt={title}
                            src={image.url}
                            loading="lazy"
                            className="cart-line-horizontal-product-img"
                          />
                        )}
                      <div className="ps-3">
                        <strong>{product.title}</strong>
                        {cartDescription && (
                          <div className="cart-description">
                            {cartDescription}
                          </div>
                        )}
                        <ProductPrice price={line?.cost?.totalAmount} />
                      </div>
                    </div>
                  </Link>
                </div>

                {!hasOnlyDefaultTitle && (
                  <div>
                    <ul className="pt-3">
                      {selectedOptions.map((option) => (
                        <li key={option.name}>
                          <div className="flex justify-start items-center">
                            <p className="cart-subheader">
                              {option.name}: {option.value}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          {/* ✔0px-600px stock clip in cart */}
          {windowWidth != undefined &&
            windowWidth <= 600 &&
            image?.altText != undefined &&
            !image.altText.includes('horizontal') &&
            !image.altText.includes('vert') && (
              <>
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
                      {image?.altText != undefined &&
                        !image.altText.includes('horizontal') &&
                        !image.altText.includes('vert') && (
                          <img
                            alt={title}
                            src={image.url}
                            loading="lazy"
                            className="cart-line-stock-product-img"
                          />
                        )}
                      <div className="ps-3">
                        <strong>{product.title}</strong>
                        <ProductPrice price={line?.cost?.totalAmount} />
                      </div>
                    </div>
                    <div className="pt-1">
                      {cartDescription && (
                        <div className="cart-description">
                          {cartDescription}
                        </div>
                      )}
                    </div>
                  </Link>
                </div>
              </>
            )}
          {/* ✔601px+ stock clip in cart */}
          {windowWidth != undefined &&
            windowWidth > 600 &&
            image?.altText != undefined &&
            !image.altText.includes('horizontal') &&
            !image.altText.includes('vert') && (
              <>
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
                      {image?.altText != undefined &&
                        image?.altText != undefined &&
                        !image.altText.includes('horizontal') &&
                        !image.altText.includes('vert') && (
                          <img
                            alt={title}
                            src={image.url}
                            loading="lazy"
                            className="cart-line-stock-product-img"
                          />
                        )}
                      <div className="ps-3">
                        <strong>{product.title}</strong>
                        {cartDescription && (
                          <div className="cart-description">
                            {cartDescription}
                          </div>
                        )}
                        <ProductPrice price={line?.cost?.totalAmount} />
                      </div>
                    </div>
                  </Link>
                </div>

                {!hasOnlyDefaultTitle && (
                  <div>
                    <ul className="pt-3">
                      {selectedOptions.map((option) => (
                        <li key={option.name}>
                          <div className="flex justify-start items-center">
                            <p className="cart-subheader">
                              {option.name}: {option.value}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          {/* ✔0px-600px vertical print in cart */}
          {windowWidth != undefined &&
            windowWidth <= 600 &&
            image?.altText != undefined &&
            image.altText.includes('vert') && (
              <>
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
                      {image?.altText != undefined &&
                        image.altText.includes('vert') && (
                          <img
                            alt={title}
                            src={image.url}
                            loading="lazy"
                            className="cart-line-vertical-product-img"
                          />
                        )}
                      <div className="ps-3">
                        <strong>{product.title}</strong>
                        <ProductPrice price={line?.cost?.totalAmount} />
                      </div>
                    </div>
                  </Link>
                </div>

                {!hasOnlyDefaultTitle && (
                  <div className="pt-1">
                    {cartDescription && (
                      <div className="cart-description">{cartDescription}</div>
                    )}
                    <ul>
                      {selectedOptions.map((option) => (
                        <li key={option.name}>
                          <div className="flex justify-start items-center">
                            <p className="cart-subheader">
                              {option.name}: {option.value}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          {/* ✔601px-1279px vertical print in cart */}
          {windowWidth != undefined &&
            windowWidth < 1280 &&
            windowWidth > 600 &&
            image?.altText != undefined &&
            image.altText.includes('vert') && (
              <>
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
                      {image?.altText != undefined &&
                        image.altText.includes('vert') && (
                          <img
                            alt={title}
                            src={image.url}
                            loading="lazy"
                            className="cart-line-vertical-product-img"
                          />
                        )}
                      <div className="ps-3">
                        <strong>{product.title}</strong>
                        {cartDescription && (
                          <div className="cart-description">
                            {cartDescription}
                          </div>
                        )}
                        <ProductPrice price={line?.cost?.totalAmount} />
                      </div>
                    </div>
                  </Link>
                </div>

                {!hasOnlyDefaultTitle && (
                  <div>
                    <ul className="pt-3">
                      {selectedOptions.map((option) => (
                        <li key={option.name}>
                          <div className="flex justify-start items-center">
                            <p className="cart-subheader">
                              {option.name}: {option.value}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          {/* ✔1280px+ vertical print in cart */}
          {windowWidth != undefined &&
            windowWidth >= 1280 &&
            image?.altText != undefined &&
            image.altText.includes('vert') && (
              <>
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
                      {image?.altText != undefined &&
                        image.altText.includes('vert') && (
                          <img
                            alt={title}
                            src={image.url}
                            loading="lazy"
                            className="cart-line-vertical-product-img"
                          />
                        )}
                      <div className="ps-3">
                        <strong>{product.title}</strong>
                        {cartDescription && (
                          <div className="cart-description">
                            {cartDescription}
                          </div>
                        )}
                        <ProductPrice price={line?.cost?.totalAmount} />
                      </div>
                    </div>
                  </Link>
                </div>

                {!hasOnlyDefaultTitle && (
                  <div>
                    <ul className="pt-3">
                      {selectedOptions.map((option) => (
                        <li key={option.name}>
                          <div className="flex justify-start items-center">
                            <p className="cart-subheader">
                              {option.name}: {option.value}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          {/* 1280px+ All products */}
          {/* {windowWidth != undefined && windowWidth >= 1280 && (
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
                  <div>
                    <strong>{product.title}</strong>
                  </div>
                </div>
                {cartDescription && (
                  <div className="cart-description">{cartDescription}</div>
                )}
              </Link>

              <ProductPrice price={line?.cost?.totalAmount} />
              {!hasOnlyDefaultTitle && (
                <ul>
                  {selectedOptions.map((option) => (
                    <li key={option.name}>
                      <div className="flex justify-start items-center">
                        <p className="cart-subheader">
                          {option.name}: {option.value}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )} */}
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
      <div className="cart-subheader flex justify-center align-center ps-1">
        <span>Quantity:</span> &nbsp;
        <span className="text-md font-bold cart-quantity">{quantity}</span>{' '}
        &nbsp;&nbsp;
      </div>
      {hideQuantityButtons && (
        <>
          <CartLineUpdateButton lines={[{id: lineId, quantity: prevQuantity}]}>
            <Button
              aria-label="Decrease quantity"
              disabled={quantity <= 1 || !!isOptimistic}
              name="decrease-quantity"
              value={prevQuantity}
              variant="ghost"
              size="icon"
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
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.LinesRemove}
      inputs={{lineIds}}
    >
      {windowWidth != null && windowWidth <= 600 && (
        <Button
          disabled={disabled}
          type="submit"
          variant="ghost"
          className="remove-button"
          size="sm"
        >
          <p className="remove-button-text">Remove</p>
        </Button>
      )}
      {windowWidth != null && windowWidth > 600 && (
        <Button
          disabled={disabled}
          type="submit"
          variant="ghost"
          className="remove-button"
          size="lg"
        >
          <p className="remove-button-text">Remove</p>
        </Button>
      )}
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
