import React from 'react';
import '../../styles/components/Stock.css';

const EProductsHeader = ({onLoad, imgRef}: {onLoad?: () => void; imgRef?: React.Ref<HTMLImageElement>}) => {
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
            'https://downloads.adamunderwater.com/store-1-au/public/stock.png'
          }
          className="stock-header"
          onLoad={onLoad}
        />
      </div>
      <p className="subheader-stock text-center">
        Bring your videos to life with professionally shot underwater footage.
      </p>
    </>
  );
};

export default EProductsHeader;
