import {useState, useRef, useEffect, useCallback} from 'react';
import '../../styles/components/EProductPreview.css';
import {ProductItemFragment} from 'storefrontapi.generated';
import {useLocation} from '@remix-run/react';
import {getOptimizedImageUrl} from '~/lib/imageWarmup';
import {isStockCollectionPath} from '~/lib/collectionPaths';

const HLS_BASE = 'https://downloads.adamunderwater.com/shared/stock/streaming/hls';

type ShopifyImage = {url: string; altText: string};

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsInstanceRef = useRef<any>(null);
  const location = useLocation();
  const [viewportWidth, setViewportWidth] = useState<number | undefined>(undefined);

  const {featuredImage} = EProduct;

  // HLS folder number (e.g. tag "v35" → "35")
  const hlsIdTag = EProduct.tags.find((tag) => /^v\d+$/i.test(tag.trim()));
  const hlsId = hlsIdTag?.match(/^v(\d+)$/i)?.[1] ?? null;

  const previewAspectRatio =
    featuredImage?.width && featuredImage?.height
      ? `${featuredImage.width} / ${featuredImage.height}`
      : undefined;

  const isStockFootagePage = isStockCollectionPath(location.pathname);
  const isAccountFavoritesPage = location.pathname.startsWith('/account/favorites');
  const isStockListLargeViewport =
    isStockFootagePage &&
    layout === 'list' &&
    viewportWidth != undefined &&
    viewportWidth >= 2242;
  const shouldEnableViewportAutoplay =
    forceViewportAutoplay ||
    ((isStockFootagePage || isAccountFavoritesPage) && !isStockListLargeViewport);
  const isVideoActive = shouldEnableViewportAutoplay ? isAutoplayActive : isHovered;
  const preferredPreviewImageWidth =
    viewportWidth != undefined && viewportWidth < 700 ? 960 : 1440;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const clearVideoRevealTimeout = useCallback(() => {
    if (videoRevealTimeoutRef.current === null) return;
    window.clearTimeout(videoRevealTimeoutRef.current);
    videoRevealTimeoutRef.current = null;
  }, []);

  const scheduleVideoReveal = useCallback(
    (delayMs: number) => {
      clearVideoRevealTimeout();
      videoRevealTimeoutRef.current = window.setTimeout(() => {
        videoRevealTimeoutRef.current = null;
        requestAnimationFrame(() => requestAnimationFrame(() => setIsVideoReady(true)));
      }, delayMs);
    },
    [clearVideoRevealTimeout],
  );

  // Start/stop HLS based on isVideoActive
  useEffect(() => {
    if (!isVideoActive || !hlsId) return;

    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    import('hls.js').then(({default: Hls}) => {
      if (cancelled || !videoRef.current) return;
      const v = videoRef.current;
      const src = `${HLS_BASE}/${hlsId}/master.m3u8`;

      if (Hls.isSupported()) {
        const hls = new Hls({startLevel: -1, capLevelToPlayerSize: true});
        hlsInstanceRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
          if (cancelled) return;
          // Prefer 1080p as starting level for grid card previews
          if (data.levels.length > 0) {
            const idx = data.levels.reduce(
              (best: number, lvl: any, i: number) => {
                const diff = Math.abs(lvl.height - 1080);
                const bestDiff = Math.abs(data.levels[best].height - 1080);
                return diff < bestDiff ? i : best;
              },
              0,
            );
            hls.startLevel = idx;
          }
          v.play().catch(() => {});
        });
      } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = src;
        v.play().catch(() => {});
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
  }, [isVideoActive, hlsId]);

  // Reset reveal state when video deactivates
  useEffect(() => {
    if (isVideoActive) return;
    clearVideoRevealTimeout();
    setIsVideoReady(false);
  }, [isVideoActive, clearVideoRevealTimeout]);

  useEffect(() => {
    return () => clearVideoRevealTimeout();
  }, [clearVideoRevealTimeout]);

  useEffect(() => {
    if (shouldEnableViewportAutoplay) setIsHovered(false);
    else setIsAutoplayActive(false);
  }, [shouldEnableViewportAutoplay]);

  // IntersectionObserver for viewport autoplay — no concurrency limit needed
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

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isInView =
          entry.isIntersecting &&
          entry.intersectionRatio >= MIN_INTERSECTION_RATIO;

        if (isInView) {
          if (autoplayTimeoutRef.current !== null) return;
          autoplayTimeoutRef.current = window.setTimeout(() => {
            autoplayTimeoutRef.current = null;
            setIsAutoplayActive(true);
          }, 1);
          return;
        }

        clearAutoplayTimeout();
        setIsAutoplayActive(false);
      },
      {threshold: [MIN_INTERSECTION_RATIO]},
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      clearAutoplayTimeout();
    };
  }, [shouldEnableViewportAutoplay]);

  const isTouch =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  const handleVideoTimeUpdate = useCallback(() => {
    if (isVideoReady) return;
    scheduleVideoReveal(isTouch ? 130 : 70);
  }, [isVideoReady, isTouch, scheduleVideoReveal]);

  return (
    <div
      ref={containerRef}
      className={`EProductPreviewContainer ${shouldEnableViewportAutoplay ? 'EProductPreviewContainer-autoplay' : ''} ${extraClassName || ''}`}
      style={previewAspectRatio ? {aspectRatio: previewAspectRatio} : undefined}
      onMouseEnter={shouldEnableViewportAutoplay ? undefined : () => setIsHovered(true)}
      onMouseLeave={shouldEnableViewportAutoplay ? undefined : () => setIsHovered(false)}
    >
      {/* Base image */}
      {featuredImage && (
        <img
          src={getOptimizedImageUrl(featuredImage.url, preferredPreviewImageWidth)}
          srcSet={[480, 720, 960, 1280, 1600]
            .map((w) => `${getOptimizedImageUrl(featuredImage.url, w)} ${w}w`)
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
      {isVideoActive && hlsId && (
        <div className="EProductVideoWrapper">
          <video
            ref={videoRef}
            className={`EProductVideo ${isVideoReady ? 'visible' : ''}`}
            playsInline
            muted
            loop
            onTimeUpdate={handleVideoTimeUpdate}
          />
        </div>
      )}
    </div>
  );
}

export default EProductPreview;
