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
import {ChevronRightIcon} from 'lucide-react';
import '../../styles/routeStyles/product.css';
import {Image} from '@shopify/hydrogen';

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
  }, [productImages]);

  // const ScrollZoomImage = ({ src, alt }) => {
  // const [zoomLevel, setZoomLevel] = useState(1);
  // const imageRef = useRef(null);

  // useEffect(() => {
  //   const handleScroll = () => {
  //     if (imageRef.current) {
  //       const { top, height } = imageRef.current;
  //       const viewportHeight = window.innerHeight;

  //       let newZoom = 1;
  //       if (top < viewportHeight && top + height > 0) {
  //         const scrollProgress = (viewportHeight - top) / (viewportHeight + height);
  //         newZoom = 1 + scrollProgress * 0.5;
  //       }
  //       setZoomLevel(newZoom);
  //     }
  //   };

  //   window.addEventListener('scroll', handleScroll);
  //   return () => window.removeEventListener('scroll', handleScroll);
  // }, []);
  return (
    <>
      {/* // <div className="pe-[60px]"> */}
      {/* may need to be made into a component if more pages are made */}

      {/* <Breadcrumb name="INdividual product name" /> */}
      <div className="grid grid-cols-1">
        <div className="flex justify-center  px-4 product-carousel-container">
          <Carousel
            // ref={carouselRef}
            // opts={{
            //   align: 'start',
            //   startIndex: count,
            // }}
            className="print-carousel-individual mx-3 flex items-center justify-center "
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
        </div>
        <div className="flex justify-center gap-2 mb-5 carousel-shortcuts-container">
          {productImages.map((url, idx) => (
            <img
              key={idx}
              src={url.url}
              className="cursor-pointer border-2 h-[75px] w-[130px] object-contain" // Add active state styling
              // onClick={() => mainApi?.scrollTo(idx)}
            />
          ))}
        </div>
        
      </div>
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
      {/* // </div> */}
    </>
  );
}
export default IndividualProduct;
