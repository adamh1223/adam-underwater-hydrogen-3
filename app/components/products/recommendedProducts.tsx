import {Await} from '@remix-run/react';
import {Suspense} from 'react';
import {RecommendedProductsQuery} from 'storefrontapi.generated';
import ProductCarousel from './productCarousel';

function RecommendedProducts({
  products,
}: {
  products: Promise<RecommendedProductsQuery | null>;
}) {
  return (
    <div className="recommended-products">
      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={products}>
          {(response) => (
            <div className="recommended-products-grid gap-x-5 gap-y-5">
              {response
                ? response.products.nodes.map((product) => {
                    console.log(product, '111111');
                    const isVideo = product.tags?.includes('Video');
                    const isRecommendedProduct =
                      product.tags?.includes('recommended');
                    return (
                      <>
                        {!isVideo && isRecommendedProduct && (
                          <ProductCarousel
                            product={product}
                            layout="grid"
                            key={product.id}
                          />
                        )}
                      </>
                    );
                  })
                : null}
            </div>
          )}
        </Await>
      </Suspense>
      <br />
    </div>
  );
}

export default RecommendedProducts;
