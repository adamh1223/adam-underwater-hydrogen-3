import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';
import '../../styles/routeStyles/product.css';

type BundleClipImage = {url: string; altText?: string | null};

export type BundleDetailClip = {
  index: number;
  wmlinkId?: string;
  image?: BundleClipImage;
  clipName: string;
  clipLocation?: string;
  descriptionHtml?: string;
};

function IndividualVideoBundle({
  productName,
  clips,
  activeClipIndex = 1,
  onActiveClipChange,
}: {
  productName: string;
  clips: BundleDetailClip[];
  activeClipIndex?: number;
  onActiveClipChange?: (clipIndex: number) => void;
}) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const mediaContainerRef = useRef<HTMLDivElement | null>(null);
  const shortcutsInnerRef = useRef<HTMLDivElement | null>(null);
  const [shortcutsOuterWidth, setShortcutsOuterWidth] = useState<number | null>(
    null,
  );
  const [shortcutsItemWidth, setShortcutsItemWidth] = useState<number | null>(
    null,
  );

  const activeClipArrayIndex = useMemo(() => {
    const matchIndex = clips.findIndex((clip) => clip.index === activeClipIndex);
    return matchIndex >= 0 ? matchIndex : 0;
  }, [clips, activeClipIndex]);

  useEffect(() => {
    if (!carouselApi) return;

    const updateFromCarousel = () => {
      const selectedSnap = carouselApi.selectedScrollSnap();
      setCurrentIndex(selectedSnap);
      onActiveClipChange?.(clips[selectedSnap]?.index ?? 1);
    };

    updateFromCarousel();
    carouselApi.on('select', updateFromCarousel);
    return () => {
      carouselApi.off('select', updateFromCarousel);
    };
  }, [carouselApi, clips, onActiveClipChange]);

  useEffect(() => {
    if (!carouselApi) return;
    if (activeClipArrayIndex === carouselApi.selectedScrollSnap()) return;
    carouselApi.scrollTo(activeClipArrayIndex);
  }, [activeClipArrayIndex, carouselApi]);

  useEffect(() => {
    setCurrentIndex(activeClipArrayIndex);
  }, [activeClipArrayIndex]);

  const handleThumbnailClick = (index: number) => {
    carouselApi?.scrollTo(index);
    setCurrentIndex(index);
    onActiveClipChange?.(clips[index]?.index ?? 1);
  };

  const recalculateShortcutLayout = useCallback(() => {
    if (clips.length <= 1) {
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
      '.bundle-detail-shortcut',
    );
    const shortcutStyle = firstShortcut
      ? window.getComputedStyle(firstShortcut)
      : null;
    const baseWidthVar = shortcutStyle?.getPropertyValue(
      '--bundle-shortcut-base-width',
    );
    const baseItemWidth = Number.parseFloat(baseWidthVar ?? '');
    const defaultItemWidth =
      Number.isFinite(baseItemWidth) && baseItemWidth > 0
        ? baseItemWidth
        : firstShortcut?.getBoundingClientRect().width || 130;

    const clipCount = clips.length;
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

    // Prefer natural wrapping (e.g. 4 -> 3 + 1 -> 2 + 2) and only shrink
    // thumbnail width if needed to keep the layout at two lines max.
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
  }, [clips.length]);

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

  if (!clips.length) return null;

  return (
    <div className="grid grid-cols-1 w-full h-fit lg:self-center">
      <div
        className="grid grid-cols-1 w-full h-fit content-start self-start px-2 product-carousel-container relative"
        ref={mediaContainerRef}
      >
        <Carousel
          className="bundle-detail-carousel"
          key={JSON.stringify(clips.map((clip) => clip.index))}
          setApi={setCarouselApi}
          opts={{watchDrag: true}}
        >
          <div className="bundle-detail-media-frame">
            <CarouselContent className="flex">
              {clips.map((clip) => (
                <CarouselItem
                  className="flex items-center justify-center"
                  key={`bundle-individual-clip-${clip.index}`}
                >
                  <div className="bundle-detail-main-media flex items-center justify-center">
                    {clip.wmlinkId ? (
                      <iframe
                        className="bundle-detail-iframe"
                        src={`https://player.vimeo.com/video/${clip.wmlinkId}?badge=0&autopause=0&player_id=0&app_id=58479`}
                        allow="autoplay; fullscreen; picture-in-picture"
                        title={`${productName} - Clip ${clip.index}`}
                        loading="eager"
                      ></iframe>
                    ) : clip.image?.url ? (
                      <img
                        src={clip.image.url}
                        alt={
                          clip.image.altText ??
                          `${productName} preview ${clip.index}`
                        }
                        className="bundle-detail-image"
                      />
                    ) : (
                      <div className="bundle-detail-empty">
                        Clip {clip.index}
                      </div>
                    )}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious
              className="cursor-pointer z-[80] h-10 w-10 rounded-full border border-border bg-background/80 text-white hover:bg-background"
              style={{left: '-2.5rem'}}
            />
            <CarouselNext
              className="cursor-pointer z-[80] h-10 w-10 rounded-full border border-border bg-background/80 text-white hover:bg-background"
              style={{right: '-2.5rem'}}
            />
          </div>
        </Carousel>

        {clips.length > 1 && (
          <div
            className="bundle-detail-shortcuts-outer"
            style={
              shortcutsOuterWidth
                ? {width: `${shortcutsOuterWidth}px`}
                : undefined
            }
          >
            <div className="bundle-detail-shortcuts-inner" ref={shortcutsInnerRef}>
              {clips.map((clip, idx) => (
                <button
                  type="button"
                  key={`bundle-shortcut-${clip.index}`}
                  className={`cursor-pointer border-2 bundle-detail-shortcut ${
                    idx === currentIndex
                      ? 'border-[hsl(var(--primary))]'
                      : 'border-border'
                  }`}
                  style={
                    shortcutsItemWidth
                      ? {
                          width: `${shortcutsItemWidth}px`,
                          height: `${Math.round((shortcutsItemWidth * 75) / 130)}px`,
                        }
                      : undefined
                  }
                  onClick={() => handleThumbnailClick(idx)}
                  aria-label={`Go to clip ${clip.index}`}
                >
                  {clip.image?.url ? (
                    <img
                      src={clip.image.url}
                      alt={clip.image.altText ?? `Clip ${clip.index} thumbnail`}
                      className="bundle-detail-shortcut-image"
                    />
                  ) : (
                    <span className="text-sm">{clip.index}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default IndividualVideoBundle;
