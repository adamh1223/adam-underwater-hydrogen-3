import React, {useEffect, useState} from 'react';
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
import '../../styles/routeStyles/product.css';

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
  cart?: Promise<CartReturn | null>;
}) {
  const cardClassName =
    layout === 'grid'
      ? 'group-hover:shadow-xl transition-shadow duration-500 h-full'
      : 'transform group-hover:shadow-xl transition-shadow duration-500 mx-8 h-full';

  const cardContentClassName =
    layout === 'grid'
      ? 'flex flex-col h-full p-4'
      : 'ps-3 pt-3 pb-3 gap-y-4 list-view-large-row h-full';
  const variantUrl = useVariantUrl(product.handle);
  console.log(product, '204020');
  const {open} = useAside();
  const disableButton = useIsVideoInCart(
    product?.selectedOrFirstAvailableVariant?.id,
    cart,
  );
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {/* {EProducts?.map((product) => { */}
      {/* const {name, price, WMVideoLink, downloadLink, thumbnail} = product;

          const productId = product.id;
          const dollarsAmount = formatCurrency(price);
          return ( */}
      <article className="group relative mb-5">
        <Card className={cardClassName}>
          <div className={cardContentClassName}>
            <div
              className={`relative h-full evideo ${layout === 'grid' ? 'top-part-card-grid' : 'top-part-card-list'}`}
            >
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
            <div
              className={
                layout === 'grid'
                  ? `bottom-part-card-grid`
                  : `bottom-part-card-list`
              }
            >
              <div className="bottom-part-card-inside mx-5">
                <div
                  className={`product-title-container ${layout === 'grid' ? 'text-center' : 'text-start'}`}
                >
                  <Link
                    className="product-item"
                    key={product.id}
                    prefetch="intent"
                    to={variantUrl}
                  >
                    <h2
                      className={`${layout === 'grid' ? 'product-title-font-grid' : 'product-title-font-list'}`}
                    >
                      {product.title}
                    </h2>
                  </Link>
                </div>
                {product?.priceRange?.minVariantPrice && (
                  <div
                    className={`flex ${layout === 'grid' ? 'justify-center' : 'justify-start'}`}
                  >
                    <Link
                      className="product-item"
                      key={product.id}
                      prefetch="intent"
                      to={variantUrl}
                    >
                      <span
                        className={`${layout === 'grid' ? 'product-price-font-grid' : 'product-price-font-list'} flex flex-row gap-2`}
                      >
                        From
                        <Money data={product?.priceRange?.minVariantPrice} />
                      </span>
                    </Link>
                  </div>
                )}
                {layout !== 'grid' &&
                  (product as any).descriptionHtml &&
                  windowWidth != undefined &&
                  windowWidth > 786 && (
                    <>
                      <div>
                        <Link
                          className="product-item"
                          key={product.id}
                          prefetch="intent"
                          to={variantUrl}
                        >
                          <Card className="description-html-card-list ">
                            <div
                              className="p-3"
                              dangerouslySetInnerHTML={{
                                __html: (product as any).descriptionHtml,
                              }}
                            />
                          </Card>
                        </Link>
                      </div>
                    </>
                  )}
                {product?.selectedOrFirstAvailableVariant?.id && (
                  <div
                    className={`flex  product-add-to-cart-container ${layout === 'grid' ? 'justify-center' : 'justify-start'}`}
                  >
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
            </div>
          </div>
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
