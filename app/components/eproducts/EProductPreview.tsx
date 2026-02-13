import {useState, useRef, useEffect} from 'react';
import '../../styles/components/EProductPreview.css';
import {ProductItemFragment} from 'storefrontapi.generated';
import {useLocation} from '@remix-run/react';

type ShopifyImage = {url: string; altText: string};

function EProductPreview({
  EProduct,
  extraClassName,
  layout: _layout,
}: {
  EProduct: ProductItemFragment & {images: {nodes: ShopifyImage[]}};
  extraClassName?: string;
  layout: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isAutoplayActive, setIsAutoplayActive] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoplayTimeoutRef = useRef<number | null>(null);
  const videoRevealTimeoutRef = useRef<number | null>(null);
  const videoLoadFallbackTimeoutRef = useRef<number | null>(null);
  const location = useLocation();

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
    if (!enableViewportAutoplay) {
      setIsVideoReady(true);
      return;
    }

    // iOS Safari can occasionally fail to fire `onLoad` reliably for cross-origin
    // iframes. Ensure any mount-time fallback is cleared once we do load.
    clearVideoLoadFallbackTimeout();

    // Reveal shortly after load to avoid the 1-frame "shrink/grow" glitch that
    // can occur on real iOS devices when the iframe first paints video.
    const isCoarsePointer =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    scheduleVideoReveal(isCoarsePointer ? 2000 : 200);
  };

  const isStockFootagePage = location.pathname.startsWith('/collections/stock');
  const enableViewportAutoplay = isStockFootagePage;
  const isVideoActive = enableViewportAutoplay ? isAutoplayActive : isHovered;

  useEffect(() => {
    if (!enableViewportAutoplay || !isVideoActive) return;

    // Fallback: if the iframe never fires `onLoad` on iOS, don't leave the
    // overlay permanently hidden.
    clearVideoLoadFallbackTimeout();
    videoLoadFallbackTimeoutRef.current = window.setTimeout(() => {
      videoLoadFallbackTimeoutRef.current = null;
      setIsVideoReady(true);
    }, 1500);

    return () => clearVideoLoadFallbackTimeout();
  }, [enableViewportAutoplay, isVideoActive]);

  useEffect(() => {
    if (isVideoActive) return;
    clearVideoRevealTimeout();
    clearVideoLoadFallbackTimeout();
    setIsVideoReady(false);
  }, [isVideoActive]);

  useEffect(() => {
    return () => {
      clearVideoRevealTimeout();
      clearVideoLoadFallbackTimeout();
    };
  }, []);

  useEffect(() => {
    if (enableViewportAutoplay) {
      setIsHovered(false);
    } else {
      setIsAutoplayActive(false);
    }
  }, [enableViewportAutoplay]);

  useEffect(() => {
    if (!enableViewportAutoplay) return;
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
  }, [enableViewportAutoplay]);

  return (
    <div
      ref={containerRef}
      className={`EProductPreviewContainer ${enableViewportAutoplay ? 'EProductPreviewContainer-autoplay' : ''} ${extraClassName || ''}`}
      style={previewAspectRatio ? {aspectRatio: previewAspectRatio} : undefined}
      onMouseEnter={
        enableViewportAutoplay ? undefined : () => setIsHovered(true)
      }
      onMouseLeave={
        enableViewportAutoplay ? undefined : () => setIsHovered(false)
      }
    >
      {/* Base Image */}
      {featuredImage && (
        <img
          src={featuredImage.url}
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
