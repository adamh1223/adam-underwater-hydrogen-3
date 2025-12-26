import React, {useEffect, useState} from 'react';
import {Card} from '../ui/card';
import Hero from '../hero/Hero';
import Sectiontitle from '../global/Sectiontitle';
import HeroPrints from '../hero/HeroPrints';

const ProductsHeader = () => {
  return (
    <>
      <div className="flex justify-center pb-3" id="prints">
        <img src={'/prints.png'} className="products-header pe-2"></img>
      </div>

      <HeroPrints />
    </>
  );
};

export default ProductsHeader;
