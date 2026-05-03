import React, {useCallback, useEffect, useRef, useState} from 'react';

import '../../styles/components/Hero.css';
import Sectiontitle from '../global/Sectiontitle';
import {Card} from '../ui/card';

const HERO_SERVICES_POSTER_SRC =
  'https://downloads.adamunderwater.com/store-1-au/public/print3.jpg';

const VIMEO_SRC =
  'https://player.vimeo.com/video/1018553050?autoplay=1&loop=1&muted=1&background=1&dnt=1';

function HeroServices({onPosterLoad}: {onPosterLoad?: () => void}) {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [vimeoSrc, setVimeoSrc] = useState('');
  const posterImgRef = useRef<HTMLImageElement>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const hasCalledPosterLoad = useRef(false);

  const handlePosterLoad = useCallback(() => {
    if (hasCalledPosterLoad.current) return;
    hasCalledPosterLoad.current = true;
    onPosterLoad?.();
    // Start Vimeo only after poster image is ready
    setVimeoSrc(VIMEO_SRC);
  }, [onPosterLoad]);

  const handleVideoLoad = () => {
    setTimeout(() => {
      setIsVideoReady(true);
    }, 250);
  };

  // Only connect to Vimeo once the media container enters the viewport
  useEffect(() => {
    const el = mediaContainerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { handlePosterLoad(); observer.disconnect(); }
      },
      {rootMargin: '200px'},
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [handlePosterLoad]);

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
      <div className="title-wrapper-services">
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
        ref={mediaContainerRef}
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
        {vimeoSrc && (
          <iframe
            src={vimeoSrc}
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            className={`video ${isVideoReady ? 'visible' : ''}`}
            title="Background Video"
            loading="lazy"
            onLoad={handleVideoLoad}
          />
        )}
      </div>
    </section>
  );
}

export default HeroServices;
