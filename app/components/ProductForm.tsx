import {Link, useNavigate} from '@remix-run/react';
import {type MappedProductOptions} from '@shopify/hydrogen';
import type {
  Maybe,
  ProductOptionValueSwatch,
} from '@shopify/hydrogen/storefront-api-types';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import type {ProductFragment} from 'storefrontapi.generated';
import {sanitizeErrors} from '@remix-run/server-runtime/dist/errors';

interface ProductImages {
  id: string;
  image: {
    url: string;
    altText: string;
  };
}
export function ProductForm({
  productOptions,
  selectedVariant,
  imagesToShow,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  imagesToShow: ProductImages[];
}) {
  const navigate = useNavigate();
  const {open} = useAside();

  return (
    <div className="product-form">
      {productOptions.map((option) => {
        // If there is only a single value in the option values, don't display the option
        if (option.optionValues.length === 1) return null;

        return (
          <div className="product-options" key={option.name}>
            <h5>{option.name}</h5>
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
                  if (name === 'three columns') {
                    return '3';
                  }
                  return '';
                };
                const layoutToCheck = determineLayout(name);
                const variantImagesToShow = imagesToShow?.filter((image) =>
                  image?.image.altText?.includes(layoutToCheck),
                );
                console.log(variantImagesToShow, '181818');

                if (isDifferentProduct) {
                  // SEO
                  // When the variant is a combined listing child product
                  // that leads to a different url, we need to render it
                  // as an anchor tag
                  return (
                    <>
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
                    </>
                  );
                } else {
                  // SEO
                  // When the variant is an update to the search param,
                  // render it as a button with javascript navigating to
                  // the variant so that SEO bots do not index these as
                  // duplicated links
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
      <AddToCartButton
        disabled={!selectedVariant || !selectedVariant.availableForSale}
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
        {selectedVariant?.availableForSale ? 'Add to cart' : 'Sold out'}
      </AddToCartButton>
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
  variantImagesToShow?: ProductImages[];
}) {
  const sizes = ['Small', 'Medium', 'Large'];
  // Add sizes here in future
  const image = swatch?.image?.previewImage?.url;
  const color = swatch?.color;

  if (variantImagesToShow && sizes.includes(name)) {
    const specificSize = variantImagesToShow.find((image) =>
      image.image.altText.includes(name.toLowerCase()),
    );
    return (
      <div
        aria-label={name}
        className="product-option-label-swatch"
        style={{
          backgroundColor: color || 'transparent',
        }}
      >
        <img
          src={specificSize?.image?.url}
          alt={specificSize?.image?.altText}
        />
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
