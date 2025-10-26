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
            console.log(response?.products, 'ps');
            const productsToUse = isVideo
              ? filteredVideoProducts
              : filteredPrintProducts;

            const productsBesidesCurrent = productsToUse?.filter(
              (product) => product.id != currentProductID,
            );
            console.log(productsToUse, 'productstouse');

            const products = productsBesidesCurrent?.map((product) => {
              console.log(product.images.nodes, 'prodimgnodes');
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

            console.log(products, '555');

            return (
              <div className="recommended-products-grid gap-x-5 gap-y-5">
                {response ? (
                  <>
                    {!isVideo && <ThreeUpCarousel products={products} />}
                    {isVideo && <ThreeUpEProductCarousel products={products} />}
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
