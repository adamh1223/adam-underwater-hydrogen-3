import React, {useEffect, useState} from 'react';
import {Card, CardContent} from '../ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselApi,
} from '../ui/carousel';
import {Link} from '@remix-run/react';
import {Button} from '../ui/button';
import {ChevronLeftIcon, ChevronRightIcon} from 'lucide-react';
import {Money, useOptimisticVariant} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';
import {ProductItemFragment, CollectionQuery} from 'storefrontapi.generated';
import {PartialPredictiveSearchResult} from '../SearchResultsPredictive';
import {CurrencyCode} from '@shopify/hydrogen/storefront-api-types';
import '../../styles/routeStyles/product.css';

type shopifyImage = {url: string; altText: string};
type collectionProductImages = {images?: {nodes: shopifyImage[]}};
type collectionProduct = ProductItemFragment &
  collectionProductImages &
  CollectionQuery;

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
  product: collectionProduct;
  loading?: 'eager' | 'lazy';
  layout?: string;
}) => {
  const {title, images, priceRange, handle, id} = product as collectionProduct;

  const cardClassName =
    layout === 'grid'
      ? 'group-hover:shadow-xl h-full transition-shadow duration-500 cursor-pointer'
      : 'transform group-hover:shadow-xl transition-shadow duration-500 mx-8 my-3 cursor-pointer';

  const cardContentClassName =
    layout === 'grid'
      ? 'flex flex-col h-full'
      : 'px-8 md:px-6 gap-y-4 grid list-view-large-row';

  const variantUrl = useVariantUrl(handle);

  const standardImages = images?.nodes?.filter((item) =>
    item.altText?.includes('standard'),
  );

  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!carouselApi) return;

    const updateCarouselState = () => {
      setCurrentIndex(carouselApi.selectedScrollSnap());
      setTotalItems(carouselApi.scrollSnapList().length);
    };

    updateCarouselState();

    carouselApi.on('select', updateCarouselState);

    // Cleanup function
    return () => void carouselApi.off('select', updateCarouselState);
  }, [carouselApi]);

  const scrollToIndex = (index: number) => carouselApi?.scrollTo(index);

  const increaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    scrollToIndex(currentIndex + 1);
  };

  const decreaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    scrollToIndex(currentIndex - 1);
  };

  return (
    <article className="group relative">
      <Card className={cardClassName}>
        <CardContent className={cardContentClassName}>
          <div
            className={`relative w-full h-full rounded ${layout === 'grid' ? 'top-part-card-grid' : 'top-part-card-list'}`}
          >
            <Carousel
              setApi={setCarouselApi}
              className="w-full max-w-7xl transform-none me-4"
            >
              <Link
                className="product-item"
                key={id}
                prefetch="intent"
                to={variantUrl}
              >
                <CarouselContent>
                  {standardImages?.map((img, idx) => (
                    <CarouselItem
                      className="flex items-center justify-center"
                      key={idx}
                    >
                      <div
                        className={`flex items-center justify-center w-full ${
                          layout === 'grid' ? 'p-4' : 'p-4 ms-3'
                        }`}
                      >
                        <img
                          src={img.url}
                          alt={img.altText ?? ''}
                          className={`rounded ${layout === 'grid' ? 'w-[90%]' : 'carousel-img-list-view'} object-cover transform group-hover:scale-105 transition-transform duration-500`}
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Link>
              <div className="absolute inset-0 z-40 flex items-center justify-between pointer-events-none">
                <Button
                  onClick={decreaseIndex}
                  className={`pointer-events-auto rounded-full w-8 h-8 p-0 shadow-none ${
                    layout === 'list' ? 'left-arrow-carousel-list' : 'mx-[-4px]'
                  }`}
                  variant="secondary"
                >
                  <ChevronLeftIcon className="h-6 w-6 text-white" />
                </Button>
                <Button
                  onClick={increaseIndex}
                  className={`pointer-events-auto rounded-full w-8 h-8 p-0 shadow-none ${
                    layout === 'list'
                      ? 'right-arrow-carousel-list'
                      : 'mx-[-4px]'
                  }`}
                  variant="secondary"
                >
                  <ChevronRightIcon className="h-6 w-6 text-white" />
                </Button>
              </div>
            </Carousel>
          </div>

          {/* Bottom card section */}
          <div
            className={`bottom-part-card ${layout === 'grid' ? '' : 'ms-9'}`}
          >
            <Link
              className="product-item"
              key={id}
              prefetch="intent"
              to={variantUrl}
            >
              <div className="bottom-part-card-inside">
                <div
                  className={layout === 'grid' ? 'text-center' : 'text-start'}
                >
                  <h5 className="text-lg">{title}</h5>
                </div>
                {priceRange?.minVariantPrice && (
                  <div
                    className={`flex ${layout === 'grid' ? 'justify-center' : 'justify-start'}`}
                  >
                    <span className="text-md flex flex-row gap-2">
                      From <Money data={priceRange.minVariantPrice} />
                    </span>
                  </div>
                )}
                {layout !== 'grid' &&
                  (product as any).descriptionHtml &&
                  windowWidth != undefined &&
                  windowWidth > 787 && (
                    <>
                      <div>
                        <Card className="description-html-card ">
                          <div
                            className="text-sm p-3"
                            dangerouslySetInnerHTML={{
                              __html: (product as any).descriptionHtml,
                            }}
                          />
                        </Card>
                      </div>
                    </>
                  )}
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </article>
  );
};

export default ProductCarousel;
