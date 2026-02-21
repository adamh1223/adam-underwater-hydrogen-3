import {useEffect, useMemo, useRef, useState} from 'react';
import {ProductItemFragment} from 'storefrontapi.generated';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from '../ui/carousel';
import {Button} from '../ui/button';
import {ChevronLeftIcon, ChevronRightIcon} from 'lucide-react';
import '../../styles/components/EProductPreview.css';

type ShopifyImage = {url: string; altText?: string | null};

type BundleClip = {
  index: number;
  image?: ShopifyImage;
  wmlinkId?: string;
};

const wmlinkRegex = /^wmlink(\d+)_/i;
const bundleAltRegex = /bundle(\d+)-/i;

const parseBundleWmlinks = (tags: string[]) =>
  tags
    .map((tag) => {
      const match = tag.match(wmlinkRegex);
      if (!match) return null;
      return {index: Number(match[1]), id: tag.split('_')[1]};
    })
    .filter(
      (item): item is {index: number; id: string} =>
        Boolean(item?.index) && Boolean(item?.id),
    )
    .sort((a, b) => a.index - b.index);

const buildBundleClips = (
  images: ShopifyImage[],
  tags: string[],
): BundleClip[] => {
  const wmlinks = parseBundleWmlinks(tags);
  const imagesByIndex = new Map<number, ShopifyImage>();

  images.forEach((image, index) => {
    if (!image?.altText) return;
    const match = image.altText.match(bundleAltRegex);
    if (!match) return;
    imagesByIndex.set(Number(match[1]), image);
  });

  const clipCount = Math.max(wmlinks.length, imagesByIndex.size, images.length);

  const clips: BundleClip[] = [];
  for (let i = 1; i <= clipCount; i += 1) {
    const wmlinkMatch = wmlinks.find((link) => link.index === i);
    const fallbackImage = images[i - 1];
    const image = imagesByIndex.get(i) ?? fallbackImage;
    if (!image && !wmlinkMatch?.id) continue;
    clips.push({
      index: i,
      image,
      wmlinkId: wmlinkMatch?.id,
    });
  }

  return clips;
};

function BundleClipPreview({
  clip,
  isVideoActive,
}: {
  clip: BundleClip;
  isVideoActive: boolean;
}) {
  const [isVideoReady, setIsVideoReady] = useState(false);

  useEffect(() => {
    if (!isVideoActive) setIsVideoReady(false);
  }, [isVideoActive]);

  const handleVideoLoad = () => {
    requestAnimationFrame(() => setIsVideoReady(true));
  };

  return (
    <div className="EProductPreviewContainer EProductPreviewContainer-autoplay">
      {clip.image && (
        <img
          src={clip.image.url}
          alt={clip.image.altText || 'Bundle preview'}
          className="EProductImage"
        />
      )}
      {isVideoActive && clip.wmlinkId && (
        <div className="EProductVideoWrapper pointer-events-none">
          <iframe
            src={`https://player.vimeo.com/video/${clip.wmlinkId}?autoplay=1&muted=1&background=1&badge=0&autopause=0&playsinline=1`}
            allow="autoplay; fullscreen; picture-in-picture"
            className={`EProductVideo ${isVideoReady ? 'visible' : ''}`}
            title="Bundle clip preview"
            onLoad={handleVideoLoad}
          ></iframe>
        </div>
      )}
    </div>
  );
}

function EProductBundlePreview({
  product,
  onSlideChange,
}: {
  product: ProductItemFragment & {images: {nodes: ShopifyImage[]}};
  onSlideChange?: (clipIndex: number) => void;
}) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const clips = useMemo(
    () => buildBundleClips(product.images.nodes || [], product.tags || []),
    [product.images.nodes, product.tags],
  );

  useEffect(() => {
    if (!carouselApi) return;

    const updateCarouselState = () => {
      setCurrentIndex(carouselApi.selectedScrollSnap());
      setTotalItems(carouselApi.scrollSnapList().length);
      setCanScrollPrev(carouselApi.canScrollPrev());
      setCanScrollNext(carouselApi.canScrollNext());
    };

    updateCarouselState();

    carouselApi.on('select', updateCarouselState);

    return () => void carouselApi.off('select', updateCarouselState);
  }, [carouselApi]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const element = containerRef.current;
    if (!element) return;

    const MIN_INTERSECTION_RATIO = 0.45;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible =
          entry.isIntersecting &&
          entry.intersectionRatio >= MIN_INTERSECTION_RATIO;
        setIsInView(visible);
      },
      {threshold: [MIN_INTERSECTION_RATIO]},
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scrollToIndex = (index: number) => carouselApi?.scrollTo(index);
  const shouldHideDottedCarouselArrowsOnMobile =
    windowWidth != undefined && windowWidth < 500 && totalItems > 1;
  const handlePrevClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!carouselApi || !canScrollPrev) return;
    carouselApi.scrollPrev();
  };
  const handleNextClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!carouselApi || !canScrollNext) return;
    carouselApi.scrollNext();
  };

  useEffect(() => {
    if (!onSlideChange) return;
    const activeClip = clips[currentIndex];
    onSlideChange(activeClip?.index ?? 1);
  }, [clips, currentIndex, onSlideChange]);

  return (
    <div ref={containerRef} data-bundle-carousel>
      <Carousel
        setApi={setCarouselApi}
        opts={{watchDrag: true}}
        className="w-full max-w-7xl transform-none mb-3 z-50 touch-pan-y"
      >
        <CarouselContent>
          {clips.map((clip, idx) => (
            <CarouselItem
              className="flex items-center justify-center"
              key={`bundle-clip-${clip.index}`}
            >
              <div className="product-item w-full">
                <BundleClipPreview
                  clip={clip}
                  isVideoActive={isInView && idx === currentIndex}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {totalItems > 1 && !shouldHideDottedCarouselArrowsOnMobile && (
          <div className="pointer-events-none absolute inset-0 z-[90] flex items-center justify-between mx-[-8px]">
            <Button
              type="button"
              data-bundle-no-nav
              onClick={handlePrevClick}
              className={`pointer-events-auto rounded-full w-7 h-7 p-0 shadow-none cursor-pointer bg-secondary/90 hover:bg-secondary text-white ${canScrollPrev ? '' : 'opacity-55'}`}
              variant="secondary"
              aria-label="Previous slide"
              aria-disabled={!canScrollPrev}
            >
              <ChevronLeftIcon className="h-5 w-5 text-white" />
            </Button>
            <Button
              type="button"
              data-bundle-no-nav
              onClick={handleNextClick}
              className={`pointer-events-auto rounded-full w-7 h-7 p-0 shadow-none cursor-pointer bg-secondary/90 hover:bg-secondary text-white ${canScrollNext ? '' : 'opacity-55'}`}
              variant="secondary"
              aria-label="Next slide"
              aria-disabled={!canScrollNext}
            >
              <ChevronRightIcon className="h-5 w-5 text-white" />
            </Button>
          </div>
        )}
        {totalItems > 1 && (
          <div className="carousel-preview-dots-grid absolute bottom-[-14px] left-0 right-0 pointer-events-none flex items-end justify-center gap-3 h-32 pt-5">
            {Array.from({length: totalItems}).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  scrollToIndex(idx);
                }}
                className={`cursor-pointer pointer-events-auto z-60 h-2 w-2 rounded-full border border-white/60 ${idx === currentIndex ? 'bg-white' : 'bg-white/30'}`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </Carousel>
    </div>
  );
}

export default EProductBundlePreview;
