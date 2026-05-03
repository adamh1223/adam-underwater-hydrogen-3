import {useState} from 'react';
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

  if (!WMLink) return null;

  return (
    <div className="grid grid-cols-1">
      <div className="grid grid-cols-1 product-carousel-container relative">
        <div className="bundle-detail-carousel individual-video-product-detail-media">
          <div className="bundle-detail-media-frame">
            <div className="bundle-detail-main-media flex items-center justify-center" style={{position: 'relative', overflow: 'hidden'}}>
              <iframe
                className="bundle-detail-iframe"
                src={`https://player.vimeo.com/video/${WMLink}?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1`}
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
                title={productName}
                loading="eager"
                onLoad={() => {
                  setTimeout(() => setPosterVisible(false), 800);
                }}
              />

              {/* Poster covers the Vimeo toolbar while the video loads */}
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
                    opacity: posterVisible ? 1 : 0,
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
