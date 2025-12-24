import {Await} from '@remix-run/react';
import {Suspense} from 'react';
import {RecommendedProductsQuery} from 'storefrontapi.generated';
import ProductCarousel from './productCarousel';
import {ThreeUpEProductCarousel} from '../global/ThreeUpEProductCarousel';
import {ThreeUpCarousel} from '../global/ThreeUpCarousel';

function SimpleRecommendedProducts({
  products,
  isVideo,
  currentProductID,
}: {
  products: Promise<RecommendedProductsQuery | null>;
  isVideo: Boolean;
  currentProductID: String;
}) {
  return (
    <div className="recommended-products">
      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={products}>
          {(response) => {
            const filteredVideoProducts = response?.products.nodes.filter(
              (product) =>
                product.tags.includes('Video') &&
                product.images.nodes[0].url.includes('youmayalsolike'),
            );

            const filteredPrintProducts = response?.products.nodes.filter(
              (product) =>
                !product.tags.includes('Video') &&
                product.images.nodes[0].url.includes('youmayalsolike'),
            );
            
            const productsToUse = isVideo
              ? filteredVideoProducts
              : filteredPrintProducts;

            const productsBesidesCurrent = productsToUse?.filter(
              (product) => product.id != currentProductID,
            );
            

            const products = productsBesidesCurrent?.map((product) => {
              
              const productID = product.id;
              const productName = product.handle;
              const imageFound = product.images.nodes.filter((image) => {
                return image.url.includes('outer-carousel-main-youmayalsolike');
              });
              const imageURL = imageFound[0]?.url;
              const productTitle = product.title;

              return {
                id: productID,
                handle: productName,
                imageURL,
                title: productTitle,
              };
            });

            

            return (
              <div className="recommended-products-grid-simple gap-x-5 gap-y-5">
                {response ? (
                  <>
                    {!isVideo && <ThreeUpCarousel products={products} />}
                    {isVideo && <ThreeUpEProductCarousel products={products} />}
                  </> 
                ) : 

                
                null}
              </div>
            );
          }}
        </Await>
      </Suspense>
      <br />
    </div>
  );
}

export default SimpleRecommendedProducts;
