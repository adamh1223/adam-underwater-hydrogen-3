import React, {useCallback, useEffect, useRef, useState} from 'react';

import '../../styles/components/Hero.css';
import Sectiontitle from '../global/Sectiontitle';
import {Card} from '../ui/card';

const HERO_SERVICES_POSTER_SRC =
  'https://downloads.adamunderwater.com/store-1-au/public/print3.jpg';

function HeroServices({onPosterLoad}: {onPosterLoad?: () => void}) {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const posterImgRef = useRef<HTMLImageElement>(null);
  const hasCalledPosterLoad = useRef(false);

  const handlePosterLoad = useCallback(() => {
    if (hasCalledPosterLoad.current) return;
    hasCalledPosterLoad.current = true;
    onPosterLoad?.();
  }, [onPosterLoad]);

  const handleVideoLoad = () => {
    setTimeout(() => {
      setIsVideoReady(true); // Switch to video only when loaded
    }, 250);
  };

  useEffect(() => {
    const img = posterImgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      handlePosterLoad();
    }
  }, [handlePosterLoad]);

  return (
    <section
      className="flex flex-col items-center justify-center main mb-3 "
      id="video"
    >
      <div className="title-wrapper">
        <div className="flex justify-center font-extrabold text-3xl py-2">
          <Sectiontitle text="Underwater 8K Video" />
        </div>
        <p className="flex justify-center font-semibold text-l pb-4">
          Professional Underwater Cinematography shot in 8K
        </p>
        <div className="flex justify-center returns">
          <Card className="mb-3 p-5">
            <div>
              <p className="statement">
                Canon EOS R5C and Nauticam Underwater Housing
              </p>
            </div>

            <div>
              <p className="statement">8K Canon Raw up to 60fps</p>
            </div>

            <div>
              <p className="statement">
                PADI Scuba Diving Instructor level certification
              </p>
            </div>

            <div>
              <p className="statement">
                Wide angle and macro underwater lenses
              </p>
            </div>
            <div>
              <p className="statement">
                Available for hire - based in San Diego, CA
              </p>
            </div>
          </Card>
        </div>
      </div>
      <div
        className="media-container"
        style={{
          backgroundImage: `url(${HERO_SERVICES_POSTER_SRC})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      >
        <img
          ref={posterImgRef}
          src={HERO_SERVICES_POSTER_SRC}
          alt="Loading video..."
          className={`placeholder ${isVideoReady ? 'hidden' : ''}`}
          onLoad={handlePosterLoad}
          loading="eager"
          fetchpriority="high"
        />
        <iframe
          src="https://player.vimeo.com/video/1018553050?autoplay=1&loop=1&muted=1&background=1"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          className={`video ${isVideoReady ? 'visible' : ''}`}
          title="Background Video"
          loading="eager"
          onLoad={handleVideoLoad}
        ></iframe>

        {/* <div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1018553050?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="website"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script> */}
      </div>
    </section>
  );
}

export default HeroServices;
