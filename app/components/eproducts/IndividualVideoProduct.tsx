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
  const [posterVisible, setPosterVisible] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!WMLink) return;
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
          // Player is initialised — register for play event and request 4K
          // immediately, with no arbitrary delay.
          post('addEventListener', 'play');
          post('addEventListener', 'timeupdate');
          post('setQuality', '2160p');
        } else if (data.event === 'play' || data.event === 'timeupdate') {
          dismiss();
        }
      } catch {}
    }

    window.addEventListener('message', onMessage);
    // Safety fallback so the poster can never get permanently stuck
    const fallback = setTimeout(dismiss, 6000);

    return () => {
      dismissed = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(fallback);
    };
  }, [WMLink]);

  if (!WMLink) return null;

  return (
    <div className="grid grid-cols-1">
      <div className="grid grid-cols-1 product-carousel-container relative">
        <div className="bundle-detail-carousel individual-video-product-detail-media">
          <div className="bundle-detail-media-frame">
            <div
              className="bundle-detail-main-media flex items-center justify-center"
              style={{position: 'relative', overflow: 'hidden'}}
            >
              <iframe
                ref={iframeRef}
                className="bundle-detail-iframe"
                src={`https://player.vimeo.com/video/${WMLink}?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1`}
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
                title={productName}
                loading="eager"
              />

              {posterVisible && featuredImage && (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `url(${featuredImage})`,
                    backgroundSize: 'contain',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundColor: 'transparent',
                    pointerEvents: 'none',
                    transition: 'opacity 0.4s ease',
                    opacity: 1,
                    zIndex: 2,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IndividualVideoProduct;
