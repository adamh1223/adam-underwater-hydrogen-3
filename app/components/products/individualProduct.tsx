import {Breadcrumb} from '../ui/breadcrumb';
import {Link} from '@remix-run/react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';
import {useEffect, useRef, useState} from 'react';
import {count} from 'console';

function IndividualProduct({
  productName,
  productImages,
}: {
  productName: string;
  productImages: {
    url: string;
    altText: string;
  }[];
}) {
  const carouselRef = useRef(null);
  const resetCarousel = () => {
    if (carouselRef.current) {
      // @ts-expect-error testing
      carouselRef.current.scrollToIndex(0);
    }
  };

  const [count, setCount] = useState(0);

  useEffect(() => {
    resetCarousel();
    setCount(0);
    console.log('hello world', count, '1357');
  }, [productImages]);
  return (
    <>
      <div className="pe-[60px]">
        <div className="breadcrumbs">
          <Link to="/">Home</Link>
          <Link to="/products">Products</Link>
          <Link to="/">{productName}</Link>
        </div>
        {/* <Breadcrumb name="INdividual product name" /> */}
        <div>
          <Carousel
            // ref={carouselRef}
            // opts={{
            //   align: 'start',
            //   startIndex: count,
            // }}
            className="w-full max-w-m mx-3 flex items-center justify-center sm: mx-[31px]
          md: mx-[20px]"
            key={JSON.stringify(productImages)}
          >
            <CarouselContent className="flex">
              {productImages.map((url, idx) => (
                <CarouselItem
                  className="flex items-center justify-center"
                  key={idx}
                >
                  <div className="p-4 flex items-center justify-center">
                    <img
                      src={url.url}
                      alt=""
                      className="max-h-full object-contain"
                    />
                  </div>
                </CarouselItem>
              ))}

              {/* <CarouselItem className="flex items-center justify-center">
                <div className="p-4 flex items-center justify-center">
                  <img
                    src={productImages[1]?.url}
                    alt=""
                    className="max-h-full object-contain"
                  />
                </div>
              </CarouselItem>

              <CarouselItem className="flex items-center justify-center">
                <div className="p-4 flex items-center justify-center">
                  <img
                    src={productImages[2]?.url}
                    alt=""
                    className="max-h-full object-contain"
                  />
                </div>
              </CarouselItem> */}
            </CarouselContent>

            <CarouselPrevious />
            <CarouselNext />
          </Carousel>

          {/* PRODUCT INFO SECOND COL */}
          {/* <div className="lg:ps-3 md:ps-3 sm:ps-3 xl:ps-8">
            <div className="flex gap-x-8 items-center">
              <h1 className="capitalize text-3xl font-bold">{name}</h1>
              <FavoriteToggleButton productId={params.id} EProductId={null} />
            </div>
            <ProductRating productId={params.id} />
            <h4 className="text-xl mt-2">{company}</h4>
            <p className="mt-3 text-md bg-muted inline-block p-2 rounded-md">
              {dollarsAmount}
            </p>
            <p className="mt-6 leading-8 text-muted-foreground">
              {description}
            </p>
            <div className="flex items-center">
              <AddToCart
                productId={params.id}
                RedirectTo={`/products/${params.id}`}
                isEProduct={false}
              />
            </div>
          </div>
        </div>
        <ProductReviews productId={params.id} />

        {reviewDoesNotExist && <SubmitReview productId={params.id} />} */}
        </div>
      </div>
    </>
  );
}
export default IndividualProduct;
