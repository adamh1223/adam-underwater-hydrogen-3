import {useState, useRef, useEffect} from 'react';
import '../../styles/components/EProductPreview.css';
import {ProductItemFragment} from 'storefrontapi.generated';
import {useLocation} from '@remix-run/react';
import {getOptimizedImageUrl} from '~/lib/imageWarmup';
import {isStockCollectionPath} from '~/lib/collectionPaths';

type ShopifyImage = {url: string; altText: string};
const PLAY_FALLBACK_REVEAL_DELAY_MS_DESKTOP = 1400;
const PLAY_FALLBACK_REVEAL_DELAY_MS_TOUCH = 2200;
const PROGRESS_REVEAL_DELAY_MS_DESKTOP = 70;
const PROGRESS_REVEAL_DELAY_MS_TOUCH = 130;

function EProductPreview({
  EProduct,
  extraClassName,
  layout,
  forceViewportAutoplay = false,
}: {
  EProduct: ProductItemFragment & {images: {nodes: ShopifyImage[]}};
  extraClassName?: string;
  layout: string;
  forceViewportAutoplay?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isAutoplayActive, setIsAutoplayActive] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoplayTimeoutRef = useRef<number | null>(null);
  const videoRevealTimeoutRef = useRef<number | null>(null);
  const videoLoadFallbackTimeoutRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const vimeoPlayReceivedRef = useRef(false);
  const vimeoProgressReceivedRef = useRef(false);
  const vimeoProgressEventCountRef = useRef(0);
  const location = useLocation();
  const [viewportWidth, setViewportWidth] = useState<number | undefined>(
    undefined,
  );

  const {featuredImage} = EProduct;
  const WMLink = EProduct.tags.filter((tag) => tag.includes('wmlink'))?.[0];
  const parsedWMLink = WMLink?.split('_')[1];
  const previewAspectRatio =
    featuredImage?.width && featuredImage?.height
      ? `${featuredImage.width} / ${featuredImage.height}`
      : undefined;

  const clearVideoRevealTimeout = () => {
    if (videoRevealTimeoutRef.current === null) return;
    window.clearTimeout(videoRevealTimeoutRef.current);
    videoRevealTimeoutRef.current = null;
  };

  const clearVideoLoadFallbackTimeout = () => {
    if (videoLoadFallbackTimeoutRef.current === null) return;
    window.clearTimeout(videoLoadFallbackTimeoutRef.current);
    videoLoadFallbackTimeoutRef.current = null;
  };

  const scheduleVideoReveal = (delayMs: number) => {
    clearVideoRevealTimeout();
    videoRevealTimeoutRef.current = window.setTimeout(() => {
      videoRevealTimeoutRef.current = null;
      // Defer to the next paint(s) to reduce iOS WebKit's occasional
      // first-frame sizing jitter for cross-origin iframes.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVideoReady(true));
      });
    }, delayMs);
  };

  const handleVideoLoad = () => {
    // If the Vimeo play event already triggered the reveal, nothing more to do.
    if (vimeoPlayReceivedRef.current) return;

    // Clear the last-resort fallback since the iframe at least loaded.
    clearVideoLoadFallbackTimeout();

    // Use onLoad as a delayed fallback in case the Vimeo postMessage play event
    // never arrives (e.g. ad-blocker strips the player JS). The primary reveal
    // path is the postMessage listener that waits for the actual "play" event.
    const isCoarsePointer =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!shouldEnableViewportAutoplay) {
      scheduleVideoReveal(isCoarsePointer ? 2200 : 1200);
    } else {
      scheduleVideoReveal(isCoarsePointer ? 3200 : 1600);
    }
  };

  const isStockFootagePage = isStockCollectionPath(location.pathname);
  const isAccountFavoritesPage =
    location.pathname.startsWith('/account/favorites');
  const isStockListLargeViewport =
    isStockFootagePage &&
    layout === 'list' &&
    viewportWidth != undefined &&
    viewportWidth >= 2242;
  const shouldEnableViewportAutoplay =
    forceViewportAutoplay ||
    ((isStockFootagePage || isAccountFavoritesPage) && !isStockListLargeViewport);
  const isVideoActive = shouldEnableViewportAutoplay
    ? isAutoplayActive
    : isHovered;
  const preferredPreviewImageWidth =
    viewportWidth != undefined && viewportWidth < 700 ? 960 : 1440;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  // Listen for Vimeo Player postMessage events to detect actual playback start.
  // This is the primary reveal path — the video only becomes visible once Vimeo
  // confirms it is playing, which avoids the "shrink/grow" glitch caused by
  // revealing the iframe before the player has rendered its first video frame.
  useEffect(() => {
    if (!isVideoActive || !parsedWMLink) return;
    vimeoPlayReceivedRef.current = false;
    vimeoProgressReceivedRef.current = false;
    vimeoProgressEventCountRef.current = 0;

    const handleMessage = (event: MessageEvent) => {
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
        // Player initialised — ask it to notify us when playback starts.
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({method: 'addEventListener', value: 'play'}),
          'https://player.vimeo.com',
        );
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({method: 'addEventListener', value: 'timeupdate'}),
          'https://player.vimeo.com',
        );
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({method: 'addEventListener', value: 'playProgress'}),
          'https://player.vimeo.com',
        );
      } else if (data.event === 'play') {
        if (vimeoPlayReceivedRef.current) return;
        vimeoPlayReceivedRef.current = true;
        clearVideoRevealTimeout();
        clearVideoLoadFallbackTimeout();
        const isCoarsePointer =
          typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(hover: none) and (pointer: coarse)').matches;
        scheduleVideoReveal(
          isCoarsePointer
            ? PLAY_FALLBACK_REVEAL_DELAY_MS_TOUCH
            : PLAY_FALLBACK_REVEAL_DELAY_MS_DESKTOP,
        );
      } else if (
        (data.event === 'timeupdate' || data.event === 'playProgress') &&
        !vimeoProgressReceivedRef.current
      ) {
        vimeoProgressEventCountRef.current += 1;
        if (vimeoProgressEventCountRef.current < 2) return;
        vimeoProgressReceivedRef.current = true;
        clearVideoRevealTimeout();
        clearVideoLoadFallbackTimeout();
        const isCoarsePointer =
          typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(hover: none) and (pointer: coarse)').matches;
        scheduleVideoReveal(
          isCoarsePointer
            ? PROGRESS_REVEAL_DELAY_MS_TOUCH
            : PROGRESS_REVEAL_DELAY_MS_DESKTOP,
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isVideoActive, parsedWMLink]);

  useEffect(() => {
    if (!shouldEnableViewportAutoplay || !isVideoActive) return;

    // Last-resort fallback: if neither onLoad nor the Vimeo play event arrive
    // (e.g. iOS Safari drops onLoad for cross-origin iframes), reveal after a
    // generous timeout so the card doesn't stay as a static image forever.
    clearVideoLoadFallbackTimeout();
    videoLoadFallbackTimeoutRef.current = window.setTimeout(() => {
      videoLoadFallbackTimeoutRef.current = null;
      if (!vimeoPlayReceivedRef.current) {
        setIsVideoReady(true);
      }
    }, 8000);

    return () => clearVideoLoadFallbackTimeout();
  }, [shouldEnableViewportAutoplay, isVideoActive]);

  useEffect(() => {
    if (isVideoActive) return;
    clearVideoRevealTimeout();
    clearVideoLoadFallbackTimeout();
    vimeoPlayReceivedRef.current = false;
    vimeoProgressReceivedRef.current = false;
    vimeoProgressEventCountRef.current = 0;
    setIsVideoReady(false);
  }, [isVideoActive]);

  useEffect(() => {
    return () => {
      clearVideoRevealTimeout();
      clearVideoLoadFallbackTimeout();
    };
  }, []);

  useEffect(() => {
    if (shouldEnableViewportAutoplay) {
      setIsHovered(false);
    } else {
      setIsAutoplayActive(false);
    }
  }, [shouldEnableViewportAutoplay]);

  useEffect(() => {
    if (!shouldEnableViewportAutoplay) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const element = containerRef.current;
    if (!element) return;

    const MIN_INTERSECTION_RATIO = 0.5;

    const clearAutoplayTimeout = () => {
      if (autoplayTimeoutRef.current === null) return;
      window.clearTimeout(autoplayTimeoutRef.current);
      autoplayTimeoutRef.current = null;
    };

    const stopAndReset = () => {
      clearAutoplayTimeout();
      setIsAutoplayActive(false);
    };

    const observer = new IntersectionObserver(([entry]) => {
      const isInView =
        entry.isIntersecting && entry.intersectionRatio >= MIN_INTERSECTION_RATIO;
      if (isInView) {
	        if (autoplayTimeoutRef.current !== null) return;
	        autoplayTimeoutRef.current = window.setTimeout(() => {
	          autoplayTimeoutRef.current = null;
	          setIsAutoplayActive(true);
	        }, 1);
	        return;
	      }

      stopAndReset();
    }, {threshold: [MIN_INTERSECTION_RATIO]});

    observer.observe(element);

    return () => {
      observer.disconnect();
      clearAutoplayTimeout();
    };
  }, [shouldEnableViewportAutoplay]);

  return (
    <div
      ref={containerRef}
      className={`EProductPreviewContainer ${shouldEnableViewportAutoplay ? 'EProductPreviewContainer-autoplay' : ''} ${extraClassName || ''}`}
      style={previewAspectRatio ? {aspectRatio: previewAspectRatio} : undefined}
      onMouseEnter={
        shouldEnableViewportAutoplay ? undefined : () => setIsHovered(true)
      }
      onMouseLeave={
        shouldEnableViewportAutoplay ? undefined : () => setIsHovered(false)
      }
    >
      {/* Base Image */}
      {featuredImage && (
        <img
          src={getOptimizedImageUrl(
            featuredImage.url,
            preferredPreviewImageWidth,
          )}
          srcSet={[480, 720, 960, 1280, 1600]
            .map(
              (width) =>
                `${getOptimizedImageUrl(featuredImage.url, width)} ${width}w`,
            )
            .join(', ')}
          sizes={
            layout === 'grid'
              ? '(max-width: 700px) 82vw, (max-width: 1200px) 42vw, 30vw'
              : '(max-width: 900px) 92vw, 52vw'
          }
          alt={featuredImage.altText || 'Product image'}
          className="EProductImage"
          width={featuredImage.width ?? undefined}
          height={featuredImage.height ?? undefined}
        />
      )}

      {/* Video overlay */}
      {isVideoActive && parsedWMLink && (
        <div className="EProductVideoWrapper">
	          <iframe
	            ref={iframeRef}
	            src={`https://player.vimeo.com/video/${parsedWMLink}?autoplay=1&muted=1&background=1&badge=0&autopause=0&playsinline=1`}
	            allow="autoplay; fullscreen; picture-in-picture"
	            className={`EProductVideo ${isVideoReady ? 'visible' : ''}`}
	            title="Product video"
	            onLoad={handleVideoLoad}
	          ></iframe>
	        </div>
      )}
    </div>
  );
}

export default EProductPreview;
