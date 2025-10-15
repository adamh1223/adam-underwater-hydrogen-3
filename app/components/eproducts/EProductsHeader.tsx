import React from 'react';
import '../../styles/components/Stock.css';

const EProductsHeader = () => {
  return (
    <>
      <div className="flex justify-center ps-1">
        <img src={'/stock2.png'} className="pt-2 stock-footage-page-header" />
      </div>
      <p className="subheader-stock">
        Bring your videos to life with professionally shot underwater footage.
      </p>
    </>
  );
};

export default EProductsHeader;
