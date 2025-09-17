import React from 'react';
import {Card, CardContent} from '../ui/card';
import {AddToCartButton} from '../AddToCartButton';
import {ProductItemFragment} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';
import EProductPreview from './EProductPreview';
import {Money} from '@shopify/hydrogen';
import {Link} from '@remix-run/react';
import {useAside} from '../Aside';
import {useIsVideoInCart} from '~/lib/hooks';
import {CartReturn} from '@shopify/hydrogen';

type shopifyImage = {url: string; altText: string};
function EProductsContainer({
  product,
  loading,
  layout,
  cart,
}: {
  product: ProductItemFragment & {images: {nodes: shopifyImage[]}} & {
    selectedOrFirstAvailableVariant?: {id: string};
  };
  loading?: 'eager' | 'lazy';
  layout: string | undefined;
  cart: Promise<CartReturn | null>;
}) {
  const cardClassName =
    layout === 'grid'
      ? 'group-hover:shadow-xl transition-shadow duration-500 h-full'
      : 'transform group-hover:shadow-xl transition-shadow duration-500 mx-8 h-full';

  const cardContentClassName =
    layout === 'grid'
      ? 'flex flex-col h-full'
      : 'p-3 md:p-6 gap-y-4 grid grid-cols-2 lg:grid-cols-3 h-full';
  const variantUrl = useVariantUrl(product.handle);
  console.log(product, '204020');
  const {open} = useAside();
  const disableButton = useIsVideoInCart(
    cart,
    product?.selectedOrFirstAvailableVariant?.id,
  );

  return (
    <>
      {/* {EProducts?.map((product) => { */}
      {/* const {name, price, WMVideoLink, downloadLink, thumbnail} = product;

          const productId = product.id;
          const dollarsAmount = formatCurrency(price);
          return ( */}
      <article className="group relative mb-5">
        <Card className={cardClassName}>
          <CardContent className={cardContentClassName}>
            <div className="relative h-full evideo top-part-card">
              {/* {thumbnail && (
                      <img
                        src={thumbnail}
                        alt="hi"
                        className="flex items-center justify-center rounded w-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                      />
                    )} */}
              <Link
                className="product-item"
                key={product.id}
                prefetch="intent"
                to={variantUrl}
              >
                <EProductPreview EProduct={product} />
              </Link>
            </div>
            {/* <div className="mt-4 text-center">
                <h2 className="text-lg capitalize">{name}</h2>
                <p className="text-muted-foreground mt-2">{dollarsAmount}</p>
                <AddToCartButton
                  productId={productId}
                  isEProduct
                  RedirectTo={`/stock`}
                />
              </div> */}
            <div>
              <div className="mt-4 text-center">
                <h2 className="text-lg">{product.title}</h2>
              </div>
              {product?.priceRange?.minVariantPrice && (
                <div className="flex justify-center">
                  <span className="text-md flex flex-row gap-2">
                    From
                    <Money data={product?.priceRange?.minVariantPrice} />
                  </span>
                </div>
              )}
              {product?.selectedOrFirstAvailableVariant?.id && (
                <div className="flex justify-center pt-5 pb-4">
                  <AddToCartButton
                    lines={[
                      {
                        merchandiseId:
                          product?.selectedOrFirstAvailableVariant?.id,
                        quantity: 1,
                      },
                    ]}
                    disabled={disableButton}
                    onClick={() => {
                      open('cart');
                    }}
                  >
                    Add To Cart
                  </AddToCartButton>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        {/* <div className="absolute top-5 right-2 z-5">
                <FavoriteToggleButton EProductId={productId} productId={null} />
              </div> */}
      </article>
      {/* ); */}
      {/* })} */}
    </>
  );
}

export default EProductsContainer;
