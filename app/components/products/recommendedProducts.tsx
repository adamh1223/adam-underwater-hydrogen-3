import {Await} from '@remix-run/react';
import {Suspense} from 'react';
import {RecommendedProductsQuery} from 'storefrontapi.generated';
import ProductCarousel from './productCarousel';
import {Separator} from '../ui/separator';

function RecommendedProducts({
  products,
  wishlistProducts,
  isLoggedIn,
}: {
  products: Promise<RecommendedProductsQuery | null>;
  wishlistProducts: string[];
  isLoggedIn: Promise<boolean> | undefined;
}) {
  return (
    <>
      <Separator />
      <div className="recommended-products">
        <Suspense fallback={<div>Loading...</div>}>
          <Await resolve={products}>
            {(response) => (
              <div className="recommended-products-grid gap-x-5 gap-y-5">
                {response
                  ? response.products.nodes.map((product) => {
                      const isVideo = product.tags?.includes('Video');
                      const isRecommendedProduct =
                        product.tags?.includes('recommended');
                      const isInWishlist = wishlistProducts?.includes(
                        product.id,
                      );

                      if (isVideo || !isRecommendedProduct) {
                        return null;
                      }

                      return (
                        <ProductCarousel
                          product={product}
                          layout="grid"
                          key={product.id}
                          isInWishlist={isInWishlist}
                          isLoggedIn={isLoggedIn}
                        />
                      );
                    })
                  : null}
              </div>
            )}
          </Await>
        </Suspense>
        <br />
      </div>
    </>
  );
}

export default RecommendedProducts;
