import {useState, useRef, useEffect} from 'react';
import '../../styles/components/EProductPreview.css';
import {ProductItemFragment} from 'storefrontapi.generated';
import {redirect} from '@remix-run/server-runtime';
import {Link, useLocation} from '@remix-run/react';

type shopifyImage = {url: string; altText: string};

function EProductPreview({
  EProduct,
  extraClassName,
  layout
}: {
  EProduct: ProductItemFragment & {images: {nodes: shopifyImage[]}};
  extraClassName?: string;
  layout: string;
}) {
  console.log(layout, 'layout');
  
  const [isHovered, setIsHovered] = useState(false);
  const [isAutoplayActive, setIsAutoplayActive] = useState(false);
  const [isSmallViewport, setIsSmallViewport] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoplayTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const videoRevealTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const videoRef = useRef<HTMLIFrameElement>(null);
  const location = useLocation();

  const {featuredImage, id} = EProduct;
  const WMLink = EProduct.tags.filter((tag) => tag.includes('wmlink'))?.[0];
  const parsedWMLink = WMLink?.split('_')[1];
  

  const handleVideoLoad = () => {
    if (videoRevealTimeoutRef.current !== null) {
      clearTimeout(videoRevealTimeoutRef.current);
      videoRevealTimeoutRef.current = null;
    }

    const revealDelayMs = enableViewportAutoplay ? 150 : 0;
    if (revealDelayMs === 0) {
      setIsVideoReady(true);
      return;
    }

    videoRevealTimeoutRef.current = window.setTimeout(() => {
      videoRevealTimeoutRef.current = null;
      setIsVideoReady(true);
    }, revealDelayMs);
  };

  useEffect(() => {
    function handleResize() {
      setIsSmallViewport(window.innerWidth < 500);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isStockFootagePage = location.pathname.startsWith('/collections/stock');
  const enableViewportAutoplay =
    isStockFootagePage && isSmallViewport && layout === 'list';
  const isVideoActive = enableViewportAutoplay ? isAutoplayActive : isHovered;

  useEffect(() => {
    if (isVideoActive) return;
    if (videoRevealTimeoutRef.current !== null) {
      clearTimeout(videoRevealTimeoutRef.current);
      videoRevealTimeoutRef.current = null;
    }
    setIsVideoReady(false);
  }, [isVideoActive]);

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

    const clearAutoplayTimeout = () => {
      if (autoplayTimeoutRef.current === null) return;
      clearTimeout(autoplayTimeoutRef.current);
      autoplayTimeoutRef.current = null;
    };

    const stopAndReset = () => {
      clearAutoplayTimeout();
      setIsAutoplayActive(false);
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (autoplayTimeoutRef.current !== null) return;
        autoplayTimeoutRef.current = window.setTimeout(() => {
          autoplayTimeoutRef.current = null;
          setIsAutoplayActive(true);
        }, 1000);
        return;
      }

      stopAndReset();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      clearAutoplayTimeout();
    };
  }, [enableViewportAutoplay]);

  useEffect(() => {
    return () => {
      if (videoRevealTimeoutRef.current !== null) {
        clearTimeout(videoRevealTimeoutRef.current);
        videoRevealTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`EProductPreviewContainer ${extraClassName || ''}`}
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
          onPointerDown={() => redirect(`/stock/${id}`)}
        />
      )}

      {/* Video overlay */}
      {isVideoActive && parsedWMLink && (
        <div
          className="EProductVideoWrapper"
          onClick={() => redirect(`/products/${EProduct.handle}`)}
        >
          <Link to={`/products/${EProduct.handle}`}>
            <iframe
              ref={videoRef}
              src={`https://player.vimeo.com/video/${parsedWMLink}?autoplay=1&muted=1&background=1&badge=0&autopause=0`}
              allow="autoplay; loop;"
              className={`EProductVideo ${isVideoReady ? 'visible' : ''}`}
              title="Product video"
              onLoad={handleVideoLoad}
              onPointerDown={() => redirect(`/products/${EProduct.handle}`)}
            ></iframe>
          </Link>
        </div>
      )}
    </div>
  );
}

export default EProductPreview;
