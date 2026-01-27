import React, {useEffect, useRef, useState} from 'react';
import {PlayIcon} from 'lucide-react';

interface ReviewVideoPlayerProps {
  src?: string;
  className?: string;
  showControls?: boolean;
  showPlayOverlay?: boolean;
  onPlayClick?: () => void;
}

const ReviewVideoPlayer = ({
  src,
  className,
  showControls = true,
  showPlayOverlay = false,
  onPlayClick,
}: ReviewVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [poster, setPoster] = useState<string | undefined>();

  useEffect(() => {
    setPoster(undefined);
    const video = videoRef.current;
    if (!video || !src) return;

    let didCapture = false;
    const captureFrame = () => {
      if (didCapture || !video.videoWidth || !video.videoHeight) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        setPoster(canvas.toDataURL('image/jpeg'));
        didCapture = true;
      } catch (error) {
        setPoster(undefined);
      }
    };

    const handleLoadedData = () => {
      captureFrame();
    };

    const handleLoadedMetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        const targetTime = Math.min(0.1, video.duration / 2);
        try {
          video.currentTime = targetTime;
        } catch (error) {
          captureFrame();
        }
      }
    };

    const handleSeeked = () => {
      captureFrame();
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, [src]);

  if (!src) return null;

  return (
    <div className="relative">
      <video
        ref={videoRef}
        className={showControls ? className : `${className ?? ''} pointer-events-none`}
        controls={showControls}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        poster={poster}
      >
        <source src={`${src}#t=0.001`} type="video/mp4" />
      </video>
      {showPlayOverlay && (
        <button
          type="button"
          onClick={onPlayClick}
          className="cursor-pointer absolute inset-0 flex items-center justify-center rounded bg-black/20 text-white transition hover:bg-black/40"
          aria-label="Play video"
        >
          <PlayIcon className="h-14 w-14" />
        </button>
      )}
    </div>
  );
};

export default ReviewVideoPlayer;
