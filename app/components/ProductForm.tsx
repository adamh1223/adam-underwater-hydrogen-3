import {Link, useNavigate} from '@remix-run/react';
import {
  getAdjacentAndFirstAvailableVariants,
  type CartReturn,
  type MappedProductOptions,
} from '@shopify/hydrogen';
import type {
  Maybe,
  ProductOptionValueSwatch,
} from '@shopify/hydrogen/storefront-api-types';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import type {ProductFragment} from 'storefrontapi.generated';
import {ProductImages, SimpleProductImages} from '~/lib/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import {Card} from '~/components/ui/card';
import {useEffect, useMemo, useState} from 'react';
import {cn} from '~/lib/utils';
import type {CartPendingLinePreviewPayload} from '~/lib/cartPendingLine';

const selectedVariantHighlightClass =
  'border-primary shadow-[0_0_0_1px_hsl(var(--primary)),0_0_0_2px_hsl(var(--primary)/0.62),0_0_28px_hsl(var(--primary)/0.5)]';
const hoveredVariantHighlightClass =
  'hover:border-[hsl(var(--primary)/0.75)] hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.75),0_0_0_2px_hsl(var(--primary)/0.38),0_0_14px_hsl(var(--primary)/0.3)]';
const variantOptionBaseClass =
  'product-options-item border transition-[border-color,box-shadow] duration-300 focus-visible:border-primary focus-visible:shadow-[0_0_0_1px_hsl(var(--primary)),0_0_0_2px_hsl(var(--primary)/0.62),0_0_28px_hsl(var(--primary)/0.5)]';
const VARIANT_SPLASH_DURATION_MS = 700;

export function ProductForm({
  cart,
  productId,
  productOptions,
  selectedVariant,
  imagesToShow,
  VideoAlreadyInCart,
  isVideo,
  isPrint,
  isVideoBundle,
}: {
  cart?: Promise<CartReturn | null>;
  productId: string;
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  imagesToShow?: SimpleProductImages[];
  VideoAlreadyInCart: boolean;
  isVideo: boolean;
  isPrint: boolean;
  isVideoBundle: boolean;
}) {
  const navigate = useNavigate();
  const {open} = useAside();
  const [activeSplashKey, setActiveSplashKey] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSplashKey) return;
    const timeoutId = window.setTimeout(() => {
      setActiveSplashKey(null);
    }, VARIANT_SPLASH_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [activeSplashKey]);

  // ✅ Format price safely
  const formattedPrice = selectedVariant?.price?.amount
    ? parseFloat(selectedVariant.price.amount).toFixed(2)
    : null;
  const formattedCompareAtPrice = selectedVariant?.compareAtPrice?.amount
    ? parseFloat(selectedVariant.compareAtPrice.amount).toFixed(2)
    : null;
  const formattedPriceLabel = formattedPrice != null ? `$${formattedPrice}` : null;
  const formattedCompareAtPriceLabel =
    formattedCompareAtPrice != null ? `$${formattedCompareAtPrice}` : null;
  const showSelectedVariantTitle = Boolean(
    selectedVariant?.title && selectedVariant.title !== 'Default Title',
  );
  const hasResolutionOption = productOptions.some(
    (option) =>
      option.optionValues.length > 1 &&
      option.name.trim().toLowerCase() === 'resolution',
  );
  const selectedVariantOptions =
    selectedVariant?.selectedOptions
      ?.filter((option) => option.value !== 'Default Title')
      .map((option) => ({
        name: option.name,
        value: option.value,
      })) ?? [];
  const optionValuesByName = productOptions.reduce<Record<string, string[]>>(
    (optionMap, option) => {
      const optionValues = Array.from(
        new Set(
          option.optionValues
            .map((optionValue) => optionValue.name)
            .filter((optionValueName): optionValueName is string =>
              Boolean(optionValueName),
            ),
        ),
      );

      if (optionValues.length) {
        optionMap[option.name] = optionValues;
      }

      return optionMap;
    },
    {},
  );
  const orientationValue =
    selectedVariantOptions.find(
      (option) => option.name.toLowerCase() === 'orientation',
    )?.value ?? '';
  const isVerticalPreview =
    orientationValue.toLowerCase() === 'vertical' ||
    orientationValue.toLowerCase() === 'portrait';
  const productTypeLabel = isPrint
    ? 'Framed Canvas Print'
    : isVideoBundle
      ? 'Stock Footage Bundle'
      : 'Stock Footage Video';
  const pendingProductTags = isPrint
    ? ['Prints']
    : isVideoBundle
      ? ['Video', 'Bundle']
      : ['Video'];
  const previewImageUrl =
    selectedVariant?.image?.url ?? imagesToShow?.[0]?.url ?? null;
  const pendingLinePreview: CartPendingLinePreviewPayload | null =
    selectedVariant?.id
      ? {
          merchandiseId: selectedVariant.id,
          productId,
          productHandle: selectedVariant?.product?.handle,
          productTitle: selectedVariant?.product?.title ?? '',
          productTags: pendingProductTags,
          variantTitle: selectedVariant?.title ?? undefined,
          optionValuesByName,
          productTypeLabel,
          imageUrl: previewImageUrl,
          priceLabel: formattedPriceLabel,
          priceAmount: selectedVariant?.price?.amount ?? null,
          priceCurrencyCode: selectedVariant?.price?.currencyCode ?? null,
          compareAtPriceLabel: formattedCompareAtPriceLabel,
          compareAtAmount: selectedVariant?.compareAtPrice?.amount ?? null,
          selectedOptions: selectedVariantOptions,
          showQuantityButtons: isPrint,
          isVerticalImage: isVerticalPreview,
        }
      : null;
  const addToCartLines = selectedVariant
    ? [
        {
          merchandiseId: selectedVariant.id,
          quantity: 1,
          selectedVariant,
          __productId: productId,
          __isVideo: isVideo,
          __preview: pendingLinePreview,
        },
      ]
    : [];

  // ✅ Function to add business days
  const addBusinessDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const day = result.getDay();
      // Skip weekends (0=Sun, 6=Sat)
      if (day !== 0 && day !== 6) added++;
    }
    return result;
  };

  // ✅ Compute expected delivery date (7 business days from now)
  const expectedDelivery = useMemo(() => {
    const today = new Date();
    const deliveryDate = addBusinessDays(today, 7);

    return deliveryDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  const addToCartButton = (
    <AddToCartButton
      cart={cart}
      disabled={
        !selectedVariant ||
        !selectedVariant.availableForSale ||
        VideoAlreadyInCart
      }
      onClick={() => {
        open('cart', 'product-form-add-to-cart');
      }}
      lines={addToCartLines}
      replaceExistingLineProductId={isVideo ? productId : undefined}
    >
      <div className="add-to-cart-btn-content">
        <div className="add-to-cart-btn-product-name">
          {selectedVariant?.product?.title}
        </div>
        <div className="add-to-cart-btn-variant">
          {showSelectedVariantTitle ? selectedVariant?.title : ''}
        </div>
        {selectedVariant?.availableForSale ? (
          <div className="add-to-cart-btn-text">
            Add to cart: {formattedPriceLabel} &nbsp;
            {formattedCompareAtPriceLabel != null && (
              <span className="add-to-cart-btn-compare-at-price">
                {formattedCompareAtPriceLabel}
              </span>
            )}
          </div>
        ) : (
          'Sold out'
        )}
      </div>
    </AddToCartButton>
  );

  return (
    <div
      className={`product-form${
        hasResolutionOption ? ' product-form-has-inline-cart' : ''
      }`}
    >
      {productOptions.map((option) => {
        if (option.optionValues.length === 1) return null;
        const isResolutionOption =
          option.name.trim().toLowerCase() === 'resolution';
        const shouldInlineAddToCart = isResolutionOption && hasResolutionOption;

        return (
          <div
            className={`product-options${
              shouldInlineAddToCart ? ' product-options-inline-cart' : ''
            }`}
            key={option.name}
          >
            <div
              className={
                shouldInlineAddToCart ? 'product-options-inline-selector' : ''
              }
            >
              <p
                className={cn(
                  'product-options-label',
                  shouldInlineAddToCart ? 'mb-0' : 'mb-2',
                )}
              >
                <strong>{option.name}:</strong>
              </p>
              <div className="product-options-grid">
                {option.optionValues.map((value) => {
                  const {
                    name,
                    handle,
                    variantUriQuery,
                    selected,
                    available,
                    exists,
                    isDifferentProduct,
                    swatch,
                  } = value;
                  const isSizeOption =
                    option.name.trim().toLowerCase() === 'size';
                  const variantImagesToShow = isSizeOption
                    ? imagesToShow
                    : undefined;
                  const hasVisualSwatch = Boolean(
                    swatch?.image?.previewImage?.url ||
                      swatch?.color ||
                      (isSizeOption && (variantImagesToShow?.length ?? 0) > 0),
                  );
                  const optionSelectionKey = `${option.name}:${name}`;
                  const shouldApplySplash =
                    selected && activeSplashKey === optionSelectionKey;

                  if (isDifferentProduct) {
                    return (
                      <Link
                        className={cn(
                          variantOptionBaseClass,
                          hasVisualSwatch && 'product-options-item--swatch',
                          !selected && hoveredVariantHighlightClass,
                          selected
                            ? selectedVariantHighlightClass
                            : 'border-transparent',
                          shouldApplySplash && 'variant-option-selected-splash',
                        )}
                        key={option.name + name}
                        prefetch={isPrint ? 'render' : 'intent'}
                        preventScrollReset
                        replace
                        to={`/products/${handle}?${variantUriQuery}`}
                        onClick={() => {
                          if (!selected) {
                            setActiveSplashKey(optionSelectionKey);
                          }
                        }}
                        style={{
                          opacity: available ? 1 : 0.3,
                        }}
                      >
                        <ProductOptionSwatch
                          swatch={swatch}
                          name={name}
                          variantImagesToShow={variantImagesToShow}
                        />
                      </Link>
                    );
                  } else {
                    return (
                      <button
                        type="button"
                        className={cn(
                          variantOptionBaseClass,
                          hasVisualSwatch && 'product-options-item--swatch',
                          exists && !selected && 'link',
                          !selected && hoveredVariantHighlightClass,
                          selected
                            ? selectedVariantHighlightClass
                            : 'border-transparent',
                          shouldApplySplash && 'variant-option-selected-splash',
                        )}
                        key={option.name + name}
                        style={{
                          opacity: available ? 1 : 0.3,
                        }}
                        disabled={!exists}
                        onClick={() => {
                          if (!selected) {
                            setActiveSplashKey(optionSelectionKey);
                            navigate(`?${variantUriQuery}`, {
                              replace: true,
                              preventScrollReset: true,
                            });
                          }
                        }}
                      >
                        <ProductOptionSwatch
                          swatch={swatch}
                          name={name}
                          variantImagesToShow={variantImagesToShow}
                        />
                      </button>
                    );
                  }
                })}
              </div>
            </div>
            {shouldInlineAddToCart && (
              <div
                className={`product-options-inline-cart-cta ${
                  isPrint ? 'individual-a-t-c-print' : 'individual-a-t-c'
                }`}
              >
                {addToCartButton}
              </div>
            )}
          </div>
        );
      })}

      {isPrint && (
        <>
          <hr />
          <div className="grid grid-cols-1 framing-info">
            <h3 className="text-center font-bold mb-1">
              Framing Service - FREE
            </h3>
            <p className="text-center">
              All prints come professionally stretched over a 1.5&quot; thick wooden
              frame
            </p>
          </div>
          {!hasResolutionOption && (
            <div className="flex individual-a-t-c-print">{addToCartButton}</div>
          )}
        </>
      )}

      {!isPrint &&
        !hasResolutionOption && (
          <div className="flex individual-a-t-c py-3">{addToCartButton}</div>
        )}

      {isPrint && (
        <div className="flex justify-center py-2 expected-delivery">
          Expected Delivery: &nbsp;
          <strong>{expectedDelivery}</strong>
        </div>
      )}
    </div>
  );
}

function ProductOptionSwatch({
  swatch,
  name,
  variantImagesToShow,
}: {
  swatch?: Maybe<ProductOptionValueSwatch> | undefined;
  name: string;
  variantImagesToShow?: SimpleProductImages[];
}) {
  const sizes = ['Small', 'Medium', 'Large', 'XL (Pickup Only)'];
  const image = swatch?.image?.previewImage?.url;
  const color = swatch?.color;

  if (variantImagesToShow && sizes.includes(name)) {
    const sizeNameToCheck = name?.split(' ');
    const specificSize = variantImagesToShow.find((image) =>
      image?.altText.includes(sizeNameToCheck[0].toLowerCase()),
    );

    return (
      <div
        aria-label={name}
        className="product-option-label-swatch"
        style={{
          backgroundColor: color || 'transparent',
        }}
      >
        <img src={specificSize?.url} alt={specificSize?.altText} />
      </div>
    );
  }

  if (!image && !color) return name;

  return (
    <div
      aria-label={name}
      className="product-option-label-swatch"
      style={{
        backgroundColor: color || 'transparent',
      }}
    >
      {!!image && <img src={image} alt={name} />}
    </div>
  );
}
