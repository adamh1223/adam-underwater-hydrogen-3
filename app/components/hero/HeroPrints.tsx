import React, {useEffect, useRef, useState} from 'react';

import '../../styles/components/Hero.css';
import Sectiontitle from '../global/Sectiontitle';
import {Card} from '../ui/card';

const VIMEO_SRC =
  'https://player.vimeo.com/video/1018553050?autoplay=1&loop=1&muted=1&background=1&dnt=1';

function HeroPrints() {
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [vimeoSrc, setVimeoSrc] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleVideoLoad = () => {
    setTimeout(() => setIsVideoReady(true), 250);
  };

  return (
    <section className="flex flex-col items-center justify-center text-center main">
      <div className="title-wrapper-prints">
        <div className="flex justify-center font-extrabold text-3xl py-2">
          <Sectiontitle text="Framed Canvas Wall Art" />
        </div>
        <p className="flex justify-center font-semibold text-l pb-4">
          Bring the ocean into your home
        </p>
        <div className="flex justify-center returns">
          <Card className="mb-3 p-3">
            <div><p className="statement">Original Photography</p></div>
            <div><p className="statement">Customizable sizes</p></div>
            <div><p className="statement">Thick and durable wooden frames</p></div>
            <div><p className="statement">Anti-glare, polyester Inkjet canvas</p></div>
            <div><p className="statement">Canon Image PROGRAF PRO-4600</p></div>
            <div><p className="statement">Gallery Wrapped</p></div>
            <div><p className="statement">Handcrafted in San Diego, CA</p></div>
          </Card>
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

export default HeroPrints;
