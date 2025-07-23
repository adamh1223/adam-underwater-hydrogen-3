import React from 'react';
import {Card, CardContent} from '../ui/card';
import {AddToCartButton} from '../AddToCartButton';

function EProductsContainer() {
  return (
    <div className="pt-12 mx-8 grid gap-4 md:grid-cols-2 px-5 pb-5">
      <>
        {EProducts?.map((product) => {
          const {name, price, WMVideoLink, downloadLink, thumbnail} = product;

          const productId = product.id;
          const dollarsAmount = formatCurrency(price);
          return (
            <article key={productId} className="group relative">
              <Card className="group-hover:shadow-xl transition-shadow duration-500">
                <CardContent className="p-4">
                  <div className="relative h-full evideo">
                    {/* {thumbnail && (
                      <img
                        src={thumbnail}
                        alt="hi"
                        className="flex items-center justify-center rounded w-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                      />
                    )} */}

                    <EProductPreview EProduct={product} />
                  </div>
                  <div className="mt-4 text-center">
                    <h2 className="text-lg capitalize">{name}</h2>
                    <p className="text-muted-foreground mt-2">
                      {dollarsAmount}
                    </p>
                    <AddToCartButton
                    //   productId={productId}
                    //   isEProduct
                    //   RedirectTo={`/stock`}
                    />
                  </div>
                </CardContent>
              </Card>
              {/* <div className="absolute top-5 right-2 z-5">
                <FavoriteToggleButton EProductId={productId} productId={null} />
              </div> */}
            </article>
          );
        })}
      </>
    </div>
  );
}

export default EProductsContainer;
