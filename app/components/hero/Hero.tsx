import React, {useState, useEffect, useRef, useCallback} from 'react';

import '../../styles/components/Hero.css';
import {Link} from '@remix-run/react';
import {Button} from '../ui/button';

const VIMEO_SRC =
  'https://player.vimeo.com/video/1018553050?autoplay=1&loop=1&muted=1&background=1&dnt=1';

function Hero({onHeroImgLoad}: {onHeroImgLoad?: () => void}) {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [vimeoSrc, setVimeoSrc] = useState('');
  const heroImgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasCalledLoad = useRef(false);

  const handleHeroImgLoad = useCallback(() => {
    if (!hasCalledLoad.current) {
      hasCalledLoad.current = true;
      onHeroImgLoad?.();
    }
  }, [onHeroImgLoad]);

  const handleVideoLoad = () => {
    setTimeout(() => setIsVideoReady(true), 250);
  };

  useEffect(() => {
    if (heroImgRef.current?.complete && heroImgRef.current.naturalWidth > 0) {
      handleHeroImgLoad();
    }
  }, [handleHeroImgLoad]);

  // Only connect to Vimeo when the media container is visible in the viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVimeoSrc(VIMEO_SRC);
          observer.disconnect();
        }
      },
      {rootMargin: '200px'},
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="flex flex-col items-center justify-center text-center main">
      <div>
        <div className="pb-[40px]" id="prints">
          <img
            ref={heroImgRef}
            src="https://downloads.adamunderwater.com/store-1-au/public/vp3.png"
            className="p-3 hero-img"
            loading="eager"
            fetchpriority="high"
            decoding="sync"
            onLoad={handleHeroImgLoad}
          />
          <div className="flex flex-col justify-center pt-5">
            <div className="flex justify-center">
              <Link to="/prints">
                <Button size="lg" className="w-48 cursor-pointer">Prints</Button>
              </Link>
            </div>
            <div className="flex justify-center">
              <Link to="/stock">
                <Button size="lg" className="mt-5 w-48 cursor-pointer">Stock Footage</Button>
              </Link>
            </div>
            <div className="flex justify-center">
              <Link to="/work">
                <Button size="lg" className="mt-5 w-48 cursor-pointer">My Projects</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div
        ref={containerRef}
        className="media-container"
        style={{
          backgroundImage:
            'url(https://downloads.adamunderwater.com/store-1-au/public/print1.jpg)',
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      >
        <img
          src="https://downloads.adamunderwater.com/store-1-au/public/print1.jpg"
          alt="Loading video..."
          className={`placeholder ${isVideoReady ? 'hidden' : ''}`}
          loading="eager"
          fetchpriority="high"
          decoding="sync"
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

export default Hero;
