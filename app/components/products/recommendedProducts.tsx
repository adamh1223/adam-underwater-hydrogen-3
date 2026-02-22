import {Await} from '@remix-run/react';
import {Suspense, useEffect, useState} from 'react';
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
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const gridColumnCount =
    windowWidth != undefined
      ? Math.max(1, Math.floor((windowWidth - 1) / 700) + 1)
      : 1;
  const productsContainerStyle = {
    gridTemplateColumns: `repeat(${gridColumnCount}, minmax(0, 1fr))`,
  };

  return (
    <>
      <Separator />
      <div className="recommended-products">
        <Suspense fallback={<div>Loading...</div>}>
          <Await resolve={products}>
            {(response) => (
              <div
                className="recommended-products-grid"
                style={productsContainerStyle}
              >
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
