import React, {useState, useEffect} from 'react';

import '../../styles/components/Hero.css';
import {Link} from '@remix-run/react';
import {Button} from '../ui/button';

function Hero() {
  const [isVideoReady, setIsVideoReady] = useState(false);

  const handleVideoLoad = () => {
    setTimeout(() => {
      setIsVideoReady(true); // Switch to video only when loaded
    }, 5000);
  };

  useEffect(() => {
    const iframe = document.querySelector('iframe');
    if (iframe) {
      iframe.addEventListener('load', handleVideoLoad);
    }
    return () => {
      if (iframe) {
        iframe.removeEventListener('load', handleVideoLoad);
      }
    };
  }, []);

  return (
    <section className="flex flex-col items-center justify-center text-center main">
      <div>
        <div className="pb-[40px]" id="prints">
          <img src={'https://downloads.adamunderwater.com/store-1-au/public/vp3.png'} className="p-3 hero-img"></img>
          <div className="flex flex-col justify-center pt-5">
            <div className="flex justify-center">
              <Link to="/pages/work">
                <Button size="lg" className="w-48 cursor-pointer">
                  Video
                </Button>
              </Link>
            </div>
            <div className="flex justify-center">
              <Link to="/collections/prints">
                <Button size="lg" className="mt-5 w-48 cursor-pointer">
                  View All Prints
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="media-container">
        <img
          src="https://downloads.adamunderwater.com/store-1-au/public/print1.jpg"
          alt="Loading video..."
          className={`placeholder ${isVideoReady ? 'hidden' : ''}`}
        />
        <iframe
          src="https://player.vimeo.com/video/1018553050?autoplay=1&loop=1&muted=1&background=1"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          className={`video ${isVideoReady ? 'visible' : ''}`}
          title="Background Video"
        ></iframe>
      </div>
    </section>
  );
}

export default Hero;
