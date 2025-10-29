import {useEffect, useState} from 'react';
import {Card} from '../ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';
import {Link} from '@remix-run/react';
import {ThreeUpCarouselProps} from '~/lib/types';
import {Button} from '../ui/button';

export function ThreeUpEProductCarousel({products}: ThreeUpCarouselProps) {
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function slideStyleForCount(count: number) {
    const percent = 100 / count;
    return {flex: `0 0 ${percent}%`, maxWidth: `${percent}%`};
  }

  let slidesPerView = 1;
  let carouselAlign: 'start' | 'center' = 'start';
  if (windowWidth && windowWidth >= 1024) {
    slidesPerView = 3;
  } else if (windowWidth && windowWidth >= 720) {
    slidesPerView = 2;
  } else {
    slidesPerView = 1;
    carouselAlign = 'center';
  }

  return (
    <div className="w-full flex justify-center">
      <Carousel
        className="you-may-like-carousel w-full max-w-6xl"
        opts={{loop: true, align: carouselAlign, slidesToScroll: 1}}
      >
        <CarouselContent className="!flex !items-stretch !justify-start">
          {/* ≥ 1024px (3 slides) */}
          {windowWidth && windowWidth >= 1024 && (
            <>
              {products?.map((product, idx) => (
                <CarouselItem
                  key={idx}
                  className="flex justify-center items-stretch"
                  style={slideStyleForCount(3)}
                >
                  <Link
                    to={`/products/${product.handle}`}
                    className="w-full flex justify-center"
                  >
                    <Card className="group w-full max-w-[420px] mx-2 p-3 overflow-visible flex flex-col">
                      {/* Title */}
                      <p className="text-center text-muted-foreground px-2">
                        Stock Footage Video:
                      </p>
                      <div className="flex justify-center mb-2">
                        <p className="text-center px-2">
                          <strong>{product.title}</strong>
                        </p>
                      </div>

                      {/* Image container */}
                      <div className="flex-1 flex items-center justify-center p-4">
                        <div className="w-full aspect-[16/9] flex items-center justify-center overflow-visible rounded bg-background transition-transform duration-500 ease-in-out group-hover:scale-105">
                          <img
                            src={product.imageURL}
                            alt={product.title}
                            className="max-w-full max-h-full object-contain rounded"
                          />
                        </div>
                      </div>
                      <div className="flex justify-center cursor-pointer">
                        <Button variant="default" className="cursor-pointer">
                          View Product
                        </Button>
                      </div>
                    </Card>
                  </Link>
                </CarouselItem>
              ))}
            </>
          )}

          {/* 720–1023px (2 slides) */}
          {windowWidth && windowWidth < 1024 && windowWidth >= 720 && (
            <>
              {products?.map((product, idx) => (
                <CarouselItem
                  key={idx}
                  className="flex justify-center items-stretch"
                  style={slideStyleForCount(2)}
                >
                  <Link
                    to={`/products/${product.handle}`}
                    className="w-full flex justify-center"
                  >
                    <Card className="group w-full max-w-[420px] mx-2 p-3 overflow-visible flex flex-col">
                      <p className="text-center text-muted-foreground px-2">
                        Stock Footage Video:
                      </p>
                      <div className="flex justify-center mb-2">
                        <p className="text-center px-2">
                          <strong>{product.title}</strong>
                        </p>
                      </div>
                      <div className="flex-1 flex items-center justify-center p-4">
                        <div className="w-full aspect-[16/9] flex items-center justify-center overflow-visible rounded bg-background transition-transform duration-500 ease-in-out group-hover:scale-105">
                          <img
                            src={product.imageURL}
                            alt={product.title}
                            className="max-w-full max-h-full object-contain rounded"
                          />
                        </div>
                      </div>
                      <div className="flex justify-center cursor-pointer">
                        <Button variant="default" className="cursor-pointer">
                          View Product
                        </Button>
                      </div>
                    </Card>
                  </Link>
                </CarouselItem>
              ))}
            </>
          )}

          {/* < 720px (1 slide) */}
          {windowWidth && windowWidth < 720 && (
            <>
              {products?.map((product, idx) => (
                <CarouselItem
                  key={idx}
                  className="flex justify-center items-stretch"
                  style={slideStyleForCount(1)}
                >
                  <Link
                    to={`/products/${product.handle}`}
                    className="w-full flex justify-center"
                  >
                    <Card className="group w-full max-w-[420px] mx-2 p-3 overflow-visible flex flex-col">
                      <p className="text-center text-muted-foreground px-2">
                        Stock Footage Video:
                      </p>
                      <div className="flex justify-center mb-2">
                        <p className="text-center px-2">
                          <strong>{product.title}</strong>
                        </p>
                      </div>
                      <div className="flex-1 flex items-center justify-center p-4">
                        <div className="w-full aspect-[16/9] flex items-center justify-center overflow-visible rounded bg-background transition-transform duration-500 ease-in-out group-hover:scale-105">
                          <img
                            src={product.imageURL}
                            alt={product.title}
                            className="max-w-full max-h-full object-contain rounded"
                          />
                        </div>
                      </div>
                      <div className="flex justify-center cursor-pointer">
                        <Button variant="default" className="cursor-pointer">
                          View Product
                        </Button>
                      </div>
                    </Card>
                  </Link>
                </CarouselItem>
              ))}
            </>
          )}
        </CarouselContent>

        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}
