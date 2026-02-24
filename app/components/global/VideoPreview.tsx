import {useEffect, useRef, useState} from 'react';
import '../../styles/components/EProductPreview.css';

function VideoPreview({
  src,
  posterSrc,
  mobilePosterSrc,
  isActive,
  posterAlt = 'Video preview image',
  extraClassName,
  revealDelayMs = 250,
  loadFallbackDelayMs = 1500,
}: {
  src: string | number;
  posterSrc: string;
  mobilePosterSrc?: string;
  isActive?: boolean;
  posterAlt?: string;
  extraClassName?: string;
  revealDelayMs?: number;
  loadFallbackDelayMs?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const revealTimeoutRef = useRef<number | null>(null);
  const loadFallbackTimeoutRef = useRef<number | null>(null);

  const isPreviewActive = isActive ?? isHovered;

  const clearRevealTimeout = () => {
    if (revealTimeoutRef.current == null) return;
    window.clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = null;
  };

  const clearLoadFallbackTimeout = () => {
    if (loadFallbackTimeoutRef.current == null) return;
    window.clearTimeout(loadFallbackTimeoutRef.current);
    loadFallbackTimeoutRef.current = null;
  };

  const scheduleReveal = (delayMs: number) => {
    clearRevealTimeout();
    revealTimeoutRef.current = window.setTimeout(() => {
      revealTimeoutRef.current = null;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVideoReady(true));
      });
    }, delayMs);
  };

  const handleVideoLoad = () => {
    clearLoadFallbackTimeout();
    // Wait briefly after iframe load to avoid showing Vimeo's transient black frame.
    scheduleReveal(revealDelayMs);
  };

  useEffect(() => {
    if (!isPreviewActive) {
      clearRevealTimeout();
      clearLoadFallbackTimeout();
      setIsVideoReady(false);
      return;
    }

    // iOS/Safari can occasionally miss iframe onLoad timing; don't leave the
    // preview stuck on the poster forever while hovered.
    clearLoadFallbackTimeout();
    loadFallbackTimeoutRef.current = window.setTimeout(() => {
      loadFallbackTimeoutRef.current = null;
      setIsVideoReady(true);
    }, loadFallbackDelayMs);
  }, [isPreviewActive, loadFallbackDelayMs]);

  useEffect(() => {
    return () => {
      clearRevealTimeout();
      clearLoadFallbackTimeout();
    };
  }, []);

  return (
    <div
      className={`EProductPreviewContainer ${extraClassName || ''}`}
      onMouseEnter={isActive === undefined ? () => setIsHovered(true) : undefined}
      onMouseLeave={isActive === undefined ? () => setIsHovered(false) : undefined}
    >
      {mobilePosterSrc ? (
        <picture className="block h-full w-full">
          <source media="(max-width: 899px)" srcSet={mobilePosterSrc} />
          <img src={posterSrc} alt={posterAlt} className="EProductImage" />
        </picture>
      ) : (
        <img src={posterSrc} alt={posterAlt} className="EProductImage" />
      )}

      {isPreviewActive && (
        <div className="EProductVideoWrapper" aria-hidden="true">
          <iframe
            src={`https://player.vimeo.com/video/${src}?autoplay=1&muted=1&background=1&badge=0&autopause=0&playsinline=1`}
            allow="autoplay; fullscreen; picture-in-picture"
            className={`EProductVideo ${isVideoReady ? 'visible' : ''}`}
            title="Services video preview"
            onLoad={handleVideoLoad}
          />
        </div>
      )}
    </div>
  );
}

export default VideoPreview;
