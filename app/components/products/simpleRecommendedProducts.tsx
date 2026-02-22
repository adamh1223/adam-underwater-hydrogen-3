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

function SimpleRecommendedProducts({
  products,
  isVideo,
  currentProductID,
  cart,
  isLoggedIn,
  wishlistProducts,
}: {
  products: Promise<RecommendedProductsQuery | null>;
  isVideo: boolean;
  currentProductID: string;
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

  return (
    <div className="recommended-products">
      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={products}>
          {(response) => {
            const allProducts = response?.products.nodes ?? [];
            const filteredProducts = allProducts.filter((product) => {
              const hasYouMayAlsoLikeImage = Boolean(
                product.images.nodes[0]?.url?.includes('youmayalsolike'),
              );
              const matchesType = isVideo
                ? product.tags.includes('Video')
                : !product.tags.includes('Video');

              return (
                hasYouMayAlsoLikeImage &&
                matchesType &&
                product.id !== currentProductID
              );
            });

            const effectiveSlidesPerView = Math.max(
              1,
              Math.min(computedSlidesPerView, filteredProducts.length || 1),
            );
            const shouldLoop = filteredProducts.length > 1;
            const effectiveSlidePercent = 100 / effectiveSlidesPerView;
            const effectiveSlideStyle = {
              flex: `0 0 ${effectiveSlidePercent}%`,
              maxWidth: `${effectiveSlidePercent}%`,
            };

            return (
              <div className="recommended-products-grid-simple  gap-y-5 mt-5">
                {filteredProducts.length > 0 ? (
                  <div className="w-full max-w-full min-w-0 box-border flex justify-center px-1">
                    <Carousel
                      className="you-may-like-carousel w-full max-w-full min-w-0 box-border px-8"
                      style={{width: '100%'}}
                      opts={{
                        loop: shouldLoop,
                        align: 'start',
                        slidesToScroll: 1,
                      }}
                    >
                      <CarouselContent className="!flex !items-stretch !justify-start -ml-2">
                        {filteredProducts.map((product) => {
                          const isInWishlist = wishlistProducts.includes(
                            product.id,
                          );
                          return (
                            <CarouselItem
                              key={product.id}
                              className="pl-2 flex items-stretch min-w-0"
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
                                  />
                                ) : (
                                  <ProductCarousel
                                    product={product as any}
                                    layout="list"
                                    isInWishlist={isInWishlist}
                                    isLoggedIn={isLoggedInPromise}
                                  />
                                )}
                              </div>
                            </CarouselItem>
                          );
                        })}
                      </CarouselContent>
                      <CarouselPrevious
                        variant="secondary"
                        className="!left-[-1px] z-50 bg-background/95 border border-border"
                      />
                      <CarouselNext
                        variant="secondary"
                        className="!right-[-2px] z-50 bg-background/95 border border-border"
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
