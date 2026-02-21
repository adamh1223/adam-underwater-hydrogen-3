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
import {ImageZoom} from 'components/ui/shadcn-io/image-zoom';

function IndividualProduct({
  productName,
  productImages,
  orientation,
  verticalProductImages,
  threeDViewImages,
}: {
  productName: string;
  orientation: string;
  productImages: {
    url: string;
    altText: string;
  }[];
  verticalProductImages: {
    url: string;
    altText: string;
  }[];
  threeDViewImages: {
    url: string;
    altText: string;
  }[];
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
  const thumbnailAspectRatio =
    orientation === 'Landscape' ? 75 / 130 : 120 / 90;

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
          {orientation === 'Landscape' && (
            <Carousel
              className="print-carousel-individual-horizontal mx-3 flex items-center justify-center"
              key={JSON.stringify(orientationImages)}
              setApi={setCarouselApi} // get the Embla API
            >
              <CarouselContent className="flex">
                {orientationImages.map((url, idx) => (
                  <CarouselItem
                    className="flex items-center justify-center"
                    key={url.url}
                  >
                    <div className="flex items-center justify-center">
                      {/* <img
                        src={url.url}
                        alt={url.altText || productName}
                        className="max-h-full object-contain carousel-item cursor-zoom-in"
                        onClick={() => handleImageClick(url.url)}
                      /> */}
                      <ImageZoom>
                        <img
                          className="max-h-full object-contain carousel-item cursor-zoom-in"
                          src={url.url}
                          alt={url.altText || productName}
                        />
                      </ImageZoom>
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
              setApi={setCarouselApi} // get the Embla API
            >
              <CarouselContent className="flex">
                {orientationImages.map((url, idx) => (
                  <CarouselItem
                    className="flex items-center justify-center"
                    key={url.url}
                  >
                    <div className="flex items-center justify-center">
                      <ImageZoom>
                        <img
                          src={url.url}
                          alt={url.altText || productName}
                          className="max-h-full object-contain carousel-item cursor-zoom-in"
                        />
                      </ImageZoom>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>

              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          )}

          {orientation === 'Landscape' && (
            <div
              className="print-detail-shortcuts-outer"
              style={
                shortcutsOuterWidth ? {width: `${shortcutsOuterWidth}px`} : undefined
              }
            >
              <div className="print-detail-shortcuts-inner" ref={shortcutsInnerRef}>
                {orientationImages.map((url, idx) => (
                  <button
                    type="button"
                    key={url.url}
                    className={`print-detail-shortcut cursor-pointer border-2 ${
                      idx === activeIndex ? 'border-[hsl(var(--primary))]' : ''
                    }`}
                    style={
                      shortcutsItemWidth
                        ? {
                            width: `${shortcutsItemWidth}px`,
                            height: `${Math.round(shortcutsItemWidth * thumbnailAspectRatio)}px`,
                          }
                        : undefined
                    }
                    onClick={() => handleThumbnailClick(idx)}
                    aria-label={`Go to image ${idx + 1}`}
                  >
                    <img
                      src={url.url}
                      alt={url.altText || `${productName} thumbnail ${idx + 1}`}
                      className="print-detail-shortcut-image"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          {orientation === 'Vertical' && (
            <div
              className="print-detail-shortcuts-outer"
              style={
                shortcutsOuterWidth ? {width: `${shortcutsOuterWidth}px`} : undefined
              }
            >
              <div className="print-detail-shortcuts-inner" ref={shortcutsInnerRef}>
                {orientationImages.map((url, idx) => (
                  <button
                    type="button"
                    key={url.url}
                    className={`print-detail-shortcut print-detail-shortcut-vertical cursor-pointer border-2 ${
                      idx === activeIndex ? 'border-[hsl(var(--primary))]' : ''
                    }`}
                    style={
                      shortcutsItemWidth
                        ? {
                            width: `${shortcutsItemWidth}px`,
                            height: `${Math.round(shortcutsItemWidth * thumbnailAspectRatio)}px`,
                          }
                        : undefined
                    }
                    onClick={() => handleThumbnailClick(idx)}
                    aria-label={`Go to image ${idx + 1}`}
                  >
                    <img
                      src={url.url}
                      alt={url.altText || `${productName} thumbnail ${idx + 1}`}
                      className="print-detail-shortcut-image"
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
