import React from 'react';
import '../../styles/components/Stock.css';

const EProductsHeader = () => {
  return (
    <>
      <div className="flex justify-center pb-5 ps-1">
        <img src={'/stock2.png'} style={{height: '120px'}} className="pt-2" />
      </div>
      <p className="subheader">
        Bring your videos to life with professionally shot underwater footage.
      </p>
    </>
  );
};

export default EProductsHeader;
