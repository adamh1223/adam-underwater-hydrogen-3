import React, {useEffect, useState} from 'react';
import {Card} from '../ui/card';
import Hero from '../hero/Hero';
import Sectiontitle from '../global/Sectiontitle';
import HeroPrints from '../hero/HeroPrints';

const ProductsHeader = () => {
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
            'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/prints.png'
          }
          className="prints-header"
        />
      </div>

      <HeroPrints />
    </>
  );
};

export default ProductsHeader;
