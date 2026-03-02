import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';
import {useCallback, useEffect, useRef, useState} from 'react';
import '../../styles/routeStyles/product.css';
import ThreeDViewModal from '../global/ThreeDViewModal';
import {CarouselZoom} from 'components/ui/shadcn-io/carousel-zoom';
import {Skeleton} from '~/components/ui/skeleton';
import {
  getOptimizedImageUrl,
  hasWarmedImageUrl,
  markWarmedImageUrl,
  warmImageUrls,
} from '~/lib/imageWarmup';

type ProductImageData = {
  url: string;
  altText: string;
  width?: number | null;
  height?: number | null;
};

type WarmImageTarget = {
  originalUrl: string;
  warmUrls: string[];
};

const LANDSCAPE_MAIN_IMAGE_WIDTHS = [640, 960, 1400, 1800];
const VERTICAL_MAIN_IMAGE_WIDTHS = [420, 720, 960, 1400];
const THUMBNAIL_IMAGE_WIDTHS = [120, 180, 240, 320];
const DEFAULT_THUMBNAIL_WIDTH = THUMBNAIL_IMAGE_WIDTHS[1];

function collectWarmImageUrls(images: ProductImageData[]) {
  return Array.from(
    new Set(
      images
        .map((image) => image?.url)
        .filter((url): url is string => typeof url === 'string' && url.length > 0),
    ),
  );
}

function collectAlreadyWarmedImageUrls(images: ProductImageData[]) {
  return new Set(
    collectWarmImageUrls(images).filter((url) => hasWarmedImageUrl(url)),
  );
}

function collectKnownLoadedImageUrls(images: ProductImageData[]) {
  return new Set(
    images
      .map((image) => image?.url)
      .filter((url): url is string => typeof url === 'string' && url.length > 0),
  );
}

function buildSrcSet(url: string, widths: number[]) {
  return widths.map((width) => `${getOptimizedImageUrl(url, width)} ${width}w`).join(', ');
}

function getImageAspectRatio(
  image: ProductImageData,
  fallbackAspectRatio: number,
) {
  if (
    typeof image.width === 'number' &&
    image.width > 0 &&
    typeof image.height === 'number' &&
    image.height > 0
  ) {
    return `${image.width} / ${image.height}`;
  }

  return String(fallbackAspectRatio);
}

function buildCarouselWarmImageTargets(
  landscapeImages: ProductImageData[],
  verticalImages: ProductImageData[],
) {
  const targetMap = new Map<string, Set<string>>();

  const registerTargets = (images: ProductImageData[], mainWidth: number) => {
    images.forEach((image) => {
      const originalUrl = image?.url;
      if (typeof originalUrl !== 'string' || !originalUrl.length) return;

      if (!targetMap.has(originalUrl)) {
        targetMap.set(originalUrl, new Set<string>());
      }

      const warmUrls = targetMap.get(originalUrl);
      warmUrls?.add(getOptimizedImageUrl(originalUrl, mainWidth));
      warmUrls?.add(getOptimizedImageUrl(originalUrl, DEFAULT_THUMBNAIL_WIDTH));
    });
  };

  registerTargets(landscapeImages, LANDSCAPE_MAIN_IMAGE_WIDTHS[1]);
  registerTargets(verticalImages, VERTICAL_MAIN_IMAGE_WIDTHS[1]);

  return Array.from(targetMap.entries()).map(
    ([originalUrl, warmUrls]): WarmImageTarget => ({
      originalUrl,
      warmUrls: Array.from(warmUrls),
    }),
  );
}

function IndividualProduct({
  productName,
  productImages,
  orientation,
  verticalProductImages,
  threeDViewImages,
  allProductImages,
  enableBackgroundImageWarmup,
  initialLoadedImages,
}: {
  productName: string;
  orientation: string;
  productImages: ProductImageData[];
  verticalProductImages: ProductImageData[];
  threeDViewImages: ProductImageData[];
  allProductImages: ProductImageData[];
  enableBackgroundImageWarmup: boolean;
  initialLoadedImages: ProductImageData[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<any>(null);
  const mediaContainerRef = useRef<HTMLDivElement | null>(null);
  const shortcutsInnerRef = useRef<HTMLDivElement | null>(null);
  const [shortcutsOuterWidth, setShortcutsOuterWidth] = useState<number | null>(
    null,
  );
  const [shortcutsItemWidth, setShortcutsItemWidth] = useState<number | null>(
    null,
  );
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 700 : false,
  );

  // Track which image URLs have finished loading (persists across variant switches)
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(() =>
    new Set([
      ...collectAlreadyWarmedImageUrls(allProductImages),
      ...collectKnownLoadedImageUrls(initialLoadedImages),
    ]),
  );
  const handleImageLoaded = useCallback((url: string) => {
    setLoadedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  useEffect(() => {
    setLoadedUrls((prev) => {
      const next = new Set(prev);
      let changed = false;

      collectAlreadyWarmedImageUrls(allProductImages).forEach((url) => {
        if (!next.has(url)) {
          next.add(url);
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [allProductImages]);

  useEffect(() => {
    setLoadedUrls((prev) => {
      const next = new Set(prev);
      let changed = false;

      collectKnownLoadedImageUrls(initialLoadedImages).forEach((url) => {
        if (!next.has(url)) {
          next.add(url);
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [initialLoadedImages]);

  useEffect(() => {
    const handleViewportResize = () => {
      setIsMobileViewport(window.innerWidth < 700);
    };

    window.addEventListener('resize', handleViewportResize);
    handleViewportResize();

    return () => {
      window.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  useEffect(() => {
    if (!enableBackgroundImageWarmup) return;

    const carouselWarmTargets = buildCarouselWarmImageTargets(
      productImages,
      verticalProductImages,
    );
    const carouselOriginalUrls = new Set(
      carouselWarmTargets.map((target) => target.originalUrl),
    );
    const carouselWarmUrls = carouselWarmTargets.flatMap((target) => target.warmUrls);
    const overflowWarmOriginalUrls = collectWarmImageUrls(allProductImages).filter(
      (url) => !carouselOriginalUrls.has(url),
    );
    const overflowWarmUrls = overflowWarmOriginalUrls.map((url) =>
      getOptimizedImageUrl(url, isMobileViewport ? 960 : 1400),
    );
    if (!carouselWarmUrls.length && !overflowWarmUrls.length) return;

    let cancelled = false;

    void (async () => {
      if (carouselWarmUrls.length) {
        await warmImageUrls(carouselWarmUrls, {
          maxConcurrent: isMobileViewport ? 3 : 5,
        });

        if (cancelled) return;

        carouselWarmTargets.forEach((target) => {
          markWarmedImageUrl(target.originalUrl);
        });

        setLoadedUrls((prev) => {
          const next = new Set(prev);
          let changed = false;

          carouselWarmTargets.forEach((target) => {
            if (!next.has(target.originalUrl)) {
              next.add(target.originalUrl);
              changed = true;
            }
          });

          return changed ? next : prev;
        });
      }

      if (!overflowWarmUrls.length) return;

      await warmImageUrls(overflowWarmUrls, {
        maxConcurrent: isMobileViewport ? 2 : 4,
      });

      if (cancelled) return;

      overflowWarmOriginalUrls.forEach((url) => {
        markWarmedImageUrl(url);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    allProductImages,
    enableBackgroundImageWarmup,
    isMobileViewport,
    productImages,
    verticalProductImages,
  ]);

  // Sync active index when carousel changes (via chevrons or user scroll)
  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => {
      setActiveIndex(carouselApi.selectedScrollSnap());
    };
    carouselApi.on('select', onSelect);
    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi]);

  const handleThumbnailClick = (index: number) => {
    if (carouselApi) {
      carouselApi.scrollTo(index); // smooth scroll
    }
    setActiveIndex(index);
  };

  // Reset carousel to first slide
  const resetCarousel = useCallback(() => {
    if (carouselApi) {
      carouselApi.scrollTo(0); // scroll smoothly to first
    }
    setActiveIndex(0); // update blue border
  }, [carouselApi]);

  const orientationImages =
    orientation === 'Landscape' ? productImages : verticalProductImages;
  const zoomItems = orientationImages.map((image) => ({
    url: getOptimizedImageUrl(image.url, 2200),
    type: 'image',
  }));
  const fallbackMainAspectRatio =
    orientation === 'Landscape' ? 4 / 3 : 3 / 4;
  const fallbackThumbnailAspectRatio =
    orientation === 'Landscape' ? 130 / 75 : 90 / 120;
  const mainImageWidths =
    orientation === 'Landscape'
      ? LANDSCAPE_MAIN_IMAGE_WIDTHS
      : VERTICAL_MAIN_IMAGE_WIDTHS;
  const mainImageSizes =
    orientation === 'Landscape'
      ? '(max-width: 699px) 84vw, (max-width: 1023px) 62vw, 46vw'
      : '(max-width: 699px) 72vw, (max-width: 1023px) 46vw, 32vw';
  const thumbnailWidths = THUMBNAIL_IMAGE_WIDTHS;
  const thumbnailSizes =
    orientation === 'Landscape'
      ? '(max-width: 699px) 24vw, 130px'
      : '(max-width: 699px) 18vw, 90px';
  const getThumbnailButtonStyle = useCallback(
    (image: ProductImageData) => ({
      ...(shortcutsItemWidth ? {width: `${shortcutsItemWidth}px`} : {}),
      height: 'auto',
      aspectRatio: getImageAspectRatio(image, fallbackThumbnailAspectRatio),
    }),
    [fallbackThumbnailAspectRatio, shortcutsItemWidth],
  );
  const getMainImageStageStyle = useCallback(
    (image: ProductImageData) => ({
      aspectRatio: getImageAspectRatio(image, fallbackMainAspectRatio),
    }),
    [fallbackMainAspectRatio],
  );

  const recalculateShortcutLayout = useCallback(() => {
    if (orientationImages.length <= 1) {
      setShortcutsOuterWidth(null);
      setShortcutsItemWidth(null);
      return;
    }

    const shortcutsInner = shortcutsInnerRef.current;
    const mediaContainer = mediaContainerRef.current;

    if (!shortcutsInner || !mediaContainer) {
      setShortcutsOuterWidth(null);
      setShortcutsItemWidth(null);
      return;
    }

    const availableWidth = mediaContainer.clientWidth;
    if (!availableWidth) return;

    const computedInnerStyle = window.getComputedStyle(shortcutsInner);
    const gapValue = Number.parseFloat(
      computedInnerStyle.columnGap || computedInnerStyle.gap || '0',
    );
    const gap = Number.isNaN(gapValue) ? 0 : gapValue;

    const firstShortcut = shortcutsInner.querySelector<HTMLButtonElement>(
      '.print-detail-shortcut',
    );
    const shortcutStyle = firstShortcut
      ? window.getComputedStyle(firstShortcut)
      : null;
    const baseWidthVar = shortcutStyle?.getPropertyValue(
      '--print-shortcut-base-width',
    );
    const baseItemWidth = Number.parseFloat(baseWidthVar ?? '');
    const defaultItemWidth =
      Number.isFinite(baseItemWidth) && baseItemWidth > 0
        ? baseItemWidth
        : firstShortcut?.getBoundingClientRect().width || 130;

    const clipCount = orientationImages.length;
    const oneRowWidth = Math.round(
      clipCount * defaultItemWidth + Math.max(0, clipCount - 1) * gap,
    );

    if (oneRowWidth <= availableWidth) {
      setShortcutsOuterWidth(oneRowWidth);
      setShortcutsItemWidth(null);
      return;
    }

    const maxItemsPerRowAtDefault = Math.max(
      1,
      Math.floor((availableWidth + gap) / (defaultItemWidth + gap)),
    );
    const minItemsPerRowForTwoLines = Math.ceil(clipCount / 2);
    const targetItemsPerRow = Math.max(
      maxItemsPerRowAtDefault,
      minItemsPerRowForTwoLines,
    );

    if (targetItemsPerRow <= maxItemsPerRowAtDefault) {
      const targetWidth = Math.round(
        targetItemsPerRow * defaultItemWidth +
          Math.max(0, targetItemsPerRow - 1) * gap,
      );
      setShortcutsOuterWidth(targetWidth);
      setShortcutsItemWidth(null);
      return;
    }

    const fittedItemWidth = Math.max(
      1,
      Math.floor(
        (availableWidth - Math.max(0, targetItemsPerRow - 1) * gap) /
          targetItemsPerRow,
      ),
    );
    const targetWidth = Math.round(
      targetItemsPerRow * fittedItemWidth +
        Math.max(0, targetItemsPerRow - 1) * gap,
    );

    setShortcutsOuterWidth(targetWidth);
    setShortcutsItemWidth(fittedItemWidth);
  }, [orientationImages.length]);

  useEffect(() => {
    recalculateShortcutLayout();

    const mediaContainer = mediaContainerRef.current;
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && mediaContainer
        ? new ResizeObserver(() => {
            recalculateShortcutLayout();
          })
        : null;

    resizeObserver?.observe(mediaContainer as Element);
    window.addEventListener('resize', recalculateShortcutLayout);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', recalculateShortcutLayout);
    };
  }, [recalculateShortcutLayout]);
  // Reset carousel when productImages change
  useEffect(() => {
    resetCarousel();
  }, [orientationImages, resetCarousel]);

  // const threeSixtyCarouselImages = productImages.nodes
  //   .map((image: any) => {
  //     if (image.url?.includes('360-carousel-')) {
  //       return image;
  //     }
  //   })
  //   .filter(Boolean);
  return (
    <>
      <div className="grid grid-cols-1">
        <div
          className="grid grid-cols-1 px-2 product-carousel-container relative"
          ref={mediaContainerRef}
        >
          <CarouselZoom items={zoomItems}>
            {(openAtIndex) => (
              <>
                {orientation === 'Landscape' && (
                  <Carousel
                    className="print-carousel-individual-horizontal mx-3 flex items-center justify-center"
                    key={JSON.stringify(orientationImages)}
                    setApi={setCarouselApi}
                  >
                    <CarouselContent className="flex">
                      {orientationImages.map((url, idx) => (
                        <CarouselItem
                          className="print-carousel-slide flex items-center justify-center"
                          key={url.url}
                        >
                          <div className="flex items-center justify-center w-full">
                            <div
                              className="print-carousel-main-stage"
                              style={getMainImageStageStyle(url)}
                            >
                              {!loadedUrls.has(url.url) && (
                                <Skeleton className="absolute inset-0 rounded-lg" />
                              )}
                              <button
                                type="button"
                                className={`print-carousel-image-trigger ${loadedUrls.has(url.url) ? '' : 'invisible'}`}
                                onClick={() => openAtIndex(idx)}
                                aria-label={`Open image ${idx + 1} in zoom carousel`}
                              >
                                <img
                                  src={getOptimizedImageUrl(url.url, mainImageWidths[1])}
                                  srcSet={buildSrcSet(url.url, mainImageWidths)}
                                  sizes={mainImageSizes}
                                  alt={url.altText || productName}
                                  loading={idx === 0 ? 'eager' : 'lazy'}
                                  decoding="async"
                                  onLoad={() => handleImageLoaded(url.url)}
                                  className="print-carousel-main-image carousel-item cursor-zoom-in"
                                  {...{'fetchpriority': idx === 0 ? 'high' : 'auto'}}
                                />
                              </button>
                            </div>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>

                    <CarouselPrevious />
                    <CarouselNext />
                  </Carousel>
                )}
                {orientation === 'Vertical' && (
                  <Carousel
                    className="print-carousel-individual-vertical mx-3 flex items-center justify-center"
                    key={JSON.stringify(orientationImages)}
                    setApi={setCarouselApi}
                  >
                    <CarouselContent className="flex">
                      {orientationImages.map((url, idx) => (
                        <CarouselItem
                          className="print-carousel-slide flex items-center justify-center"
                          key={url.url}
                        >
                          <div className="flex items-center justify-center w-full">
                            <div
                              className="print-carousel-main-stage"
                              style={getMainImageStageStyle(url)}
                            >
                              {!loadedUrls.has(url.url) && (
                                <Skeleton className="absolute inset-0 rounded-lg" />
                              )}
                              <button
                                type="button"
                                className={`print-carousel-image-trigger ${loadedUrls.has(url.url) ? '' : 'invisible'}`}
                                onClick={() => openAtIndex(idx)}
                                aria-label={`Open image ${idx + 1} in zoom carousel`}
                              >
                                <img
                                  src={getOptimizedImageUrl(url.url, mainImageWidths[1])}
                                  srcSet={buildSrcSet(url.url, mainImageWidths)}
                                  sizes={mainImageSizes}
                                  alt={url.altText || productName}
                                  className="print-carousel-main-image carousel-item cursor-zoom-in"
                                  loading={idx === 0 ? 'eager' : 'lazy'}
                                  decoding="async"
                                  onLoad={() => handleImageLoaded(url.url)}
                                  {...{'fetchpriority': idx === 0 ? 'high' : 'auto'}}
                                />
                              </button>
                            </div>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>

                    <CarouselPrevious />
                    <CarouselNext />
                  </Carousel>
                )}
              </>
            )}
          </CarouselZoom>

          {orientation === 'Landscape' && (
            <div
              className="print-detail-shortcuts-outer print-detail-shortcuts-outer-horizontal"
              style={
                shortcutsOuterWidth ? {width: `${shortcutsOuterWidth}px`} : undefined
              }
            >
              <div className="print-detail-shortcuts-inner" ref={shortcutsInnerRef}>
                {orientationImages.map((url, idx) => (
                  <button
                    type="button"
                    key={url.url}
                    className={`print-detail-shortcut relative overflow-hidden cursor-pointer border-2 ${
                      idx === activeIndex ? 'border-[hsl(var(--primary))]' : ''
                    }`}
                    style={getThumbnailButtonStyle(url)}
                    onClick={() => handleThumbnailClick(idx)}
                    aria-label={`Go to image ${idx + 1}`}
                  >
                    {!loadedUrls.has(url.url) && (
                      <Skeleton className="absolute inset-0 rounded-sm" />
                    )}
                    <img
                      src={getOptimizedImageUrl(url.url, thumbnailWidths[1])}
                      srcSet={buildSrcSet(url.url, thumbnailWidths)}
                      sizes={thumbnailSizes}
                      alt={url.altText || `${productName} thumbnail ${idx + 1}`}
                      className={`print-detail-shortcut-image ${!loadedUrls.has(url.url) ? 'invisible' : ''}`}
                      loading={idx < 4 ? 'eager' : 'lazy'}
                      decoding="async"
                      onLoad={() => handleImageLoaded(url.url)}
                      {...{'fetchpriority': idx < 2 ? 'high' : 'auto'}}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          {orientation === 'Vertical' && (
            <div
              className="print-detail-shortcuts-outer print-detail-shortcuts-outer-vertical"
              style={
                shortcutsOuterWidth ? {width: `${shortcutsOuterWidth}px`} : undefined
              }
            >
              <div className="print-detail-shortcuts-inner" ref={shortcutsInnerRef}>
                {orientationImages.map((url, idx) => (
                  <button
                    type="button"
                    key={url.url}
                    className={`print-detail-shortcut print-detail-shortcut-vertical relative overflow-hidden cursor-pointer border-2 ${
                      idx === activeIndex ? 'border-[hsl(var(--primary))]' : ''
                    }`}
                    style={getThumbnailButtonStyle(url)}
                    onClick={() => handleThumbnailClick(idx)}
                    aria-label={`Go to image ${idx + 1}`}
                  >
                    {!loadedUrls.has(url.url) && (
                      <Skeleton className="absolute inset-0 rounded-sm" />
                    )}
                    <img
                      src={getOptimizedImageUrl(url.url, thumbnailWidths[1])}
                      srcSet={buildSrcSet(url.url, thumbnailWidths)}
                      sizes={thumbnailSizes}
                      alt={url.altText || `${productName} thumbnail ${idx + 1}`}
                      className={`print-detail-shortcut-image ${!loadedUrls.has(url.url) ? 'invisible' : ''}`}
                      loading={idx < 4 ? 'eager' : 'lazy'}
                      decoding="async"
                      onLoad={() => handleImageLoaded(url.url)}
                      {...{'fetchpriority': idx < 2 ? 'high' : 'auto'}}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          {threeDViewImages.length > 1 && (
            <div className="flex justify-center mt-3 mb-5">
              <div className="w-64 h-18 flex justify-center">
                <ThreeDViewModal images={threeDViewImages} />
              </div>
            </div>
          )}

          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
    </>
  );
}

export default IndividualProduct;
