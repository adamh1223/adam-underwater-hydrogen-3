import {useEffect, useRef, useState} from 'react';
import '../../styles/routeStyles/product.css';

function IndividualVideoProduct({
  productName,
  featuredImage,
  WMLink,
}: {
  productName: string;
  featuredImage: string | undefined;
  WMLink: string | undefined;
}) {
  // Always load the iframe immediately so autoplay is never blocked by
  // a custom tap-to-play overlay.
  const [iframeLoaded] = useState(true);
  const [posterVisible, setPosterVisible] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Dismiss poster once Vimeo signals the video is actually playing
  useEffect(() => {
    if (!WMLink || !iframeLoaded) return;
    let dismissed = false;

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      setPosterVisible(false);
    }

    function post(method: string, value: string) {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({method, value}),
          'https://player.vimeo.com',
        );
      } catch {}
    }

    function onMessage(e: MessageEvent) {
      if (e.origin !== 'https://player.vimeo.com') return;
      try {
        const data = JSON.parse(
          typeof e.data === 'string' ? e.data : '{}',
        ) as {event?: string};
        if (data.event === 'ready') {
          post('addEventListener', 'play');
          post('addEventListener', 'timeupdate');
          post('setQuality', '2160p');
        } else if (data.event === 'play' || data.event === 'timeupdate') {
          dismiss();
        }
      } catch {}
    }

    window.addEventListener('message', onMessage);
    const fallback = setTimeout(dismiss, 6000);

    return () => {
      dismissed = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(fallback);
    };
  }, [WMLink, iframeLoaded]);

  if (!WMLink) return null;

  return (
    <div className="grid grid-cols-1">
      <div className="grid grid-cols-1 product-carousel-container relative">
        <div className="bundle-detail-carousel individual-video-product-detail-media">
          <div className="bundle-detail-media-frame">
            {/* aspect-ratio keeps the container from collapsing on mobile
                before the iframe is loaded */}
            <div
              className="bundle-detail-main-media flex items-center justify-center"
              style={{position: 'relative', overflow: 'hidden', aspectRatio: '16/9'}}
            >
              {iframeLoaded && (
                <iframe
                  ref={iframeRef}
                  className="bundle-detail-iframe"
                  src={`https://player.vimeo.com/video/${WMLink}?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&unmute_button=0`}
                  allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
                  title={productName}
                  loading="eager"
                  style={{opacity: posterVisible ? 0 : 1, transition: 'opacity 0.3s ease'}}
                />
              )}

              {/* Poster — always present so the container always has content. */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: featuredImage ? `url(${featuredImage})` : 'none',
                  backgroundSize: 'contain',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundColor: 'transparent',
                  cursor: 'default',
                  pointerEvents: 'none',
                  transition: 'opacity 0.4s ease',
                  opacity: posterVisible ? 1 : 0,
                  zIndex: 2,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IndividualVideoProduct;
