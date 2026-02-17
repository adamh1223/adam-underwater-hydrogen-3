import type {CartLineUpdateInput} from '@shopify/hydrogen/storefront-api-types';
import type {CartLayout} from '~/components/CartMain';
import {CartForm, Image, type OptimisticCartLine} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';
import {Link, useFetcher} from '@remix-run/react';
import {ProductPrice} from './ProductPrice';
import {useAside} from './Aside';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {Card, CardContent, CardDescription} from './ui/card';
import {Button} from './ui/button';
import {generateCartDescription, includesTagName} from '~/lib/utils';
import {useEffect, useState} from 'react';

type CartLine = OptimisticCartLine<CartApiQueryFragment>;
type ProductVariantOption = {
  name: string;
  value: string;
};
type ProductVariantForSelection = {
  id: string;
  availableForSale?: boolean;
  selectedOptions: ProductVariantOption[];
};

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

  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });

  const isHorizontalProduct =
    image?.url?.includes('horPrimary') || image?.url.includes('horOnly');
  const isStockClip =
    !image?.url.includes('horOnly') &&
    !image?.url.includes('horPrimary') &&
    !image?.url.includes('vertPrimary') &&
    !image?.url.includes('vertOnly');
  const isVerticalProduct =
    image?.url?.includes('vertOnly') || image?.url.includes('vertPrimary');
  const compareAtPerQuantity =
    line?.cost?.compareAtAmountPerQuantity && line?.quantity
      ? (
          parseInt(line?.cost?.compareAtAmountPerQuantity.amount) *
          line?.quantity
        ).toPrecision(2)
      : 0.0;

  const updatedCompareAt = {
    ...line?.cost?.compareAtAmountPerQuantity,
    currencyCode: line?.cost?.compareAtAmountPerQuantity?.currencyCode || 'USD',
    amount: compareAtPerQuantity?.toString(),
  };

  return (
    <Card className="mb-4">
      <CardContent>
        <li
          key={id}
          className={`${
            isHorizontalProduct && 'cart-line-horizontal-product'
          } ${isStockClip && 'cart-line-stock-product'} ${
            isVerticalProduct && 'cart-line-vertical-product'
          }`}
        >
          {/* ✔0-600px landscape print in cart */}
          {windowWidth != undefined &&
            windowWidth <= 600 &&
            isHorizontalProduct && (
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
                      {isHorizontalProduct && (
                        <img
                          alt={title}
                          src={image?.url}
                          loading="lazy"
                          className="cart-line-horizontal-product-img"
                        />
                      )}
                      <div className="ps-3 cart-line-text">
                        <strong>{product.title}</strong>
                        {line?.cost?.compareAtAmountPerQuantity &&
                          line?.quantity && (
                            <ProductPrice
                              price={line?.cost?.totalAmount}
                              compareAtPrice={updatedCompareAt}
                            />
                          )}
                      </div>
                    </div>
                  </Link>
                </div>

                {!hasOnlyDefaultTitle && (
                  <div className="pt-1">
                    {cartDescription && (
                      <div className="cart-description">{cartDescription}</div>
                    )}
                    <CartLineOptionSelectors line={line} />
                  </div>
                )}
              </>
            )}
          {/* ✔601px+ landscape print in cart */}
          {windowWidth != undefined &&
            windowWidth > 600 &&
            isHorizontalProduct && (
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
                      {isHorizontalProduct && (
                        <img
                          alt={title}
                          src={image?.url}
                          loading="lazy"
                          className="cart-line-horizontal-product-img"
                        />
                      )}
                      <div className="ps-3 cart-line-text">
                        <strong>{product.title}</strong>
                        {cartDescription && (
                          <div className="cart-description">
                            {cartDescription}
                          </div>
                        )}
                        <ProductPrice
                          price={line?.cost?.totalAmount}
                          compareAtPrice={updatedCompareAt}
                        />
                      </div>
                    </div>
                  </Link>
                </div>

                {!hasOnlyDefaultTitle && (
                  <div>
                    <CartLineOptionSelectors line={line} className="pt-3" />
                  </div>
                )}
              </>
            )}
          {/* ✔0px-600px stock clip in cart */}
          {windowWidth != undefined && windowWidth <= 600 && isStockClip && (
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
                    {isStockClip && (
                      <img
                        alt={title}
                        src={image?.url}
                        loading="lazy"
                        className="cart-line-stock-product-img"
                      />
                    )}
                    <div className="ps-3 cart-line-text">
                      <strong>{product.title}</strong>
                      <ProductPrice
                        price={line?.cost?.totalAmount}
                        compareAtPrice={updatedCompareAt}
                      />
                    </div>
                  </div>
                  <div className="pt-1">
                    {cartDescription && (
                      <div className="cart-description">{cartDescription}</div>
                    )}
                  </div>
                </Link>
              </div>
              {!hasOnlyDefaultTitle && (
                <div>
                  <CartLineOptionSelectors line={line} className="pt-3" />
                </div>
              )}
            </>
          )}
          {/* ✔601px+ stock clip in cart */}
          {windowWidth != undefined && windowWidth > 600 && isStockClip && (
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
                    {isStockClip && (
                      <img
                        alt={title}
                        src={image?.url}
                        loading="lazy"
                        className="cart-line-stock-product-img"
                      />
                    )}
                    <div className="ps-3 cart-line-text">
                      <strong>{product.title}</strong>
                      {cartDescription && (
                        <div className="cart-description">
                          {cartDescription}
                        </div>
                      )}
                      <ProductPrice
                        price={line?.cost?.totalAmount}
                        compareAtPrice={updatedCompareAt}
                      />
                    </div>
                  </div>
                </Link>
              </div>

              {!hasOnlyDefaultTitle && (
                <div>
                  <CartLineOptionSelectors line={line} className="pt-3" />
                </div>
              )}
            </>
          )}
          {/* ✔0px-600px vertical print in cart */}
          {windowWidth != undefined &&
            windowWidth <= 600 &&
            isVerticalProduct && (
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
                      {isVerticalProduct && (
                        <img
                          alt={title}
                          src={image?.url}
                          loading="lazy"
                          className="cart-line-vertical-product-img"
                        />
                      )}
                      <div className="ps-3 cart-line-text">
                        <strong>{product.title}</strong>
                        <ProductPrice
                          price={line?.cost?.totalAmount}
                          compareAtPrice={updatedCompareAt}
                        />
                      </div>
                    </div>
                  </Link>
                </div>

                {!hasOnlyDefaultTitle && (
                  <div className="pt-1">
                    {cartDescription && (
                      <div className="cart-description">{cartDescription}</div>
                    )}
                    <CartLineOptionSelectors line={line} />
                  </div>
                )}
              </>
            )}
          {/* ✔601px-1279px vertical print in cart */}
          {windowWidth != undefined &&
            windowWidth < 1280 &&
            windowWidth > 600 &&
            isVerticalProduct && (
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
                      {isVerticalProduct && (
                        <img
                          alt={title}
                          src={image?.url}
                          loading="lazy"
                          className="cart-line-vertical-product-img"
                        />
                      )}
                      <div className="ps-3 cart-line-text">
                        <strong>{product.title}</strong>
                        {cartDescription && (
                          <div className="cart-description">
                            {cartDescription}
                          </div>
                        )}
                        <ProductPrice
                          price={line?.cost?.totalAmount}
                          compareAtPrice={updatedCompareAt}
                        />
                      </div>
                    </div>
                  </Link>
                </div>

                {!hasOnlyDefaultTitle && (
                  <div>
                    <CartLineOptionSelectors line={line} className="pt-3" />
                  </div>
                )}
              </>
            )}
          {/* ✔1280px+ vertical print in cart */}
          {windowWidth != undefined &&
            windowWidth >= 1280 &&
            isVerticalProduct && (
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
                      {isVerticalProduct && (
                        <img
                          alt={title}
                          src={image?.url}
                          loading="lazy"
                          className="cart-line-vertical-product-img"
                        />
                      )}
                      <div className="ps-3 cart-line-text">
                        <strong>{product.title}</strong>
                        {cartDescription && (
                          <div className="cart-description">
                            {cartDescription}
                          </div>
                        )}
                        <ProductPrice
                          price={line?.cost?.totalAmount}
                          compareAtPrice={updatedCompareAt}
                        />
                      </div>
                    </div>
                  </Link>
                </div>

                {!hasOnlyDefaultTitle && (
                  <div>
                    <CartLineOptionSelectors line={line} className="pt-3" />
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

function CartLineOptionSelectors({
  line,
  className,
}: {
  line: CartLine;
  className?: string;
}) {
  const fetcher = useFetcher();
  const {id: lineId, quantity, isOptimistic, merchandise} = line;
  const selectedOptions = (merchandise.selectedOptions ?? []) as {
    name: string;
    value: string;
  }[];
  const productWithVariants =
    merchandise.product as typeof merchandise.product & {
      variants?: {nodes?: ProductVariantForSelection[]};
    };
  const variants = productWithVariants.variants?.nodes ?? [];

  if (!selectedOptions.length) return null;

  const isUpdatingLine = fetcher.state !== 'idle' || !!isOptimistic;
  const wrapperClassName = ['cart-option-grid', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClassName}>
      {selectedOptions.map((selectedOption) => {
        const optionValues = getSelectableOptionValues({
          variants,
          selectedOptions,
          optionName: selectedOption.name,
        });
        const currentValue = selectedOption.value;
        const dropdownValues = optionValues.includes(currentValue)
          ? optionValues
          : [currentValue, ...optionValues];
        const inputId = toOptionInputId(`${lineId}-${selectedOption.name}`);

        return (
          <div
            key={`${lineId}-${selectedOption.name}`}
            className="cart-option-row"
          >
            <label
              htmlFor={inputId}
              className="cart-subheader cart-option-name text-start"
            >
              {selectedOption.name}:
            </label>
            <div className="cart-option-value">
              <select
                id={inputId}
                value={currentValue}
                disabled={isUpdatingLine}
                className="cart-option-select cursor-pointer rounded-md border border-[#2a8fd6] bg-secondary px-2 py-1 text-white text-sm text-start focus:outline-none focus:ring-2 focus:ring-[#29abe2]"
                onChange={(event) => {
                  const nextValue = event.currentTarget.value;

                  if (nextValue === currentValue || isUpdatingLine) return;

                  const nextSelectedOptions = selectedOptions.map((option) =>
                    option.name === selectedOption.name
                      ? {...option, value: nextValue}
                      : option,
                  );

                  const nextVariant = findVariantForSelectedOptions({
                    variants,
                    selectedOptions: nextSelectedOptions,
                  });

                  if (!nextVariant?.id) return;

                  fetcher.submit(
                    {
                      [CartForm.INPUT_NAME]: JSON.stringify({
                        action: CartForm.ACTIONS.LinesUpdate,
                        inputs: {
                          lines: [
                            {
                              id: lineId,
                              quantity: quantity ?? 1,
                              merchandiseId: nextVariant.id,
                            },
                          ],
                        },
                      }),
                    },
                    {method: 'post', action: '/cart'},
                  );
                }}
              >
                {dropdownValues.map((value) => (
                  <option key={`${inputId}-${value}`} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getSelectableOptionValues({
  variants,
  selectedOptions,
  optionName,
}: {
  variants: ProductVariantForSelection[];
  selectedOptions: ProductVariantOption[];
  optionName: string;
}) {
  const values = new Set<string>();

  for (const variant of variants) {
    if (variant.availableForSale === false) continue;

    const optionValue = getVariantOptionValue(variant, optionName);
    if (!optionValue) continue;

    const matchesOtherOptions = selectedOptions.every(
      (selectedOption) =>
        selectedOption.name === optionName ||
        getVariantOptionValue(variant, selectedOption.name) ===
          selectedOption.value,
    );

    if (!matchesOtherOptions) continue;
    values.add(optionValue);
  }

  if (!values.size) {
    for (const variant of variants) {
      const optionValue = getVariantOptionValue(variant, optionName);
      if (optionValue) values.add(optionValue);
    }
  }

  return Array.from(values);
}

function findVariantForSelectedOptions({
  variants,
  selectedOptions,
}: {
  variants: ProductVariantForSelection[];
  selectedOptions: ProductVariantOption[];
}) {
  const exactMatch = variants.find(
    (variant) =>
      variant.availableForSale !== false &&
      selectedOptions.every(
        (selectedOption) =>
          getVariantOptionValue(variant, selectedOption.name) ===
          selectedOption.value,
      ),
  );

  if (exactMatch) return exactMatch;

  return variants.find((variant) =>
    selectedOptions.every(
      (selectedOption) =>
        getVariantOptionValue(variant, selectedOption.name) ===
        selectedOption.value,
    ),
  );
}

function getVariantOptionValue(
  variant: ProductVariantForSelection,
  optionName: string,
) {
  return variant.selectedOptions.find((option) => option.name === optionName)
    ?.value;
}

function toOptionInputId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
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
              className="cursor-pointer"
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
              className="cursor-pointer"
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
          className="remove-button cursor-pointer"
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
          className="remove-button cursor-pointer"
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
