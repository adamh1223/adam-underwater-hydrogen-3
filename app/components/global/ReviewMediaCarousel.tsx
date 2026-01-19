// app/components/productCarousel.tsx
import React, {useEffect, useState} from 'react';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from '../ui/carousel';
import {Button} from '../ui/button';
import {ChevronLeftIcon, ChevronRightIcon, XIcon} from 'lucide-react';
import '../../styles/routeStyles/product.css';


interface ReviewMedia {
  url: string;
  type: string;
}

export const ReviewMediaCarousel = ({
  url,
  onImageClick,
}: {
  // accept full product OR a looser shape (to silence type-checking when your caller doesn't have full objects)
  url: ReviewMedia[];
  onImageClick?: (index: number) => void;
}) => {
  const cardClassName =
    'group-hover:shadow-xl h-full transition-shadow duration-500 cursor-pointer';

  const cardContentClassName = 'flex flex-col h-full';

  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    if (!carouselApi) return;

    const updateCarouselState = () => {
      setCurrentIndex(carouselApi.selectedScrollSnap());
      setTotalItems(carouselApi.scrollSnapList().length);
    };

    updateCarouselState();

    carouselApi.on('select', updateCarouselState);

    return () => void carouselApi.off('select', updateCarouselState);
  }, [carouselApi]);

  const scrollToIndex = (index: number) => carouselApi?.scrollTo(index);

  const increaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    scrollToIndex(currentIndex + 1);
  };

  const decreaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    scrollToIndex(currentIndex - 1);
  };

  return (
    <article className="group relative">
      <div className={cardClassName}>
        <div className={cardContentClassName}>
          <div className={`relative w-full rounded ${'top-part-card-grid'}`}>
            <Carousel
              setApi={setCarouselApi}
              className="w-full max-w-7xl transform-none mb-3"
            >
              <CarouselContent>
                {url?.map((img, idx) => (
                  <CarouselItem
                    className="flex items-center justify-center review-media-slide"
                    key={idx}
                  >
                    <div
                      className={`flex items-center justify-center w-[95%]

                        `}
                    >
                      {img.type === 'image' && (
                        <button
                          type="button"
                          onClick={() => onImageClick?.(idx)}
                          className="cursor-zoom-in"
                        >
                          <img
                            src={img.url}
                            className={`rounded object-cover transform group-hover:scale-105 transition-transform duration-500`}
                          />
                        </button>
                      )}
                      {img.type === 'video' && (
                        <video
                          className="home-video__player"
                          controls
                          playsInline
                          preload="metadata"
                        >
                          <source src={img.url} type="video/mp4" />
                        </video>
                      )}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>

              <div className="absolute inset-0 z-500 flex items-center justify-between pointer-events-none">
                <Button
                  onClick={decreaseIndex}
                  className={`pointer-events-auto rounded-full w-7 h-7 p-0 shadow-none cursor-pointer bg-black/60 hover:bg-black/75`}
                  variant="secondary"
                  size='lg'
                >
                  <ChevronLeftIcon className="h-4 w-4 text-white" />
                </Button>
                <Button
                  onClick={increaseIndex}
                  className={`cursor-pointer pointer-events-auto rounded-full w-7 h-7 p-0 shadow-none bg-black/60 hover:bg-black/75`}
                  variant="secondary"
                >
                  <ChevronRightIcon className="h-4 w-4 text-white" />
                </Button>
              </div>
            </Carousel>
            {totalItems > 1 && (
              <div className="carousel-preview-dots absolute bottom-2 left-0 right-0 z-40 flex items-end justify-center gap-3 h-24 pt-5">
                {Array.from({length: totalItems}).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      scrollToIndex(idx);
                    }}
                    className={`h-2 w-2 rounded-full border border-white/60 ${idx === currentIndex ? 'bg-white' : 'bg-white/30'}`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </article>
  );
};

export default ReviewMediaCarousel;
