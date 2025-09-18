import {useEffect, useState} from 'react';
import {Card, CardContent} from '../ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';
import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  useLoaderData,
  type MetaFunction,
  Link,
  useRouteLoaderData,
} from '@remix-run/react';
import {RootLoader, loader} from '~/root';
import Product from '~/routes/products.$handle';

export function ThreeUpEProductCarousel({images}: {images: string[]}) {
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });

  return (
    <Carousel
      className="you-may-like-carousel w-full max-w-5xl"
      opts={{loop: true, align: 'start', slidesToScroll: 1}}
    >
      <CarouselContent>
        {windowWidth && windowWidth >= 1024 && (
          <>
            {images.map((img, idx) => (
              <CarouselItem key={idx} className="basis-1/3">
                {/* 👇 add group here */}
                <div className="group p-4 flex items-center justify-center overflow-hidden rounded h-44 w-72">
                  <img
                    src={img}
                    alt={`Image ${idx + 1}`}
                    className="w-full h-full object-cover rounded transition-transform duration-500 ease-in-out group-hover:scale-105"
                  />
                </div>
              </CarouselItem>
            ))}
          </>
        )}
        {windowWidth && windowWidth < 1024 && windowWidth >= 720 && (
          <>
            {images.map((img, idx) => (
              <CarouselItem key={idx} className="basis-1/2">
                {/* 👇 add group here */}
                <div className="group p-4 flex items-center justify-center overflow-hidden rounded h-44 w-72">
                  <img
                    src={img}
                    alt={`Image ${idx + 1}`}
                    className="w-full h-full object-cover rounded transition-transform duration-500 ease-in-out group-hover:scale-105"
                  />
                </div>
              </CarouselItem>
            ))}
          </>
        )}
        {windowWidth && windowWidth < 720 && (
          <>
            {images.map((img, idx) => (
              <CarouselItem key={idx}>
                {/* 👇 add group here */}
                <div className="group p-4 flex items-center justify-center overflow-hidden rounded h-52 w-80">
                  <img
                    src={img}
                    alt={`Image ${idx + 1}`}
                    className="w-full h-full object-cover rounded transition-transform duration-500 ease-in-out group-hover:scale-105"
                  />
                </div>
              </CarouselItem>
            ))}
          </>
        )}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
