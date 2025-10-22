import {Await} from '@remix-run/react';
import {Suspense} from 'react';
import {RecommendedProductsQuery} from 'storefrontapi.generated';
import ProductCarousel from './productCarousel';
import {ThreeUpEProductCarousel} from '../global/ThreeUpEProductCarousel';
import {ThreeUpCarousel} from '../global/ThreeUpCarousel';

function SimpleRecommendedProducts({
  products,
  isVideo,
}: {
  products: Promise<RecommendedProductsQuery | null>;
  isVideo: Boolean;
}) {
  return (
    <div className="recommended-products">
      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={products}>
          {(response) => {
            const filteredVideoProducts = response?.products.nodes.filter(
              (product) => product.tags.includes('Video'),
            );
            const filteredPrintProducts = response?.products.nodes.filter(
              (product) => !product.tags.includes('Video'),
            );
            const productsToUse = isVideo
              ? filteredVideoProducts
              : filteredPrintProducts;

            console.log(isVideo, 'isvideo');

            const images = productsToUse?.map((product) => {
              console.log(product.images.nodes, 'prodimgnodes');

              const imageFound = product.images.nodes.filter((image) => {
                return image.url.includes('outer-carousel-main-youmayalsolike');
              });
              console.log(imageFound, 'imgfound2');

              return imageFound[0]?.url;
            });
            console.log(images, 'images2');

            return (
              <div className="recommended-products-grid gap-x-5 gap-y-5">
                {response ? (
                  <>
                    {!isVideo && <ThreeUpCarousel images={images} />}
                    {isVideo && <ThreeUpEProductCarousel images={images} />}
                  </> //     const images = products.nodes.filter((image: any) =>
                ) : //       image.url.includes('outer-carousel-main'),
                //     );

                //     const imageURL = product.images.nodes.filter((image: any) =>
                //       image.url.includes('outer-carousel-main'),
                //     );
                //     console.log(imageURL, 'imgurl');

                //     return (
                //       <>
                //         <img src={imageURL[0]?.url} />
                //       </>
                //     );
                //   })
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
