import React, {useEffect, useState} from 'react';
import {Card, CardAction, CardContent} from '../ui/card';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from '../ui/carousel';
import {Link} from '@remix-run/react';
import {Button} from '../ui/button';
import {ChevronLeftIcon, ChevronRightIcon} from 'lucide-react';
import {Money} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';
import {ProductItemFragment} from 'storefrontapi.generated';
import {AddToCartButton} from '../AddToCartButton';
import {PartialPredictiveSearchResult} from '../SearchResultsPredictive';
import {CurrencyCode, Scalars} from '@shopify/hydrogen/storefront-api-types';

type shopifyImage = {url: string; altText: string};
type collectionProductImages = {images?: {nodes: shopifyImage[]}};
type collectionProduct = ProductItemFragment & collectionProductImages;
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
      ? 'group-hover:shadow-xl transition-shadow duration-500 m-5'
      : 'transform group-hover:shadow-xl transition-shadow duration-500 mx-8 my-3';
  const variantUrl = useVariantUrl(product.handle);
  const standardImages = product?.images?.nodes?.filter((item) =>
    item.altText?.includes('standard'),
  );
  console.log(standardImages, '202020');
  const [carouselApi, setcarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setcurrentIndex] = useState(0);
  const [totalItems, settotalItems] = useState(0);
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
        <CardContent>
          <div className="relative h-full w-full rounded">
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
                      <div className="w-[90%] p-4 flex items-center justify-center">
                        <img
                          src={url.url}
                          alt=""
                          className="max-h-full object-contain"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Link>
            </Carousel>
            <div className="absolute inset-0 z-40 flex items-center justify-between pointer-events-none">
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
            </div>
            <div className="flex justify-center">
              <h5>{product.title}</h5>
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
        </CardContent>
      </Card>
    </article>
  );
};

export default ProductCarousel;
