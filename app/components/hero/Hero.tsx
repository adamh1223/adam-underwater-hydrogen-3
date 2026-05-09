import React, {useState, useEffect, useRef, useCallback} from 'react';

import '../../styles/components/Hero.css';
import {Link} from '@remix-run/react';
import {Button} from '../ui/button';
import {BgHlsVideo} from '~/components/video/BgHlsVideo';

function NavButton({to, className, children}: {to: string; className?: string; children: React.ReactNode}) {
  const [splashing, setSplashing] = useState(false);

  const handlePointerDown = () => {
    setSplashing(false);
    // Force a reflow so removing then re-adding the class replays the animation
    requestAnimationFrame(() => setSplashing(true));
  };

  return (
    <Link to={to}>
      <Button
        size="lg"
        className={`w-48 cursor-pointer${splashing ? ' variant-option-selected-splash' : ''}${className ? ` ${className}` : ''}`}
        onPointerDown={handlePointerDown}
      >
        {children}
      </Button>
    </Link>
  );
}

function Hero({onHeroImgLoad}: {onHeroImgLoad?: () => void}) {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoActive, setVideoActive] = useState(false);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasCalledLoad = useRef(false);

  const handleHeroImgLoad = useCallback(() => {
    if (!hasCalledLoad.current) {
      hasCalledLoad.current = true;
      onHeroImgLoad?.();
    }
  }, [onHeroImgLoad]);

  useEffect(() => {
    if (heroImgRef.current?.complete && heroImgRef.current.naturalWidth > 0) {
      handleHeroImgLoad();
    }
  }, [handleHeroImgLoad]);

  // Only start the video when the media container is visible in the viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVideoActive(true);
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
        <div id="prints">
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
              <NavButton to="/prints">Prints</NavButton>
            </div>
            <div className="flex justify-center">
              <NavButton to="/stock" className="mt-5">Stock Footage</NavButton>
            </div>
            <div className="flex justify-center">
              <NavButton to="/work" className="mt-5">My Projects</NavButton>
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
        {videoActive && (
          <BgHlsVideo
            className={`video ${isVideoReady ? 'visible' : ''}`}
            onReady={() => setIsVideoReady(true)}
          />
        )}
      </div>
    </section>
  );
}

export default Hero;
