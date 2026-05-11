import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
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

const clipTagRegex = /^clip(\d+)[-_](\d+)$/i;
const bundleAltRegex = /bundle(\d+)-/i;
const HLS_BASE = 'https://downloads.adamunderwater.com/shared/stock/streaming/hls';

const parseBundleClipTags = (tags: string[]) =>
  tags
    .map((tag) => {
      const match = tag.match(clipTagRegex);
      if (!match) return null;
      return {index: Number(match[1]), id: match[2]};
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
  const wmlinks = parseBundleClipTags(tags);
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsInstanceRef = useRef<any>(null);
  const readyFiredRef = useRef(false);

  // Start/stop HLS based on isVideoActive
  useEffect(() => {
    if (!isVideoActive || !clip.wmlinkId) return;

    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    import('hls.js').then(({default: Hls}) => {
      if (cancelled || !videoRef.current) return;
      const v = videoRef.current;
      const src = `${HLS_BASE}/${clip.wmlinkId}/master.m3u8`;

      if (Hls.isSupported()) {
        const hls = new Hls({
          startLevel: -1,          // overridden in MANIFEST_PARSED
          capLevelToPlayerSize: true, // card is small — no need for 4K
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          backBufferLength: 10,
        });
        hlsInstanceRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(v);

        hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
          if (cancelled) return;
          // Pin first segment to 480p — small enough to buffer instantly,
          // avoids the ABR start-low-then-jump-high freeze pattern.
          // capLevelToPlayerSize keeps quality sensible after the first segment.
          if (data.levels.length > 0) {
            const idx = data.levels.reduce(
              (best: number, lvl: any, i: number) =>
                Math.abs(lvl.height - 480) < Math.abs(data.levels[best].height - 480)
                  ? i : best,
              0,
            );
            hls.startLevel = idx;
          }
        });

        // Only play once a full segment is in the buffer — prevents the
        // play-then-freeze pattern caused by calling play() on an empty buffer.
        let playTriggered = false;
        hls.on(Hls.Events.FRAG_BUFFERED, (_: any, data: any) => {
          if (playTriggered || cancelled || typeof data.frag.sn !== 'number') return;
          playTriggered = true;
          v.play().catch(() => {});
        });
      } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = src;
        v.addEventListener('canplay', () => { if (!cancelled) v.play().catch(() => {}); }, {once: true});
      }
    });

    return () => {
      cancelled = true;
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [isVideoActive, clip.wmlinkId]);

  // Reset when deactivated
  useEffect(() => {
    if (isVideoActive) return;
    readyFiredRef.current = false;
    setIsVideoReady(false);
  }, [isVideoActive]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || readyFiredRef.current || v.currentTime === 0) return;
    readyFiredRef.current = true;
    requestAnimationFrame(() => requestAnimationFrame(() => setIsVideoReady(true)));
  };

  const previewImage = clip.image;

  return (
    <div className="EProductPreviewContainer EProductPreviewContainer-autoplay">
      {previewImage && (
        <img
          src={getOptimizedImageUrl(previewImage.url, 1280)}
          srcSet={[480, 720, 960, 1280, 1600]
            .map((width) => `${getOptimizedImageUrl(previewImage.url, width)} ${width}w`)
            .join(', ')}
          sizes="(max-width: 700px) 82vw, (max-width: 1200px) 42vw, 30vw"
          alt={previewImage.altText || 'Bundle preview'}
          className="EProductImage"
          draggable={false}
        />
      )}
      {isVideoActive && clip.wmlinkId && (
        <div className="EProductVideoWrapper">
          <video
            ref={videoRef}
            className={`EProductVideo ${isVideoReady ? 'visible' : ''}`}
            playsInline
            muted
            loop
            onTimeUpdate={handleTimeUpdate}
          />
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
