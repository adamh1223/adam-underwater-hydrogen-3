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

    const handleLoadedData = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        setPoster(canvas.toDataURL('image/jpeg'));
      } catch (error) {
        setPoster(undefined);
      }
    };

    video.addEventListener('loadeddata', handleLoadedData);
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [src]);

  if (!src) return null;

  return (
    <video
      ref={videoRef}
      className={className}
      controls
      playsInline
      preload="auto"
      crossOrigin="anonymous"
      poster={poster}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
};

export default ReviewVideoPlayer;
