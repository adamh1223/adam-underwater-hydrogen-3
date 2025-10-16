import React, {useState, useEffect} from 'react';

import '../../styles/components/Hero.css';
import {Link} from '@remix-run/react';
import {Button} from '../ui/button';
import Sectiontitle from '../global/Sectiontitle';
import {Card} from '../ui/card';

function HeroPrints() {
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
    <section className="flex flex-col items-center justify-center text-center main mb-3">
      <div className="title-wrapper">
        <div className="flex justify-center font-extrabold text-3xl py-2">
          <Sectiontitle text="Framed Canvas Wall Art" />
        </div>
        <p className="flex justify-center font-semibold text-l pb-4">
          Bring the ocean into your home
        </p>
        <div className="flex justify-center returns">
          <Card className="my-7 p-5">
            <div>
              <p className="statement">Customizable sizes</p>
            </div>

            <div>
              <p className="statement">Thick and durable wooden frames</p>
            </div>

            <div>
              <p className="statement">Anti-glare, polyester Inkjet canvas</p>
            </div>

            <div>
              <p className="statement">
                Printed on Canon Image PROGRAF PRO-4600
              </p>
            </div>
            <div>
              <p className="statement">Handcrafted in San Diego, CA</p>
            </div>
          </Card>
        </div>
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

export default HeroPrints;
