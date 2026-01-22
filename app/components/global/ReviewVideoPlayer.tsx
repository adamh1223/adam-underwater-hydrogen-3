import React from 'react';

interface ReviewVideoPlayerProps {
  src?: string;
  className?: string;
}

const ReviewVideoPlayer = ({src, className}: ReviewVideoPlayerProps) => {
  if (!src) return null;

  return (
    <iframe
      className={className}
      src={src}
      title="Review video player"
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
    />
  );
};

export default ReviewVideoPlayer;
