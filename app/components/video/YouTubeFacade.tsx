import {useState} from 'react';

/**
 * Shows a YouTube thumbnail + play button. The iframe only loads when the
 * user clicks, keeping the initial page free of the YouTube player bundle.
 *
 * Usage:
 *   <YouTubeFacade videoId="dQw4w9WgXcQ" title="My Video" className="clip" />
 *
 * Finding your video ID:
 *   YouTube Studio: https://studio.youtube.com/video/VIDEO_ID/edit
 *   Watch page:     https://www.youtube.com/watch?v=VIDEO_ID
 */
export function YouTubeFacade({
  videoId,
  title,
  className = '',
  vertical = false,
  thumbnailUrl,
  showTitle = false,
}: {
  videoId: string;
  title: string;
  className?: string;
  /** true for YouTube Shorts (9:16 vertical) */
  vertical?: boolean;
  /** Override the auto-generated YouTube thumbnail with a custom image URL */
  thumbnailUrl?: string;
  /** Show the title above the video (used for Shorts) */
  showTitle?: boolean;
}) {
  const [activated, setActivated] = useState(false);

  // rel=0: no related videos  modestbranding=1: minimal YouTube branding
  const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;

  const resolvedThumbnail = thumbnailUrl
    ?? `https://img.youtube.com/vi/${videoId}/${vertical ? 'hqdefault' : 'maxresdefault'}.jpg`;

  const titleEl = showTitle ? (
    <p style={{margin: '0 0 8px 0', textAlign: 'center', fontSize: '1.05rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)'}}>
      {title}
    </p>
  ) : null;

  if (activated) {
    return (
      <div style={{display: 'flex', flexDirection: 'column'}}>
        {titleEl}
        <iframe
          src={src}
          className={className}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          title={title}
          style={{border: 0}}
        />
      </div>
    );
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column'}}>
      {titleEl}
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
        <img
          src={resolvedThumbnail}
          alt={title}
          loading="lazy"
          decoding="async"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
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
    </div>
  );
}
