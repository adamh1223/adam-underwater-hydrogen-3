import React, {useEffect, useState} from 'react';
import {Card} from '../ui/card';
import Hero from '../hero/Hero';
import Sectiontitle from '../global/Sectiontitle';
import HeroPrints from '../hero/HeroPrints';

const ProductsHeader = ({onLoad, imgRef}: {onLoad?: () => void; imgRef?: React.Ref<HTMLImageElement>}) => {
  return (
    <>
      <div className="header-container">
        <img
          src={
            'https://downloads.adamunderwater.com/store-1-au/public/icon.png'
          }
          className="icon-header"
        />

        <img
          ref={imgRef}
          src={
            'https://downloads.adamunderwater.com/store-1-au/public/prints.png'
          }
          className="prints-header"
          onLoad={onLoad}
        />
      </div>

      <HeroPrints />
    </>
  );
};

export default ProductsHeader;
