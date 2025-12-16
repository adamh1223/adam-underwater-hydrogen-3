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
      <div className="content">
        {/* <h1 className="max-w-2xl font-bold text-4xl tracking-tight pb-2 px-3">
          Underwater Video and Photo
        </h1> */}
        <div className="pb-3" id="prints">
          <img src={'/vp3.png'} className="p-3 hero-img"></img>
        </div>
        <Button size="lg" className="mt-5 w-48 cursor-pointer">
          <Link to="/pages/work">Video</Link>
        </Button>
        <Button size="lg" className="mt-5 w-48 cursor-pointer">
          <Link to="/collections/prints">View All Prints</Link>
        </Button>
      </div>
      <div className="media-container">
        <img
          src="/print1.jpg"
          alt="Loading video..."
          className={`placeholder ${isVideoReady ? 'hidden' : ''}`}
        />
        <iframe
          src="https://player.vimeo.com/video/1018553050?autoplay=1&loop=1&muted=1&background=1"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className={`video ${isVideoReady ? 'visible' : ''}`}
          title="Background Video"
        ></iframe>

        {/* <div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1018553050?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="website"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script> */}
      </div>
    </section>
  );
}

export default Hero;
