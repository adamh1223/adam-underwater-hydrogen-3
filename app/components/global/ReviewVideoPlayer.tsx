import React, {useEffect, useRef, useState} from 'react';

interface ReviewVideoPlayerProps {
  src?: string;
  className?: string;
}

const ReviewVideoPlayer = ({src, className}: ReviewVideoPlayerProps) => {
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
    <video
      ref={videoRef}
      className={className}
      controls
      playsInline
      preload="metadata"
      crossOrigin="anonymous"
      poster={poster}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
};

export default ReviewVideoPlayer;
