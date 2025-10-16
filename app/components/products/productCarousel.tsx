// app/components/productCarousel.tsx
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
import {ChevronLeftIcon, ChevronRightIcon, Divide} from 'lucide-react';
import {Money} from '@shopify/hydrogen';
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

/**
 * NOTE: product prop is now permissive to avoid TS errors when callers pass just an id.
 * Prefer passing the full product object (collectionProduct) from the parent.
 */
export const ProductCarousel = ({
  product,
  loading,
  layout = 'grid',
}: {
  // accept full product OR a looser shape (to silence type-checking when your caller doesn't have full objects)
  product: collectionPageProduct | any;
  loading?: 'eager' | 'lazy';
  layout?: string;
}) => {
  // If caller passed a string id by mistake, bail out gracefully
  if (typeof product === 'string') {
    console.warn(
      'ProductCarousel: received a string for `product` prop — expected a product object. Rendering skipped.',
      product,
    );
    return null;
  }

  // Attempt to coerce/validate into the expected shape
  const prod = (product as collectionProduct | undefined) ?? undefined;
  console.log(product, 'logproduct');

  if (!prod || (!prod.id && !prod.handle)) {
    console.warn(
      'ProductCarousel: product prop does not look like a complete product object. Rendering skipped.',
      product,
    );
    return null;
  }

  const {title, images, priceRange, handle, id, tags} =
    prod as collectionProduct;

  const cardClassName =
    layout === 'grid'
      ? 'group-hover:shadow-xl h-full transition-shadow duration-500 cursor-pointer mb-5 pb-3'
      : 'transform group-hover:shadow-xl transition-shadow duration-500 mx-8 my-3 cursor-pointer';

  const cardContentClassName =
    layout === 'grid'
      ? 'flex flex-col h-full'
      : 'px-8 md:px-6 gap-y-4 grid list-view-large-row';

  const variantUrl = useVariantUrl(handle);

  const standardImages = images?.nodes?.filter((item) =>
    item?.url?.includes('outer-carousel-'),
  );
  console.log(standardImages, 'outer');

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

  const locationTag = (prod.tags || []).find((t: string) =>
    t?.startsWith?.('loc_'),
  );
  let locationName: string | undefined;
  let locationState: string | undefined;
  let locationCountry: string | undefined;

  const titleCase = (w: string) =>
    w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

  if (locationTag) {
    const parts = locationTag.split('_');

    const extract = (base: 'locname' | 'locstate' | 'loccountry') => {
      const capsKey = `${base}caps`;
      const capsIdx = parts.indexOf(capsKey);
      const baseIdx = parts.indexOf(base);
      const idx = capsIdx !== -1 ? capsIdx : baseIdx;
      if (idx === -1) return undefined;

      const valueParts: string[] = [];
      for (let i = idx + 1; i < parts.length; i++) {
        if (parts[i].startsWith('loc')) break;
        valueParts.push(parts[i]);
      }
      if (valueParts.length === 0) return undefined;
      const raw = valueParts.join(' ').trim();
      if (raw.toLowerCase() === 'null') return undefined;
      if (capsIdx !== -1) return raw.toUpperCase();
      if (base === 'locname') return valueParts.map(titleCase).join(' ');
      return valueParts
        .map((w) => (w.length <= 3 ? w.toUpperCase() : titleCase(w)))
        .join(' ');
    };

    locationName = extract('locname');
    locationState = extract('locstate');
    locationCountry = extract('loccountry');
  }

  const formattedLocation = [locationName, locationState, locationCountry]
    .filter(Boolean)
    .join(', ');

  let isHorOnly = prod.tags.includes('horOnly');

  let isHorPrimary = prod.tags.includes('horPrimary');
  let isVertOnly = prod.tags.includes('vertOnly');
  let isVertPrimary = prod.tags.includes('vertPrimary');
  let isHorizontal = isHorOnly || isHorPrimary;
  let isVertical = isVertOnly || isVertPrimary;
  // const carouselHeight = isHorOnly || isHorPrimary ? 'w-88' : 'w-4';
  let carouselHeight = '';
  if (isHorOnly) {
    carouselHeight = 'w-120';
  } else if (isHorPrimary) {
    carouselHeight = 'w-120';
  } else if (isVertOnly && layout === 'grid') {
    carouselHeight = 'w-58';
  } else if (isVertPrimary && layout === 'grid') {
    carouselHeight = 'w-58';
  } else if (isVertOnly && layout === 'list') {
    carouselHeight = 'w-28';
  } else if (isVertPrimary && layout === 'list') {
    carouselHeight = 'w-28';
  }
  console.log(prod, 'prods');

  console.log(isHorOnly, '1144horOnly');
  console.log(isVertOnly, '1144vertOnly');
  console.log(isHorPrimary, '1144horPrimary');
  console.log(isVertPrimary, '1144vertPrimary');

  return (
    <article className="group relative">
      <Card className={cardClassName}>
        <div className={cardContentClassName}>
          <div
            className={`relative w-full h-full rounded ${
              layout === 'grid'
                ? 'top-part-card-grid'
                : 'top-part-card-list flex items-center'
            }`}
          >
            <Carousel
              setApi={setCarouselApi}
              className="w-full max-w-7xl transform-none"
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
                        className={`flex items-center justify-center ${layout === 'grid' && 'w-[85%]'} ${layout === 'list' && isVertical && 'w-[65%]'} ${
                          layout === 'grid' ? 'pt-2 pb-2 ps-4 pe-4' : 'p-2 ms-3'
                        }`}
                      >
                        <img
                          src={img?.url}
                          className={`rounded ${layout === 'grid' ? `${carouselHeight}` : 'carousel-img-list-view'} object-cover transform group-hover:scale-105 transition-transform duration-500`}
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Link>

              <div className="absolute inset-0 z-40 flex items-center justify-between pointer-events-none">
                <Button
                  onClick={decreaseIndex}
                  className={`pointer-events-auto rounded-full w-8 h-8 p-0 shadow-none ${layout === 'list' && isHorizontal && 'left-arrow-carousel-list-horizontal'} ${layout === 'list' && isVertical && 'left-arrow-carousel-list-vertical'} ${layout === 'grid' && isHorizontal && 'left-arrow-carousel-grid-horizontal'} ${layout === 'grid' && isVertical && 'left-arrow-carousel-grid-vertical'}`}
                  variant="secondary"
                >
                  <ChevronLeftIcon className="h-6 w-6 text-white" />
                </Button>
                <Button
                  onClick={increaseIndex}
                  className={`pointer-events-auto rounded-full w-8 h-8 p-0 shadow-none ${layout === 'list' && isHorizontal && 'right-arrow-carousel-list-horizontal'} ${layout === 'list' && isVertical && 'right-arrow-carousel-list-vertical'} ${layout === 'grid' && isHorizontal && 'right-arrow-carousel-grid-horizontal'} ${layout === 'grid' && isVertical && 'right-arrow-carousel-grid-vertical'}`}
                  variant="secondary"
                >
                  <ChevronRightIcon className="h-6 w-6 text-white" />
                </Button>
              </div>
            </Carousel>
          </div>

          {/* Bottom card section */}
          <div
            className={`bottom-part-card ${layout === 'grid' ? '' : 'ms-9 flex justify-start bottom-part-card-list'}`}
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
                  <h5 className="text-lg font-bold">{title}</h5>
                  <p className="text-muted-foreground">{formattedLocation}</p>
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
                  (prod as any).descriptionHtml &&
                  windowWidth != undefined &&
                  windowWidth > 787 && (
                    <>
                      <div>
                        <Card className="description-html-card ">
                          <div
                            className="text-sm p-3"
                            dangerouslySetInnerHTML={{
                              __html: (prod as any).descriptionHtml,
                            }}
                          />
                        </Card>
                      </div>
                    </>
                  )}

                <div
                  className={`flex ${layout === 'grid' ? 'justify-center my-2' : 'justify-start mt-2'}`}
                >
                  <Button variant="default">View Product</Button>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </Card>
    </article>
  );
};

export default ProductCarousel;
