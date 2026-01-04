import React from 'react';
import '../../styles/components/Stock.css';

const EProductsHeader = () => {
  return (
    <>
      <div className="header-container">
        <img
          src={
            'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/icon.png'
          }
          className="icon-header"
        />

        <img
          src={
            'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/stock.png'
          }
          className="stock-header"
        />
      </div>
      <p className="subheader-stock text-center">
        Bring your videos to life with professionally shot underwater footage.
      </p>
    </>
  );
};

export default EProductsHeader;
