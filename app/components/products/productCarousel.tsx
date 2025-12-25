// app/components/productCarousel.tsx
import React, {useEffect, useState} from 'react';
import {Card, CardContent} from '../ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselApi,
} from '../ui/carousel';
import {Link, NavLink, Navigate, useLoaderData} from '@remix-run/react';
import {Button} from '../ui/button';
import {ChevronLeftIcon, ChevronRightIcon, Divide} from 'lucide-react';
import {Money} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';
import {ProductItemFragment, CollectionQuery} from 'storefrontapi.generated';
import {PartialPredictiveSearchResult} from '../SearchResultsPredictive';
import {CurrencyCode} from '@shopify/hydrogen/storefront-api-types';
import '../../styles/routeStyles/product.css';
import {LoaderFunctionArgs, redirect} from '@remix-run/server-runtime';
import {ReloadIcon} from '@radix-ui/react-icons';
import {FaHeart, FaRegHeart} from 'react-icons/fa';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {useIsLoggedIn} from '~/lib/hooks';
import {toast} from 'sonner';

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
  isInWishlist = false,
  isLoggedIn = undefined,
}: {
  // accept full product OR a looser shape (to silence type-checking when your caller doesn't have full objects)
  product: collectionPageProduct | any;
  loading?: 'eager' | 'lazy';
  layout?: string;
  isInWishlist: boolean;
  isLoggedIn: Promise<boolean> | undefined;
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
      : 'px-8 md:px-6 gap-y-4 grid list-view-large-row pt-4 pb-4';

  const variantUrl = useVariantUrl(handle);

  const standardImages = images?.nodes?.filter((item) =>
    item?.url?.includes('outer-carousel-'),
  );

  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const [wishlistItem, setWishlistItem] = useState(isInWishlist);
  const [pendingWishlistChange, setPendingWishlistChange] = useState(false);

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
    // Horizontal Only = 120
    carouselHeight = 'w-120';
  } else if (isHorPrimary) {
    // Horizontal Primary = 120
    carouselHeight = 'w-120';
  } else if (
    // Vertical / Grid / >900px = 64
    (isVertOnly || isVertPrimary) &&
    layout === 'grid' &&
    windowWidth != undefined &&
    windowWidth > 1350
  ) {
    carouselHeight = 'w-72';
  } else if (
    // Vertical / Grid / >900px = 64
    (isVertOnly || isVertPrimary) &&
    layout === 'grid' &&
    windowWidth != undefined &&
    windowWidth > 1200 &&
    windowWidth <= 1350
  ) {
    carouselHeight = 'w-64';
  } else if (
    // Vertical / Grid / >900px = 64
    (isVertOnly || isVertPrimary) &&
    layout === 'grid' &&
    windowWidth != undefined &&
    windowWidth > 900 &&
    windowWidth <= 1200
  ) {
    carouselHeight = 'w-56';
  } else if (
    // Vertical / Grid / 800-900px = 54
    (isVertPrimary || isVertOnly) &&
    layout === 'grid' &&
    windowWidth != undefined &&
    windowWidth <= 900 &&
    windowWidth > 750
  ) {
    carouselHeight = 'w-48';
  } else if (
    // Vertical / Grid / 800-900px = 54
    (isVertPrimary || isVertOnly) &&
    layout === 'grid' &&
    windowWidth != undefined &&
    windowWidth <= 750 &&
    windowWidth > 700
  ) {
    carouselHeight = 'w-40';
  } else if (
    // Vertical / Grid / <=800px = 40
    (isVertPrimary || isVertOnly) &&
    layout === 'grid' &&
    windowWidth != undefined &&
    windowWidth <= 700
  ) {
    carouselHeight = 'w-64';
  } else if (
    // Vertical Only / List / 28
    isVertOnly &&
    layout === 'list'
  ) {
    carouselHeight = 'w-28';
  } else if (
    // Vertical Primary / List / 28
    isVertPrimary &&
    layout === 'list'
  ) {
    carouselHeight = 'w-28';
  }

  const addToFavorites = async () => {
    try {
      setPendingWishlistChange(true);
      const form = new FormData();
      form.append('productId', prod.id);

      const response = await fetch('/api/add_favorites', {
        method: 'POST',
        body: form,
        headers: {Accept: 'application/json'},
      });
      const json = await response.json();
      setWishlistItem(true);
      toast.success('Added to Favorites');
      setPendingWishlistChange(false);
    } catch (error) {
      setWishlistItem(false);
      setPendingWishlistChange(false);
    }
  };
  const removeFromFavorites = async () => {
    try {
      setPendingWishlistChange(true);
      const form = new FormData();
      form.append('productId', prod.id);

      const response = await fetch('/api/remove_favorites', {
        method: 'PUT',
        body: form,
        headers: {Accept: 'application/json'},
      });
      const json = await response.json();
      setWishlistItem(false);
      toast.success('Removed from Favorites');
      setPendingWishlistChange(false);
    } catch (error) {
      setWishlistItem(true);
      setPendingWishlistChange(false);
    }
  };
  const loginValue = useIsLoggedIn(isLoggedIn);

  return (
    <article className="group relative h-full">
      <Card className={cardClassName}>
        {layout === 'list' && (
          <div className="cursor-pointer absolute top-[20px] right-[40px] z-50 p-1">
            {/* <Button
              variant="outline"
              onClick={addToFavorites}
              className="cursor-pointer"
            >
              <FaRegHeart />
            </Button> */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={
                      wishlistItem ? removeFromFavorites : addToFavorites
                    }
                    disabled={!loginValue}
                    className="cursor-pointer p-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer relative z-50"
                  >
                    {pendingWishlistChange ? (
                      <ReloadIcon className="animate-spin" />
                    ) : (
                      <>
                        {wishlistItem ? (
                          <FaHeart />
                        ) : (
                          <>
                            {loginValue ? (
                              <FaRegHeart />
                            ) : (
                              <Link to="/account/login">
                                <FaRegHeart />
                              </Link>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-sm z-1000">
                  {wishlistItem ? 'Remove from Favorites' : 'Save to Favorites'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        <div className={cardContentClassName}>
          <div
            className={`relative w-full h-full rounded ${
              layout === 'grid'
                ? 'top-part-card-grid'
                : 'top-part-card-list flex items-center'
            }`}
          >
            {layout === 'grid' && (
              <div className="cursor-pointer absolute top-2 right-2 z-50 p-1">
                {/* <Button
                  variant="outline"
                  onClick={addToFavorites}
                  className="cursor-pointer"
                >
                  {pending ? (
                  <ReloadIcon className="animate-spin" />
                ) : isFavorite ? (
                  <FaHeart />
                ) : (
                  <FaRegHeart />
                )}
                  <ReloadIcon className="animate-spin" />
                  <FaHeart />
                  <FaRegHeart />
                </Button> */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={
                          wishlistItem ? removeFromFavorites : addToFavorites
                        }
                        disabled={!loginValue}
                        className="cursor-pointer p-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer relative z-50"
                      >
                        {pendingWishlistChange ? (
                          <ReloadIcon className="animate-spin" />
                        ) : (
                          <>
                            {wishlistItem ? (
                              <FaHeart />
                            ) : (
                              <>
                                {loginValue ? (
                                  <FaRegHeart />
                                ) : (
                                  <Link to="/account/login">
                                    <FaRegHeart />
                                  </Link>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-sm z-1000">
                      {wishlistItem
                        ? 'Remove from Favorites'
                        : 'Save to Favorites'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
            <Carousel
              setApi={setCarouselApi}
              className="w-full max-w-7xl transform-none pb-4"
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
                          layout === 'grid'
                            ? 'pt-5 pb-[12px] ps-4 pe-4'
                            : 'p-2 ms-3'
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
                  className={`pointer-events-auto rounded-full w-8 h-8 p-0 shadow-none cursor-pointer ${layout === 'list' && isHorizontal && 'left-arrow-carousel-list-horizontal'} ${layout === 'list' && isVertical && 'left-arrow-carousel-list-vertical'} ${layout === 'grid' && isHorizontal && 'left-arrow-carousel-grid-horizontal'} ${layout === 'grid' && isVertical && 'left-arrow-carousel-grid-vertical'}`}
                  variant="secondary"
                >
                  <ChevronLeftIcon className="h-6 w-6 text-white" />
                </Button>
                <Button
                  onClick={increaseIndex}
                  className={`cursor-pointer pointer-events-auto rounded-full w-8 h-8 p-0 shadow-none ${layout === 'list' && isHorizontal && 'right-arrow-carousel-list-horizontal'} ${layout === 'list' && isVertical && 'right-arrow-carousel-list-vertical'} ${layout === 'grid' && isHorizontal && 'right-arrow-carousel-grid-horizontal'} ${layout === 'grid' && isVertical && 'right-arrow-carousel-grid-vertical'}`}
                  variant="secondary"
                >
                  <ChevronRightIcon className="h-6 w-6 text-white" />
                </Button>
              </div>
            </Carousel>
            {totalItems > 1 && layout === 'grid' && (
              <div className="absolute bottom-2 left-0 right-0 z-40 flex items-end justify-center gap-3 h-24 pt-5">
                {Array.from({length: totalItems}).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      scrollToIndex(idx);
                    }}
                    className={`h-2 w-2 rounded-full border border-white/60 ${idx === currentIndex ? 'bg-white' : 'bg-white/30'}`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
            {totalItems > 1 && layout === 'list' && (
              <div className="absolute bottom-2 left-0 right-0 z-40 flex items-end justify-center gap-3 h-24 pt-5 ms-3">
                {Array.from({length: totalItems}).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      scrollToIndex(idx);
                    }}
                    className={`h-2 w-2 rounded-full border border-white/60 ${idx === currentIndex ? 'bg-white' : 'bg-white/30'}`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
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
                  <h5
                    className={`text-lg font-bold ${layout === 'list' && 'max-w-[85%]'}`}
                  >
                    {title}
                  </h5>
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
                  <Button variant="default" className="cursor-pointer">
                    View Product
                  </Button>
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
