import type {CartLineUpdateInput} from '@shopify/hydrogen/storefront-api-types';
import type {CartLayout} from '~/components/CartMain';
import {CartForm, Money, type OptimisticCartLine} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';
import {Link, useFetcher} from '@remix-run/react';
import {ProductPrice} from './ProductPrice';
import {useAside} from './Aside';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {Card, CardContent} from './ui/card';
import {Button} from './ui/button';
import {Skeleton} from './ui/skeleton';
import {generateCartDescription} from '~/lib/utils';
import {Fragment, useEffect, useState} from 'react';
import type {CartPendingLinePreview} from '~/lib/cartPendingLine';

type CartLine = OptimisticCartLine<CartApiQueryFragment>;
type CartLineWithPendingMetadata = CartLine & {
  __pendingOptionValuesByName?: Record<string, string[]>;
};
type ProductVariantOption = {
  name: string;
  value: string;
};
type ProductVariantForSelection = {
  id: string;
  availableForSale?: boolean;
  selectedOptions: ProductVariantOption[];
};
type CartLineMoney = NonNullable<CartLine['cost']>['totalAmount'];

function parseMoneyAmount(amount?: string | null) {
  const numericAmount = Number(amount);
  return Number.isFinite(numericAmount) ? numericAmount : 0;
}

function createMoneyValue(
  amount: number,
  currencyCode: CartLineMoney['currencyCode'],
): CartLineMoney {
  return {
    amount: amount.toFixed(2),
    currencyCode,
  };
}

function normalizePendingLineWithPreview({
  line,
  pendingPreview,
}: {
  line: CartLineWithPendingMetadata;
  pendingPreview?: CartPendingLinePreview | null;
}): CartLineWithPendingMetadata {
  if (!pendingPreview || !line?.isOptimistic) {
    return line;
  }

  const lineCost = line?.cost ?? null;
  const lineCurrencyCode =
    lineCost?.totalAmount?.currencyCode ??
    lineCost?.compareAtAmountPerQuantity?.currencyCode ??
    ('USD' as CartLineMoney['currencyCode']);
  const currencyCode = (pendingPreview.priceCurrencyCode ??
    lineCurrencyCode) as CartLineMoney['currencyCode'];
  const totalAmount =
    pendingPreview.priceAmount ?? lineCost?.totalAmount?.amount ?? '0.00';
  const compareAtAmount =
    pendingPreview.compareAtAmount ??
    lineCost?.compareAtAmountPerQuantity?.amount ??
    null;
  const selectedOptions =
    pendingPreview.selectedOptions?.length
      ? pendingPreview.selectedOptions
      : (line?.merchandise?.selectedOptions ?? []);
  const productTags =
    pendingPreview.productTags?.length
      ? pendingPreview.productTags
      : Array.isArray(line?.merchandise?.product?.tags)
        ? line.merchandise.product.tags
        : [];

  return {
    ...line,
    merchandise: {
      ...line.merchandise,
      title: pendingPreview.variantTitle ?? line?.merchandise?.title ?? 'Default Title',
      image: pendingPreview.imageUrl
        ? {
            ...(line?.merchandise?.image ?? {}),
            url: pendingPreview.imageUrl,
            altText:
              pendingPreview.productTitle ??
              line?.merchandise?.image?.altText ??
              null,
          }
        : line?.merchandise?.image,
      selectedOptions,
      product: {
        ...line.merchandise.product,
        id: pendingPreview.productId ?? line?.merchandise?.product?.id,
        title:
          pendingPreview.productTitle ??
          line?.merchandise?.product?.title ??
          '',
        handle:
          pendingPreview.productHandle ??
          line?.merchandise?.product?.handle ??
          '',
        tags: productTags,
      },
    },
    cost: {
      ...lineCost,
      totalAmount: {
        ...(lineCost?.totalAmount ?? {}),
        amount: totalAmount,
        currencyCode,
      },
      compareAtAmountPerQuantity: compareAtAmount
        ? ({
            ...(lineCost?.compareAtAmountPerQuantity ?? {}),
            amount: compareAtAmount,
            currencyCode,
          } as CartLineMoney)
        : null,
    },
    __pendingOptionValuesByName:
      pendingPreview.optionValuesByName ?? line.__pendingOptionValuesByName,
  };
}

function CartLinePrice({
  price,
  compareAtPrice,
  preDiscountPrice,
}: {
  price?: CartLineMoney | null;
  compareAtPrice?: CartLineMoney | null;
  preDiscountPrice?: CartLineMoney | null;
}) {
  const hasLineDiscount =
    !!price &&
    !!preDiscountPrice &&
    parseMoneyAmount(preDiscountPrice.amount) >
      parseMoneyAmount(price.amount) + 0.0001;

  if (!hasLineDiscount) {
    return (
      <ProductPrice
        price={price ?? undefined}
        compareAtPrice={compareAtPrice}
      />
    );
  }

  return (
    <div className="product-price">
      <div className="product-price-on-sale">
        {price ? <Money data={price} /> : null}
        <s className="cart-line-regular-discount-price">
          <Money data={preDiscountPrice} />
        </s>
        {compareAtPrice ? (
          <s>
            <Money data={compareAtPrice} />
          </s>
        ) : null}
      </div>
    </div>
  );
}

function CartLineItemSkeleton({
  optionCount,
  isVerticalImage,
  showQuantityButtons,
}: {
  optionCount: number;
  isVerticalImage: boolean;
  showQuantityButtons: boolean;
}) {
  const normalizedOptionCount = Math.max(1, Math.min(optionCount, 3));
  const skeletonOptionRows = ['one', 'two', 'three'].slice(
    0,
    normalizedOptionCount,
  );
  const imageSkeletonClassName = isVerticalImage
    ? 'h-[115px] w-[95px]'
    : 'h-[95px] w-[115px]';

  return (
    <Card className="mb-2">
      <CardContent>
        <div className="space-y-3">
          <div className="flex min-w-0 gap-2">
            <Skeleton className={`${imageSkeletonClassName} shrink-0 rounded-md`} />
            <div className="min-w-0 flex-1 space-y-2 pt-1">
              <Skeleton className="h-7 w-[82%] rounded-md" />
              <Skeleton className="h-6 w-[58%] rounded-md" />
              <Skeleton className="h-6 w-[72%] rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-[minmax(7rem,9.5rem)_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
            {skeletonOptionRows.map((rowKey) => (
              <Fragment key={`cart-line-skeleton-option-${rowKey}`}>
                <Skeleton className="h-6 w-[78%] rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
              </Fragment>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 w-[106px] rounded-md" />
            {showQuantityButtons ? (
              <>
                <Skeleton className="h-10 w-10 rounded-md" />
                <Skeleton className="h-10 w-10 rounded-md" />
              </>
            ) : null}
            <Skeleton className="h-10 w-[96px] rounded-md" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * A single line item in the cart. It displays the product image, title, price.
 * It also provides controls to update the quantity or remove the line item.
 */
export function CartLineItem({
  layout,
  line,
  pendingPreview = null,
  provisionalDiscountPercentage = 0,
  suppressOptimisticSkeleton = false,
}: {
  layout: CartLayout;
  line: CartLineWithPendingMetadata;
  pendingPreview?: CartPendingLinePreview | null;
  provisionalDiscountPercentage?: number;
  suppressOptimisticSkeleton?: boolean;
}) {
  const normalizedLine = normalizePendingLineWithPreview({line, pendingPreview});
  const {id, merchandise} = normalizedLine;
  const {product, title, image, selectedOptions} = merchandise;
  const lineItemUrl = useVariantUrl(product.handle, selectedOptions);
  const {close} = useAside();
  const normalizedSelectedOptions = Array.isArray(selectedOptions)
    ? selectedOptions
    : [];
  const hasOnlyDefaultTitle = normalizedSelectedOptions.some(
    (option) => option.value === 'Default Title',
  );
  const productTags = Array.isArray(product.tags) ? [...product.tags] : [];
  const normalizedProductTags = productTags.map((tag) => tag.toLowerCase());
  const productTitleLower = product.title.toLowerCase();
  const selectedOrientationValue =
    normalizedSelectedOptions
      .find((option) => option.name.toLowerCase() === 'orientation')
      ?.value?.toLowerCase() ?? '';
  const hasPrintTag = productTags.some((tag) =>
    tag?.toLowerCase?.().includes('print'),
  );
  const cartDescription = generateCartDescription(productTags);

  const [windowWidth, setWindowWidth] = useState<number | undefined>(() =>
    typeof window !== 'undefined' ? window.innerWidth : undefined,
  );
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isPrintProduct = normalizedProductTags.includes('prints');
  const isVideoProduct = normalizedProductTags.includes('video');
  const hasHorizontalPrintTag = normalizedProductTags.some((tag) =>
    ['horonly', 'horprimary', 'horizontal'].includes(tag),
  );
  const hasVerticalPrintTag = normalizedProductTags.some((tag) =>
    ['vertonly', 'vertprimary', 'vertical'].includes(tag),
  );

  const isHorizontalProduct =
    isPrintProduct &&
    (selectedOrientationValue === 'landscape' ||
      selectedOrientationValue === 'horizontal' ||
      hasHorizontalPrintTag ||
      productTitleLower.includes('horizontal'));
  const isVerticalProduct =
    isPrintProduct &&
    (selectedOrientationValue === 'vertical' ||
      selectedOrientationValue === 'portrait' ||
      hasVerticalPrintTag ||
      productTitleLower.includes('vertical'));
  const isStockClip = isVideoProduct && !isPrintProduct;
  const usesStockLayout =
    isStockClip ||
    isHorizontalProduct ||
    (isPrintProduct && !isVerticalProduct && !isHorizontalProduct);
  const currencyCode =
    normalizedLine?.cost?.totalAmount?.currencyCode ||
    normalizedLine?.cost?.compareAtAmountPerQuantity?.currencyCode ||
    'USD';

  const compareAtAmountPerQuantity = parseMoneyAmount(
    normalizedLine?.cost?.compareAtAmountPerQuantity?.amount,
  );
  const compareAtTotal = compareAtAmountPerQuantity * (normalizedLine?.quantity ?? 1);
  const updatedCompareAt =
    compareAtAmountPerQuantity > 0
      ? {
          ...normalizedLine?.cost?.compareAtAmountPerQuantity,
          currencyCode,
          amount: compareAtTotal.toFixed(2),
        }
      : null;

  const lineSubtotalAmount = parseMoneyAmount(
    (normalizedLine as unknown as {cost?: {subtotalAmount?: {amount?: string | null}}})
      ?.cost?.subtotalAmount?.amount,
  );
  const lineTotalAmount = parseMoneyAmount(normalizedLine?.cost?.totalAmount?.amount);
  const hasServerLineDiscount = lineSubtotalAmount > lineTotalAmount + 0.0001;
  const canApplyProvisionalDiscount =
    provisionalDiscountPercentage > 0 && !hasServerLineDiscount;
  const effectivePreDiscountAmount =
    lineSubtotalAmount > 0.0001 ? lineSubtotalAmount : lineTotalAmount;
  const provisionalDiscountedAmount = canApplyProvisionalDiscount
    ? Math.max(
        0,
        effectivePreDiscountAmount * (1 - provisionalDiscountPercentage / 100),
      )
    : lineTotalAmount;
  const effectiveLineTotalAmount = canApplyProvisionalDiscount
    ? provisionalDiscountedAmount
    : lineTotalAmount;
  const displayPriceMoney = normalizedLine?.cost?.totalAmount
    ? createMoneyValue(effectiveLineTotalAmount, currencyCode)
    : normalizedLine?.cost?.totalAmount;
  const lineDiscountPercent = hasServerLineDiscount
    ? lineSubtotalAmount > 0
      ? Math.round(
          ((lineSubtotalAmount - lineTotalAmount) / lineSubtotalAmount) * 100,
        )
      : 0
    : canApplyProvisionalDiscount
      ? provisionalDiscountPercentage
      : 0;
  const preDiscountPrice =
    hasServerLineDiscount || canApplyProvisionalDiscount
      ? createMoneyValue(effectivePreDiscountAmount, currencyCode)
      : null;
  const hasLineDiscount = hasServerLineDiscount || canApplyProvisionalDiscount;
  const lineDiscountText = hasLineDiscount
    ? lineDiscountPercent > 0
      ? `${lineDiscountPercent}% discount applied!`
      : 'Discount applied!'
    : null;
  const isMobileView = windowWidth !== undefined && windowWidth <= 600;
  const isTabletStockLayout =
    windowWidth !== undefined &&
    windowWidth > 600 &&
    usesStockLayout;
  const showFooterDescription = isMobileView && Boolean(cartDescription);
  const showInlineDescription = !showFooterDescription;
  const hasResolvedProductIdentity = Boolean(
    product?.title && product?.handle && image?.url,
  );
  const hasResolvedLinePrice = Boolean(normalizedLine?.cost?.totalAmount?.amount);
  const hasRenderableLayout = isVerticalProduct || usesStockLayout;
  const likelyPrintLine =
    hasPrintTag ||
    normalizedSelectedOptions.some((option) =>
      ['orientation', 'layout', 'size'].includes(option.name.toLowerCase()),
    );
  const skeletonOptionCount = normalizedSelectedOptions.length || (likelyPrintLine ? 3 : 1);
  const showQuantityButtonsInSkeleton = likelyPrintLine || Boolean(hasPrintTag);
  const shouldRenderOptimisticSkeleton = Boolean(
    normalizedLine?.isOptimistic &&
      !pendingPreview &&
      (!hasResolvedProductIdentity ||
        !hasResolvedLinePrice ||
        !hasRenderableLayout ||
        windowWidth === undefined),
  );

  if (shouldRenderOptimisticSkeleton) {
    if (suppressOptimisticSkeleton) {
      return null;
    }
    return (
      <CartLineItemSkeleton
        optionCount={skeletonOptionCount}
        isVerticalImage={isVerticalProduct}
        showQuantityButtons={showQuantityButtonsInSkeleton}
      />
    );
  }

  const linePrice = (
    <CartLinePrice
      price={displayPriceMoney}
      compareAtPrice={updatedCompareAt}
      preDiscountPrice={preDiscountPrice}
    />
  );

  return (
    <Card className="mb-2">
      <CardContent>
          <li
          key={id}
          className={`${
            isHorizontalProduct && 'cart-line-horizontal-product'
          } ${usesStockLayout && 'cart-line-stock-product'} ${
            isVerticalProduct && 'cart-line-vertical-product'
          }`}
        >
         
          {/* ✔0px-600px stock clip OR horizontal print in cart */}
          {windowWidth != undefined && windowWidth <= 600 && usesStockLayout && (
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
                  <div className="flex flex-row min-w-0">
                    {usesStockLayout && (
                      <img
                        alt={title}
                        src={image?.url}
                        loading="lazy"
                        className="cart-line-stock-product-img rounded-md"
                      />
                    )}
                    <div className="ps-[8px] cart-line-text min-w-0 flex-1">
                      <div className="product-title">{product.title}</div>
                      <div className="product-price">
                        {linePrice}
                      </div>
                    </div>
                  </div>
                  <div>
                    {showInlineDescription && cartDescription && (
                      <div className="cart-description">{cartDescription}</div>
                    )}
                  </div>
                </Link>
              </div>
              {!hasOnlyDefaultTitle && (
                <div>
                  <CartLineOptionSelectors line={normalizedLine} className="pt-[6px]" />
                </div>
              )}
            </>
          )}
          {/* ✔601px-1023px stock clip OR horizontal print in cart */}
          {windowWidth != undefined && windowWidth > 600 && usesStockLayout && (
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
                  <div className="flex flex-row min-w-0">
                    {usesStockLayout && (
                      <img
                        alt={title}
                        src={image?.url}
                        loading="lazy"
                        className="cart-line-stock-product-img rounded-md"
                      />
                    )}
                    <div className="ps-2 cart-line-text min-w-0 flex-1">
                      <div className='product-title'>{product.title}</div>
                      {showInlineDescription && cartDescription && (
                        <div className="cart-description">
                          {cartDescription}
                        </div>
                      )}
                      <div className='product-price'>
                        {linePrice}
                        </div>
                    </div>
                  </div>
                </Link>
              </div>

              {!hasOnlyDefaultTitle && (
                <div>
                  <CartLineOptionSelectors line={normalizedLine} className="pt-2" />
                </div>
              )}
            </>
          )}
          {/* ✔1024px+ stock clip OR horizontal print in cart */}
          {/* {windowWidth != undefined && windowWidth > 1023 && usesStockLayout && (
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
                  <div className="flex flex-row min-w-0">
                    {usesStockLayout && (
                      <img
                        alt={title}
                        src={image?.url}
                        loading="lazy"
                        className="cart-line-stock-product-img rounded-md"
                      />
                    )}
                    <div className="ps-2 cart-line-text min-w-0 flex-1">
                      <div className='product-title'>{product.title}</div>
                      {showInlineDescription && cartDescription && (
                        <div className="cart-description">
                          {cartDescription}
                        </div>
                      )}
                      <div className='product-price'>
                        {linePrice}
                        </div>
                    </div>
                  </div>
                </Link>
              </div>

              {!hasOnlyDefaultTitle && (
                <div>
                  <CartLineOptionSelectors line={normalizedLine} className="pt-2" />
                </div>
              )}
            </>
          )} */}
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
                    <div className="flex flex-row min-w-0">
                      {isVerticalProduct && (
                        <img
                          alt={title}
                          src={image?.url}
                          loading="lazy"
                          className="cart-line-vertical-product-img rounded-md"
                        />
                      )}
                      <div className="ps-2 cart-line-text min-w-0 flex-1">
                        <div className='product-title'>{product.title}</div>
                        <div className='product-price'>

                        {linePrice}
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>

                {!hasOnlyDefaultTitle && (
                  <div className="pt-1">
                    {showInlineDescription && cartDescription && (
                      <div className="cart-description">{cartDescription}</div>
                    )}
                    <CartLineOptionSelectors line={normalizedLine} />
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
                    <div className="flex flex-row min-w-0">
                      {isVerticalProduct && (
                        <img
                          alt={title}
                          src={image?.url}
                          loading="lazy"
                          className="cart-line-vertical-product-img rounded-md"
                        />
                      )}
                      <div className="ps-2 cart-line-text min-w-0 flex-1">
                        <div className='product-title'>{product.title}</div>
                        {showInlineDescription && cartDescription && (
                          <div className="cart-description">
                            {cartDescription}
                          </div>
                        )}
                        <div className='product-price'>

                        {linePrice}
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>

                {!hasOnlyDefaultTitle && (
                  <div>
                    <CartLineOptionSelectors line={normalizedLine} className="pt-3" />
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
                    <div className="flex flex-row min-w-0">
                      {isVerticalProduct && (
                        <img
                          alt={title}
                          src={image?.url}
                          loading="lazy"
                          className="cart-line-vertical-product-img rounded-md"
                        />
                      )}
                      <div className="ps-3 cart-line-text min-w-0 flex-1">
                        <strong>{product.title}</strong>
                        {showInlineDescription && cartDescription && (
                          <div className="cart-description">
                            {cartDescription}
                          </div>
                        )}
                        {linePrice}
                      </div>
                    </div>
                  </Link>
                </div>

                {!hasOnlyDefaultTitle && (
                  <div>
                    <CartLineOptionSelectors line={normalizedLine} className="pt-3" />
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
                {showInlineDescription && cartDescription && (
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
        <CartLineQuantity
          line={normalizedLine}
          windowWidth={windowWidth}
          showPendingPrintControlLook={Boolean(
            pendingPreview && normalizedLine.isOptimistic,
          )}
          hideQuantityButtons={!!hasPrintTag}
          discountText={lineDiscountText}
          footerDescription={showFooterDescription ? cartDescription : null}
          isMobile={isMobileView}
          isTabletStockLayout={isTabletStockLayout}
          isStockClipLine={isStockClip}
        />
      </CardContent>
    </Card>
  );
}

function CartLineOptionSelectors({
  line,
  className,
}: {
  line: CartLineWithPendingMetadata;
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
  const pendingOptionValuesByName = line.__pendingOptionValuesByName ?? {};

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
          fallbackOptionValuesByName: pendingOptionValuesByName,
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
                className="cart-option-select cursor-pointer rounded-md border border-primary bg-secondary px-2 py-1 text-white text-sm text-start focus:outline-none focus:ring-2 focus:ring-primary/50"
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
  fallbackOptionValuesByName,
}: {
  variants: ProductVariantForSelection[];
  selectedOptions: ProductVariantOption[];
  optionName: string;
  fallbackOptionValuesByName?: Record<string, string[]>;
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

  const fallbackOptionValues = fallbackOptionValuesByName?.[optionName] ?? [];
  for (const fallbackOptionValue of fallbackOptionValues) {
    if (fallbackOptionValue) values.add(fallbackOptionValue);
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
  windowWidth,
  showPendingPrintControlLook,
  hideQuantityButtons,
  discountText,
  footerDescription,
  isMobile,
  isTabletStockLayout,
  isStockClipLine,
}: {
  line: CartLineWithPendingMetadata;
  windowWidth?: number;
  showPendingPrintControlLook: boolean;
  hideQuantityButtons: boolean;
  discountText?: string | null;
  footerDescription?: string | null;
  isMobile: boolean;
  isTabletStockLayout: boolean;
  isStockClipLine: boolean;
}) {
  if (!line || typeof line?.quantity === 'undefined') return null;
  const {id: lineId, quantity, isOptimistic} = line;
  const prevQuantity = Number(Math.max(0, quantity - 1).toFixed(0));
  const nextQuantity = Number((quantity + 1).toFixed(0));
  const hasDiscountText = Boolean(discountText);
  const hasFooterDescription = Boolean(isMobile && footerDescription);
  const usesStockFooterLayout = Boolean(isStockClipLine && !hideQuantityButtons);
  const hasStockInlineDiscount = Boolean(
    usesStockFooterLayout && hasDiscountText,
  );
  const useTabletPrintGrid = Boolean(
    hideQuantityButtons &&
      windowWidth !== undefined &&
      windowWidth > 600,
  );
  const usesStackedQuantityLayout =
    hideQuantityButtons && (isTabletStockLayout || isMobile);
  const hasInlineDiscountWithControls = Boolean(
    hasDiscountText &&
      (hasStockInlineDiscount ||
        useTabletPrintGrid ||
        (isMobile && usesStackedQuantityLayout)),
  );
  const hasInlineMobileDiscount = Boolean(isMobile && hasInlineDiscountWithControls);
  const footerClassName = [
    'cart-line-footer',
    hasDiscountText ? 'has-discount-text' : '',
    hasFooterDescription ? 'has-mobile-description' : '',
    isTabletStockLayout ? 'is-tablet-stock-layout' : '',
    hasInlineMobileDiscount ? 'has-inline-mobile-discount' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const quantityClassName = [
    'cart-line-quantity',
    isTabletStockLayout ? 'is-tablet-stock-layout' : '',
    isStockClipLine ? 'is-stock-clip-line' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const quantityContentClassName = usesStackedQuantityLayout
    ? useTabletPrintGrid
      ? 'cart-line-quantity-tablet-grid'
      : 'cart-line-quantity-stack'
    : 'cart-line-quantity-stack';
  const shouldKeepPrintControlsEnabled =
    showPendingPrintControlLook && hideQuantityButtons;
  const disableControlsForOptimistic = !!isOptimistic && !shouldKeepPrintControlsEnabled;
  const quantityButtonsInner = hideQuantityButtons ? (
    shouldKeepPrintControlsEnabled ? (
      <>
        <Button
          aria-label="Decrease quantity"
          disabled={quantity <= 1}
          name="decrease-quantity"
          value={prevQuantity}
          variant="secondary"
          size="cartpm"
          type="button"
          className="cart-line-qty-button cursor-pointer focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-transparent"
        >
          <span>&#8722; </span>
        </Button>
        <Button
          aria-label="Increase quantity"
          name="increase-quantity"
          value={nextQuantity}
          disabled={false}
          variant="secondary"
          size="cartpm"
          type="button"
          className="cart-line-qty-button cursor-pointer focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-transparent"
        >
          <span>&#43;</span>
        </Button>
      </>
    ) : (
      <>
        <CartLineUpdateButton
          lines={[{id: lineId, quantity: prevQuantity}]}
        >
          <Button
            aria-label="Decrease quantity"
            disabled={quantity <= 1 || disableControlsForOptimistic}
            name="decrease-quantity"
            value={prevQuantity}
            variant="secondary"
            size="cartpm"
            className="cart-line-qty-button cursor-pointer focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-transparent"
          >
            <span>&#8722; </span>
          </Button>
        </CartLineUpdateButton>
        <CartLineUpdateButton
          lines={[{id: lineId, quantity: nextQuantity}]}
        >
          <Button
            aria-label="Increase quantity"
            name="increase-quantity"
            value={nextQuantity}
            disabled={disableControlsForOptimistic}
            variant="secondary"
            size="cartpm"
            className="cart-line-qty-button cursor-pointer focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-transparent"
          >
            <span>&#43;</span>
          </Button>
        </CartLineUpdateButton>
      </>
    )
  ) : null;
  const quantityButtons = quantityButtonsInner ? (
    <div className="cart-line-qty-controls">{quantityButtonsInner}</div>
  ) : null;

  return (
    <div className={footerClassName}>
      {hasFooterDescription ? (
        <div className="cart-description cart-line-footer-description">
          {footerDescription}
        </div>
      ) : null}

      <div className={quantityClassName}>
        <div className={quantityContentClassName}>
          {usesStockFooterLayout ? (
            <>
              <div className="cart-line-quantity-row">
                <div className="cart-subheader cart-line-quantity-label">
                  <span>Quantity:</span>
                  <span className="text-md font-bold cart-quantity">{quantity}</span>
                </div>
                <CartLineRemoveButton
                  lineIds={[lineId]}
                  disabled={disableControlsForOptimistic}
                  visualOnly={shouldKeepPrintControlsEnabled}
                />
                {hasStockInlineDiscount ? (
                  <p className="cart-line-footer-discount cart-line-footer-discount-inline text-primary text-sm">
                    {discountText}
                  </p>
                ) : null}
              </div>
            </>
          ) : useTabletPrintGrid ? (
            <>
              <div className="cart-subheader cart-line-quantity-label">
                <span>Quantity:</span>
                <span className="text-md font-bold cart-quantity">{quantity}</span>
              </div>
              <div className="cart-line-qty-controls cart-line-qty-controls-tablet-grid">
                {quantityButtonsInner}
                <div className="cart-line-remove-wrap">
                  <CartLineRemoveButton
                    lineIds={[lineId]}
                    disabled={disableControlsForOptimistic}
                    visualOnly={shouldKeepPrintControlsEnabled}
                  />
                </div>
                {hasDiscountText ? (
                  <p className="cart-line-footer-discount cart-line-footer-discount-inline cart-line-footer-discount-inline-tablet text-primary text-sm">
                    {discountText}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="cart-subheader cart-line-quantity-label">
                <span>Quantity:</span>
                <span className="text-md font-bold cart-quantity">{quantity}</span>
              </div>
              {usesStackedQuantityLayout ? (
                <div className="cart-line-qty-controls">
                  {quantityButtonsInner}
                  <div className="cart-line-remove-wrap">
                    <CartLineRemoveButton
                      lineIds={[lineId]}
                      disabled={disableControlsForOptimistic}
                      visualOnly={shouldKeepPrintControlsEnabled}
                    />
                  </div>
                  {hasInlineMobileDiscount ? (
                    <p className="cart-line-footer-discount cart-line-footer-discount-inline text-primary text-sm">
                      {discountText}
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  {quantityButtons}
                  <CartLineRemoveButton
                    lineIds={[lineId]}
                    disabled={disableControlsForOptimistic}
                    visualOnly={shouldKeepPrintControlsEnabled}
                  />
                  {hasInlineDiscountWithControls ? (
                    <p className="cart-line-footer-discount cart-line-footer-discount-inline text-primary text-sm">
                      {discountText}
                    </p>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {hasDiscountText && !hasInlineDiscountWithControls ? (
        <p className="cart-line-footer-discount text-primary text-sm">{discountText}</p>
      ) : null}
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
  visualOnly = false,
}: {
  lineIds: string[];
  disabled: boolean;
  visualOnly?: boolean;
}) {
  const [windowWidth, setWindowWidth] = useState<number | undefined>(() =>
    typeof window !== 'undefined' ? window.innerWidth : undefined,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  if (visualOnly) {
    return (
      <>
        {windowWidth != null && windowWidth <= 600 && (
          <Button
            disabled={false}
            type="button"
            variant="secondary"
            className="remove-button cart-line-remove-button cursor-pointer px-1.5 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-transparent"
            size="sm"
          >
            <p className="remove-button-text">Remove</p>
          </Button>
        )}
        {windowWidth != null && windowWidth > 600 && (
          <Button
            disabled={false}
            type="button"
            variant="secondary"
            className="remove-button cart-line-remove-button cursor-pointer px-1.5 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-transparent"
            size="cartbtn"
          >
            <p className="remove-button-text">Remove</p>
          </Button>
        )}
      </>
    );
  }
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
          variant="secondary"
          className="remove-button cart-line-remove-button cursor-pointer px-1.5 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-transparent"
          size="sm"
        >
          <p className="remove-button-text">Remove</p>
        </Button>
      )}
      {windowWidth != null && windowWidth > 600 && (
        <Button
          disabled={disabled}
          type="submit"
          variant="secondary"
          className="remove-button cart-line-remove-button cursor-pointer px-1.5 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-transparent"
          size="cartbtn"
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
