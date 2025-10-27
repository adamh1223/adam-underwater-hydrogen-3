import {Link, useNavigate} from '@remix-run/react';
import {
  getAdjacentAndFirstAvailableVariants,
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

export function ProductForm({
  productOptions,
  selectedVariant,
  imagesToShow,
  VideoAlreadyInCart,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  imagesToShow?: SimpleProductImages[];
  VideoAlreadyInCart: boolean;
}) {
  const navigate = useNavigate();
  const {open} = useAside();

  // ✅ Format price to 2 decimals safely
  const formattedPrice = selectedVariant?.price?.amount
    ? parseFloat(selectedVariant.price.amount).toFixed(2)
    : null;
  const formattedCompareAtPrice = selectedVariant?.compareAtPrice?.amount
    ? parseFloat(selectedVariant.compareAtPrice.amount).toFixed(2)
    : null;
  console.log(formattedCompareAtPrice, 'fmt');

  return (
    <div className="product-form">
      {productOptions.map((option) => {
        if (option.optionValues.length === 1) return null;

        return (
          <div className="product-options" key={option.name}>
            <p className="mb-3">
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

                const determineLayout = (name: string) => {
                  if (name === 'three columns') return '3';
                  if (name === 'two columns') return '2';
                  return '';
                };

                const layoutToCheck = determineLayout(name);
                const variantImagesToShow = imagesToShow?.filter((image) =>
                  image?.url?.includes(layoutToCheck),
                );

                if (isDifferentProduct) {
                  return (
                    <Link
                      className="product-options-item"
                      key={option.name + name}
                      prefetch="intent"
                      preventScrollReset
                      replace
                      to={`/products/${handle}?${variantUriQuery}`}
                      style={{
                        border: selected
                          ? '1px solid black'
                          : '1px solid transparent',
                        opacity: available ? 1 : 0.3,
                      }}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} />
                    </Link>
                  );
                } else {
                  return (
                    <button
                      type="button"
                      className={`product-options-item${
                        exists && !selected ? ' link' : ''
                      }`}
                      key={option.name + name}
                      style={{
                        border: selected
                          ? '1px solid #0EA5E9'
                          : '1px solid transparent',
                        opacity: available ? 1 : 0.3,
                      }}
                      disabled={!exists}
                      onClick={() => {
                        if (!selected) {
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
            <br />
          </div>
        );
      })}

      {productOptions?.length > 1 && (
        <>
          <hr />
          <div className="grid grid-cols-1 framing-info">
            <h3 className="text-center font-bold mb-1">
              Framing Service - FREE
            </h3>
            <p className="text-center">
              All prints come professionally stretched over a wooden frame
            </p>
          </div>
        </>
      )}

      <div className="flex justify-center p-3">
        <AddToCartButton
          disabled={
            !selectedVariant ||
            !selectedVariant.availableForSale ||
            VideoAlreadyInCart
          }
          onClick={() => {
            open('cart');
          }}
          lines={
            selectedVariant
              ? [
                  {
                    merchandiseId: selectedVariant.id,
                    quantity: 1,
                    selectedVariant,
                  },
                ]
              : []
          }
        >
          <div>
            <div className="add-to-cart-btn-product-name">
              {selectedVariant?.product?.title}
            </div>
            <div className="add-to-cart-btn-variant">
              {productOptions?.length > 1 && selectedVariant?.title}
            </div>
            {selectedVariant?.availableForSale ? (
              <div className="add-to-cart-btn-text">
                Add to cart: ${formattedPrice} &nbsp;
                {formattedCompareAtPrice != null && (
                  <span className="add-to-cart-btn-compare-at-price">
                    ${formattedCompareAtPrice}
                  </span>
                )}
              </div>
            ) : (
              'Sold out'
            )}
          </div>
        </AddToCartButton>
      </div>

      <br />
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
