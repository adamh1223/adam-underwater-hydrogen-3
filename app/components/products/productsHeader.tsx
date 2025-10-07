import React, {useEffect, useState} from 'react';
import {Card} from '../ui/card';
import Hero from '../hero/Hero';
import Sectiontitle from '../global/Sectiontitle';

const ProductsHeader = () => {
  return (
    <>
      <div className="flex justify-center pb-3" id="prints">
        <img
          src={'/prints.png'}
          style={{height: '100px'}}
          className="pt-[25px] pe-2"
        ></img>
      </div>
      <div className="flex justify-center font-extrabold text-3xl py-2">
        <Sectiontitle text="Framed Canvas Wall Art" />
      </div>
      <p className="flex justify-center font-semibold text-l pb-4">
        Bring the ocean into your home
      </p>
      {/* <div className="flex flex-col items-center justify-center text-center main">
        <div className="media-container">
          <img
            src="/print3.jpg"
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
        </div>
      </div> */}
      <Hero />

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
            <p className="statement">Printed on Canon Image PROGRAF PRO-4600</p>
          </div>
          <div>
            <p className="statement">Handcrafted in San Diego, CA</p>
          </div>
        </Card>
      </div>
    </>
  );
};

export default ProductsHeader;
