import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {ProductItemFragment} from 'storefrontapi.generated';
import {useNavigate} from '@remix-run/react';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from '../ui/carousel';
import {Button} from '../ui/button';
import {ChevronLeftIcon, ChevronRightIcon} from 'lucide-react';
import '../../styles/components/EProductPreview.css';
import {getOptimizedImageUrl} from '~/lib/imageWarmup';

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const vimeoPlayReceivedRef = useRef(false);
  const videoRevealTimeoutRef = useRef<number | null>(null);

  const clearRevealTimeout = () => {
    if (videoRevealTimeoutRef.current !== null) {
      window.clearTimeout(videoRevealTimeoutRef.current);
      videoRevealTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (!isVideoActive) {
      clearRevealTimeout();
      vimeoPlayReceivedRef.current = false;
      setIsVideoReady(false);
    }
  }, [isVideoActive]);

  // Listen for Vimeo postMessage to detect actual playback start.
  useEffect(() => {
    if (!isVideoActive || !clip.wmlinkId) return;
    vimeoPlayReceivedRef.current = false;

    const handleMessage = (event: MessageEvent) => {
      if (vimeoPlayReceivedRef.current) return;
      if (
        typeof event.origin !== 'string' ||
        !event.origin.includes('vimeo.com')
      )
        return;
      if (
        !iframeRef.current ||
        event.source !== iframeRef.current.contentWindow
      )
        return;

      let data: any;
      try {
        data =
          typeof event.data === 'string'
            ? JSON.parse(event.data)
            : event.data;
      } catch {
        return;
      }

      if (data.event === 'ready') {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({method: 'addEventListener', value: 'play'}),
          'https://player.vimeo.com',
        );
      } else if (data.event === 'play') {
        vimeoPlayReceivedRef.current = true;
        clearRevealTimeout();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setIsVideoReady(true));
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isVideoActive, clip.wmlinkId]);

  useEffect(() => {
    return () => clearRevealTimeout();
  }, []);

  const handleVideoLoad = () => {
    if (vimeoPlayReceivedRef.current) return;
    // Fallback reveal in case Vimeo postMessage play event never arrives.
    clearRevealTimeout();
    const isCoarsePointer =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const delay = isCoarsePointer ? 3500 : 1000;
    videoRevealTimeoutRef.current = window.setTimeout(() => {
      videoRevealTimeoutRef.current = null;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVideoReady(true));
      });
    }, delay);
  };

  return (
    <div className="EProductPreviewContainer EProductPreviewContainer-autoplay">
      {clip.image && (
        <img
          src={getOptimizedImageUrl(clip.image.url, 1280)}
          srcSet={[480, 720, 960, 1280, 1600]
            .map(
              (width) => `${getOptimizedImageUrl(clip.image.url, width)} ${width}w`,
            )
            .join(', ')}
          sizes="(max-width: 700px) 82vw, (max-width: 1200px) 42vw, 30vw"
          alt={clip.image.altText || 'Bundle preview'}
          className="EProductImage"
          draggable={false}
        />
      )}
      {isVideoActive && clip.wmlinkId && (
        <div className="EProductVideoWrapper pointer-events-none">
          <iframe
            ref={iframeRef}
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
  onNavigate,
}: {
  product: ProductItemFragment & {images: {nodes: ShopifyImage[]}};
  onSlideChange?: (clipIndex: number) => void;
  /**
   * Optional callback for navigation — lets the parent control splash effects.
   * Receives the closest `[data-slot="card"]` ancestor so the parent can apply
   * the splash animation class to the card element.
   */
  onNavigate?: (cardElement: HTMLElement | null) => void;
}) {
  const navigate = useNavigate();
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewPointerStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const suppressPreviewTapUntilRef = useRef(0);

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
  const handlePreviewPointerDownCapture = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    previewPointerStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };
  const handlePreviewPointerMoveCapture = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const pointerState = previewPointerStateRef.current;
    if (
      !pointerState ||
      !pointerState.active ||
      pointerState.pointerId !== event.pointerId
    ) {
      return;
    }

    const movedDistance = Math.hypot(
      event.clientX - pointerState.startX,
      event.clientY - pointerState.startY,
    );
    if (movedDistance > 8 && !pointerState.moved) {
      pointerState.moved = true;
      suppressPreviewTapUntilRef.current = performance.now() + 350;
    }
  };
  const endPreviewPointerTracking = (pointerId?: number) => {
    const pointerState = previewPointerStateRef.current;
    if (!pointerState) return;
    if (
      typeof pointerId === 'number' &&
      pointerState.pointerId !== pointerId &&
      pointerState.active
    ) {
      return;
    }
    if (pointerState.moved) {
      suppressPreviewTapUntilRef.current = performance.now() + 350;
    }
    previewPointerStateRef.current = null;
  };
  const handlePreviewClickCapture = (
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    const target = event.target as Element | null;
    if (
      target?.closest('button,a,input,textarea,select,[role="button"]')
    ) {
      return;
    }

    if (performance.now() < suppressPreviewTapUntilRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (onNavigate) {
      const card = (event.currentTarget as HTMLElement)?.closest<HTMLElement>(
        '[data-slot="card"]',
      );
      onNavigate(card);
    } else {
      navigate(`/products/${product.handle}`);
    }
  };
  useEffect(() => {
    if (!onSlideChange) return;
    const activeClip = clips[currentIndex];
    onSlideChange(activeClip?.index ?? 1);
  }, [clips, currentIndex, onSlideChange]);

  return (
    <div
      ref={containerRef}
      data-bundle-carousel
      data-bundle-no-nav
      onPointerDownCapture={handlePreviewPointerDownCapture}
      onPointerMoveCapture={handlePreviewPointerMoveCapture}
      onPointerUpCapture={(event) => endPreviewPointerTracking(event.pointerId)}
      onPointerCancelCapture={(event) =>
        endPreviewPointerTracking(event.pointerId)
      }
      onClickCapture={handlePreviewClickCapture}
    >
      <Carousel
        setApi={setCarouselApi}
        opts={{watchDrag: true}}
        className="eproduct-bundle-preview-carousel w-full max-w-7xl transform-none mb-3 z-50 touch-pan-y"
      >
        <CarouselContent>
          {clips.map((clip, idx) => (
            <CarouselItem
              className="eproduct-bundle-preview-carousel-item flex items-center justify-center overflow-hidden"
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
