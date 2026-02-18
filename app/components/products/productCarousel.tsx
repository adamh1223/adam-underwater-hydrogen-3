// app/components/productCarousel.tsx
import React, {useEffect, useState} from 'react';
import {Card, CardContent} from '../ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselApi,
} from '../ui/carousel';
import {
  Link,
  NavLink,
  Navigate,
  useLoaderData,
  useNavigate,
} from '@remix-run/react';
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
      ? 'relative group-hover:shadow-xl h-full transition-shadow duration-500 cursor-pointer mb-1 pb-1'
      : 'relative h-full transform group-hover:shadow-xl transition-shadow duration-500 cursor-pointer';

  const cardContentClassName =
    layout === 'grid'
      ? 'flex flex-col h-full'
      : 'h-full gap-y-4 grid list-view-large-row';

  const articleClassName =
    layout === 'grid'
      ? 'group relative h-full mb-[12px]'
      : 'group relative h-full mb-[12px]';

  const variantUrl = useVariantUrl(handle);

  const standardImages = images?.nodes?.filter((item) =>
    item?.url?.includes('outer-carousel-'),
  );

  const navigate = useNavigate();
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const [wishlistItem, setWishlistItem] = useState(isInWishlist);
  const [pendingWishlistChange, setPendingWishlistChange] = useState(false);

  const listLayoutColumns =
    layout === 'list' ? {gridTemplateColumns: '60% 40%'} : undefined;

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

    let rafId = 0;

    const updateCarouselState = () => {
      setCurrentIndex(carouselApi.selectedScrollSnap());
      setTotalItems(carouselApi.scrollSnapList().length);
    };

    const updateOnNextFrame = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateCarouselState);
    };

    updateOnNextFrame();

    carouselApi.on('select', updateOnNextFrame);
    carouselApi.on('reInit', updateOnNextFrame);
    carouselApi.on('resize', updateOnNextFrame);
    carouselApi.on('slidesChanged', updateOnNextFrame);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      carouselApi.off('select', updateOnNextFrame);
      carouselApi.off('reInit', updateOnNextFrame);
      carouselApi.off('resize', updateOnNextFrame);
      carouselApi.off('slidesChanged', updateOnNextFrame);
    };
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

  const isHorOnly = prod.tags.includes('horOnly');
  const isHorPrimary = prod.tags.includes('horPrimary');
  const isVertOnly = prod.tags.includes('vertOnly');
  const isVertPrimary = prod.tags.includes('vertPrimary');

  const orientation = isVertPrimary
    ? 'Vertical'
    : isHorPrimary
      ? 'Landscape'
      : isVertOnly
        ? 'Vertical'
        : isHorOnly
          ? 'Landscape'
          : undefined;

  const isHorizontal = orientation === 'Landscape';
  const isVertical = orientation === 'Vertical';
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
      toast.success('Added to Favorites', {
        action: {
          label: 'View All Favorites',
          onClick: () => navigate('/account/favorites'),
        },
      });
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
      toast.success('Removed from Favorites', {
        action: {
          label: 'View All Favorites',
          onClick: () => navigate('/account/favorites'),
        },
      });
      setPendingWishlistChange(false);
    } catch (error) {
      setWishlistItem(true);
      setPendingWishlistChange(false);
    }
  };
  const loginValue = useIsLoggedIn(isLoggedIn);

  return (
    <article className={articleClassName}>
      <Card className={cardClassName}>
        {layout === 'list' && (
          <div className="cursor-pointer absolute top-[2px] right-[2px] z-50 p-1">
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
        <div className={cardContentClassName} style={listLayoutColumns}>
          <div
            className={`relative w-full rounded ${
              layout === 'grid'
                ? 'h-full print-top-part-card-grid'
                : 'h-full print-top-part-card-list'
            }`}
          >
            {layout === 'grid' && (
              <div className="cursor-pointer absolute top-[2px] right-[2px] z-50 p-1">
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
              className={`z-42 carousel-hover-safe w-full max-w-7xl transform-none ${layout === 'grid' && 'print-carousel-grid'} ${layout === 'list' && 'print-carousel-list'}`}
            >
              <Link
                className={`product-item ${layout === 'list' && 'flex items-center'}`}
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
                          layout === 'grid' && 'pt-2'
                        } ${layout === 'list' && 'px-3 py-2'}`}
                      >
                        <img
                          src={img?.url}
                          className={`rounded max-w-full ${layout === 'grid' ? `${carouselHeight}` : 'carousel-img-list-view'} object-cover transform group-hover:scale-105 transition-transform duration-500`}
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Link>

              <div
                className={`absolute z-40 flex items-center justify-between pointer-events-none ${
                  layout === 'grid' ? 'inset-0' : ''
                } ${layout === 'list' ? 'list-arrow-shell' : ''} ${
                  layout === 'list' && isHorizontal
                    ? 'list-horizontal-arrow-shell'
                    : ''
                } ${
                  layout === 'list' && isVertical
                    ? 'list-vertical-arrow-shell'
                    : ''
                }`}
              >
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
              <div className="carousel-preview-dots-grid absolute bottom-[-15px] left-0 right-0 z-40 flex items-end justify-center gap-3 h-32 pt-[28px]">
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
            {totalItems > 1 && layout === 'list' && isVertical && (
              <div className="carousel-preview-dots-list absolute bottom-[6px] left-0 right-0 flex items-end justify-center gap-3 h-28 pt-[28px]">
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
            {totalItems > 1 && layout === 'list' && isHorizontal && (
              <div className="carousel-preview-dots-list absolute bottom-[4px] left-0 right-0 flex items-end justify-center gap-3 h-28 pt-[28px]">
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
            className={`bottom-part-card ${layout === 'grid' ? '' : 'flex justify-start print-bottom-part-card-list'}`}
          >
            <Link
              className={`product-item ${layout === 'list' && 'flex items-center'}`}
              key={id}
              prefetch="intent"
              to={variantUrl}
            >
              <div
                className={`${layout === 'grid' ? 'print-bottom-part-card-inside-grid' : 'print-bottom-part-card-inside-list'}`}
              >
                <div
                  className={layout === 'grid' ? 'text-center' : 'text-start'}
                >
                  <h5
                    className={`font-bold ${
                      layout === 'list'
                        ? 'max-w-[85%] product-title-font-list'
                        : 'text-lg'
                    }`}
                  >
                    {title}
                  </h5>
                  <p
                    className={`text-muted-foreground ${
                      layout === 'list' ? 'product-location-font-list' : ''
                    }`}
                  >
                    {formattedLocation}
                  </p>
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

                {/*
                  Prints list-view description intentionally hidden.
                  Previous logic (kept for easy restore):
                  layout !== 'grid' &&
                  (prod as any).descriptionHtml &&
                  windowWidth != undefined &&
                  windowWidth > 800
                */}

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
