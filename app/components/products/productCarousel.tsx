import React, {useEffect, useState} from 'react';
import {Card, CardAction, CardContent} from '../ui/card';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from '../ui/carousel';
import {Link, useLoaderData} from '@remix-run/react';
import {Button} from '../ui/button';
import {ChevronLeftIcon, ChevronRightIcon} from 'lucide-react';
import {Money, useOptimisticVariant} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';
import {CollectionQuery, ProductItemFragment} from 'storefrontapi.generated';
import {AddToCartButton} from '../AddToCartButton';
import {PartialPredictiveSearchResult} from '../SearchResultsPredictive';
import {CurrencyCode, Scalars} from '@shopify/hydrogen/storefront-api-types';

type shopifyImage = {url: string; altText: string};
type collectionProductImages = {images?: {nodes: shopifyImage[]}};
type collectionProduct = ProductItemFragment & collectionProductImages & CollectionQuery;
interface AugmentedPartialPredictive {
  handle?: string;
  title?: string;
  
  priceRange?: {
    minVariantPrice: {
      amount: string;
      currencyCode: CurrencyCode;
    };
  };
  id?: string;
}
type expandedPartialPredictive = AugmentedPartialPredictive &
  collectionProductImages;
type collectionPageProduct =
  | collectionProduct
  | (PartialPredictiveSearchResult<'products'> & expandedPartialPredictive);
const ProductCarousel = ({
  product,
  loading,
  layout = 'grid',
}: {
  product: collectionPageProduct;
  loading?: 'eager' | 'lazy';
  layout?: string;
}) => {
  const cardClassName =
    layout === 'grid'
      ? 'group-hover:shadow-xl h-full transition-shadow duration-500 cursor-pointer'
      : 'transform group-hover:shadow-xl transition-shadow duration-500 mx-8 my-3 cursor-pointer';
  const cardContentClassName =
    layout === 'grid'
      ? 'flex flex-col h-full'
      : 'px-8 md:px-6 gap-y-4 grid grid-cols-2 lg:grid-cols-3';

  const variantUrl = useVariantUrl(product.handle);
  const standardImages = product?.images?.nodes?.filter((item) =>
    item.altText?.includes('standard'),
  );
  console.log(standardImages, '202020');
  const [carouselApi, setcarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setcurrentIndex] = useState(0);
  const [totalItems, settotalItems] = useState(0);
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });
  useEffect(() => {
    if (!carouselApi) return;

    const updateCarouselState = () => {
      setcurrentIndex(carouselApi.selectedScrollSnap());
      settotalItems(carouselApi.scrollSnapList().length);
    };

    updateCarouselState();

    carouselApi.on('select', updateCarouselState);

    return () => {
      carouselApi.off('select', updateCarouselState); // Clean up on unmount
    };
  }, [carouselApi]);
  const scrollToIndex = (index: number) => {
    carouselApi?.scrollTo(index);
  };
  const increaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    scrollToIndex(currentIndex + 1);
  };
  const decreaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    scrollToIndex(currentIndex - 1);
  };
  console.log(product.priceRange, '1010101');

  return (
    <article className="group relative">
      <Card className={cardClassName}>
        <CardContent className={cardContentClassName}>
          <div className="relative w-full h-full rounded top-part-card">
            <Carousel
              // ref={carouselRef}
              // opts={{
              //   align: 'start',
              //   startIndex: count,
              // }}
              setApi={setcarouselApi}
              className="w-full max-w-7xl transform-none me-4"
            >
              <Link
                className="product-item"
                key={product.id}
                prefetch="intent"
                to={variantUrl}
              >
                <CarouselContent>
                  {standardImages?.map((url, idx) => (
                    <CarouselItem
                      className="flex items-center justify-center"
                      key={idx}
                    >
                      {layout === 'grid' && (
                        <div className="w-[90%] p-4 flex items-center justify-center">
                          <img
                            src={url.url}
                            alt=""
                            className="flex items-center justify-center rounded w-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      )}
                      {layout === 'list' && (
                        <div className="w-[95%] p-4 ms-3 flex items-center justify-center">
                          <img
                            src={url.url}
                            alt=""
                            className="flex items-center justify-center rounded w-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      )}
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Link>
              <div className="absolute inset-0 z-40 flex items-center justify-between pointer-events-none">
                {layout === 'grid' && (
                  <>
                    <Button
                      onClick={decreaseIndex}
                      className="pointer-events-auto rounded-full w-8 h-8 p-0 mx-[-4px] shadow-none"
                      variant="secondary"
                    >
                      <ChevronLeftIcon className="h-6 w-6 text-white"></ChevronLeftIcon>
                    </Button>
                    <Button
                      onClick={increaseIndex}
                      className="pointer-events-auto rounded-full w-8 h-8 p-0 mx-[-4px] shadow-none"
                      variant="secondary"
                    >
                      <ChevronRightIcon className="h-6 w-6 text-white"></ChevronRightIcon>
                    </Button>
                  </>
                )}
                {layout === 'list' && (
                  <>
                    <Button
                      onClick={decreaseIndex}
                      className="pointer-events-auto rounded-full w-8 h-8 p-0 mx-[-15px] shadow-none"
                      variant="secondary"
                    >
                      <ChevronLeftIcon className="h-6 w-6 text-white"></ChevronLeftIcon>
                    </Button>
                    <Button
                      onClick={increaseIndex}
                      className="pointer-events-auto rounded-full w-8 h-8 p-0 mx-[-26px] shadow-none"
                      variant="secondary"
                    >
                      <ChevronRightIcon className="h-6 w-6 text-white"></ChevronRightIcon>
                    </Button>
                  </>
                )}
              </div>
            </Carousel>
            {/* <div className="absolute inset-0 z-40 flex items-center justify-between pointer-events-none">
              <Button
                onClick={decreaseIndex}
                className="pointer-events-auto rounded-full w-8 h-8 p-0 mx-[-8px] shadow-none"
                variant="secondary"
              >
                <ChevronLeftIcon className="h-6 w-6 text-white"></ChevronLeftIcon>
              </Button>
              <Button
                onClick={increaseIndex}
                className="pointer-events-auto rounded-full w-8 h-8 p-0 mx-[-8px] shadow-none"
                variant="secondary"
              >
                <ChevronRightIcon className="h-6 w-6 text-white"></ChevronRightIcon>
              </Button>
            </div> */}
          </div>
          {layout === 'grid' && (
            <div className="bottom-part-card">
              <div className="text-center">
                <h5 className="text-lg">{product.title}</h5>
              </div>
              {product?.priceRange?.minVariantPrice && (
                <div className="flex justify-center">
                  <span className="text-md flex flex-row gap-2">
                    From
                    <Money data={product?.priceRange?.minVariantPrice} />
                  </span>
                </div>
              )}
            </div>
          )}
          {layout === 'list' && (
            <div className="bottom-part-card mx-[40px]">
              <div className="text-start">
                <h5 className="text-lg">{product.title}</h5>
              </div>
              {product?.priceRange?.minVariantPrice && (
                <div className="flex justify-start">
                  <span className="text-md flex flex-row gap-2">
                    From
                    <Money data={product?.priceRange?.minVariantPrice} />
                  </span>
                </div>
              )}
            </div>
          )}
          {layout === 'list' && windowWidth > 1023 && <p>{product.}</p>}
        </CardContent>
      </Card>
    </article>
  );
};

export default ProductCarousel;
