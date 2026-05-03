import {useState} from 'react';

/**
 * Replaces a Vimeo iframe with a static thumbnail + play button until the
 * user clicks. This defers the ~200 KB Vimeo player bundle entirely, loading
 * it only on demand.
 */
export function VimeoFacade({
  videoId,
  title,
  className = '',
  params = '',
}: {
  videoId: string;
  title: string;
  className?: string;
  params?: string;
}) {
  const [activated, setActivated] = useState(false);

  const src = `https://player.vimeo.com/video/${videoId}?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&dnt=1${params ? `&${params}` : ''}`;

  if (activated) {
    return (
      <iframe
        src={src}
        className={className}
        allow="autoplay; fullscreen; picture-in-picture"
        title={title}
        style={{border: 0}}
      />
    );
  }

  return (
    <button
      aria-label={`Play ${title}`}
      onClick={() => setActivated(true)}
      className={className}
      style={{
        background: '#0a0a0a',
        border: 0,
        padding: 0,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Vimeo thumbnail via their CDN redirect service */}
      <img
        src={`https://vumbnail.com/${videoId}.jpg`}
        alt={title}
        loading="lazy"
        decoding="async"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.85,
        }}
      />
      {/* Play button */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 80 80"
        style={{
          position: 'relative',
          zIndex: 1,
          width: 72,
          height: 72,
          filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.7))',
        }}
        aria-hidden="true"
      >
        <circle cx="40" cy="40" r="38" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.85)" strokeWidth="2" />
        <polygon points="31,24 31,56 58,40" fill="white" />
      </svg>
    </button>
  );
}
