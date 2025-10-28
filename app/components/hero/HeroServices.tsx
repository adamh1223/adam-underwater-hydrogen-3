import React, {useState, useEffect} from 'react';

import '../../styles/components/Hero.css';
import {Link} from '@remix-run/react';
import {Button} from '../ui/button';
import Sectiontitle from '../global/Sectiontitle';
import {Card} from '../ui/card';

function HeroServices() {
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
        <div className="flex justify-center">
          <Card className="my-7 p-5">
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
      <div className="media-container">
        <img
          src="/print3.jpg"
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

export default HeroServices;
