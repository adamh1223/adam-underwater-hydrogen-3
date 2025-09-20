import React from 'react';
import {Card} from '../ui/card';

const ProductsHeader = () => {
  return (
    <>
      <div className="flex justify-center pb-3" id="prints">
        <img
          src={'/products.png'}
          style={{height: '120px'}}
          className="pt-3"
        ></img>
      </div>
      <div className="flex justify-center font-extrabold text-3xl py-2">
        <p>Canvas Wall Art</p>
      </div>
      <p className="flex justify-center font-semibold text-l">
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
