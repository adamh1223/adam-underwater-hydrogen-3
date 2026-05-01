import {Await} from '@remix-run/react';
import {CartReturn} from '@shopify/hydrogen';
import {Suspense, useEffect, useMemo, useState} from 'react';
import {RecommendedProductsQuery} from 'storefrontapi.generated';
import ProductCarousel from './productCarousel';
import EProductsContainer from '../eproducts/EProductsContainer';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';
import {hasVideoTag} from '~/lib/productTags';

const KEYWORD_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'with',
  'stock',
  'footage',
  'video',
  'clip',
  'clips',
]);

function tokenizeKeywords(value: string | null | undefined): string[] {
  if (!value) return [];
  const matches = value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return matches.filter((token) => {
    if (KEYWORD_STOP_WORDS.has(token)) return false;
    if (token.length >= 3) return true;
    return /^\d+k$/.test(token) || /^\d+fps$/.test(token);
  });
}

function getSharedKeywordCount(source: Set<string>, target: Set<string>): number {
  let sharedCount = 0;
  target.forEach((keyword) => {
    if (source.has(keyword)) sharedCount += 1;
  });
  return sharedCount;
}

function SimpleRecommendedProducts({
  products,
  isVideo,
  currentProductID,
  currentProductTitle,
  currentProductDescription,
  cart,
  isLoggedIn,
  wishlistProducts,
}: {
  products: Promise<RecommendedProductsQuery | null>;
  isVideo: boolean;
  currentProductID: string;
  currentProductTitle: string;
  currentProductDescription?: string | null;
  cart?: Promise<CartReturn | null>;
  isLoggedIn: boolean;
  wishlistProducts: string[];
}) {
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isLoggedInPromise = useMemo(
    () => Promise.resolve(Boolean(isLoggedIn)),
    [isLoggedIn],
  );

  const relatedVideoColumnCount =
    windowWidth == undefined
      ? 1
      : windowWidth >= 2113
        ? 5
        : windowWidth >= 1713
          ? 4
          : windowWidth >= 1313
            ? 3
            : windowWidth >= 913
              ? 2
              : 1;

  const baseListColumnWidth = isVideo ? 435 : 367.5;
  const outerHorizontalGutter =
    windowWidth != undefined && windowWidth < 640 ? 88 : 128;
  const usableCarouselWidth =
    windowWidth != undefined
      ? Math.max(baseListColumnWidth, windowWidth - outerHorizontalGutter)
      : baseListColumnWidth;
  const slidesPerView = Math.max(
    1,
    Math.floor(usableCarouselWidth / baseListColumnWidth),
  );
  const computedSlidesPerView = isVideo
    ? relatedVideoColumnCount
    : slidesPerView;
  const currentProductKeywordSet = useMemo(() => {
    return new Set([
      ...tokenizeKeywords(currentProductTitle),
      ...tokenizeKeywords(currentProductDescription),
    ]);
  }, [currentProductDescription, currentProductTitle]);

  const allowOuterRecommendedCarouselDrag = (
    _emblaApi: unknown,
    event: MouseEvent | TouchEvent,
  ) => {
    const target = event.target;
    if (!(target instanceof Element)) return true;
    return !target.closest('[data-bundle-carousel]');
  };

  return (
    <div className="recommended-products">
      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={products}>
          {(response) => {
            const allProducts = response?.products.nodes ?? [];
            const filteredProducts = allProducts
              .map((product) => {
                const matchesType = isVideo
                  ? hasVideoTag(product.tags)
                  : !hasVideoTag(product.tags);
                if (!matchesType || product.id === currentProductID) {
                  return null;
                }

                const productKeywordSet = new Set([
                  ...tokenizeKeywords(product.title),
                  ...tokenizeKeywords((product as {description?: string | null}).description),
                ]);
                const sharedKeywordCount = getSharedKeywordCount(
                  currentProductKeywordSet,
                  productKeywordSet,
                );

                // For videos: require at least one shared keyword (existing behaviour).
                // For prints: always include — keyword score just controls sort order,
                // so we fall back to any print when nothing matches closely.
                if (isVideo && currentProductKeywordSet.size > 0 && sharedKeywordCount <= 0) {
                  return null;
                }

                return {product, sharedKeywordCount};
              })
              .filter(
                (
                  entry,
                ): entry is {
                  product: (typeof allProducts)[number];
                  sharedKeywordCount: number;
                } => entry !== null,
              )
              .sort((a, b) => b.sharedKeywordCount - a.sharedKeywordCount)
              .map((entry) => entry.product);

            const effectiveSlidesPerView = Math.max(
              1,
              Math.min(computedSlidesPerView, filteredProducts.length || 1),
            );
            const shouldLoop = filteredProducts.length > 1;
            const simpleRecommendedCardGapPx = 12;
            const halfSimpleRecommendedCardGapPx =
              simpleRecommendedCardGapPx / 2;
            const effectiveSlidePercent = 100 / effectiveSlidesPerView;
            const effectiveSlideStyle = {
              flex: `0 0 ${effectiveSlidePercent}%`,
              maxWidth: `${effectiveSlidePercent}%`,
              boxSizing: 'border-box' as const,
              paddingLeft: `${halfSimpleRecommendedCardGapPx}px`,
              paddingRight: `${halfSimpleRecommendedCardGapPx}px`,
            };

            return (
              <div className="recommended-products-grid-simple  gap-y-5 mt-5">
                {filteredProducts.length > 0 ? (
                  <div className="w-full max-w-full min-w-0 box-border flex justify-center px-1">
                    <Carousel
                      className="you-may-like-carousel w-full max-w-full min-w-0 box-border px-6"
                      style={{width: '100%'}}
                      opts={{
                        loop: shouldLoop,
                        align: 'start',
                        slidesToScroll: 1,
                        watchDrag: allowOuterRecommendedCarouselDrag,
                      }}
                    >
                      <CarouselContent className="!flex !items-stretch !justify-start mx-[5px]">
                        {filteredProducts.map((product) => {
                          const isInWishlist = wishlistProducts.includes(
                            product.id,
                          );
                          return (
                            <CarouselItem
                              key={product.id}
                              className="flex items-stretch min-w-0"
                              style={effectiveSlideStyle}
                            >
                              <div className="w-full h-full min-w-0 you-may-like-slide-card">
                                {isVideo ? (
                                  <EProductsContainer
                                    product={product as any}
                                    layout="list"
                                    cart={cart}
                                    isInWishlist={isInWishlist}
                                    isLoggedIn={isLoggedInPromise}
                                    compactListMaxViewportWidth={713}
                                    compactHighlightGlow
                                    forceCardPreviewViewportAutoplay
                                    disableFocusWithinHighlight
                                  />
                                ) : (
                                  <ProductCarousel
                                    product={product as any}
                                    layout="list"
                                    isInWishlist={isInWishlist}
                                    isLoggedIn={isLoggedInPromise}
                                    compactHighlightGlow
                                    disableFocusWithinHighlight
                                    renderContext="you-may-also-like"
                                  />
                                )}
                              </div>
                            </CarouselItem>
                          );
                        })}
                      </CarouselContent>
                      <CarouselPrevious
                        variant="secondary"
                        className="!left-0 z-50 bg-background/95 border border-border"
                      />
                      <CarouselNext
                        variant="secondary"
                        className="!right-0 z-50 bg-background/95 border border-border"
                      />
                    </Carousel>
                  </div>
                ) : null}
              </div>
            );
          }}
        </Await>
      </Suspense>
    </div>
  );
}

export default SimpleRecommendedProducts;
