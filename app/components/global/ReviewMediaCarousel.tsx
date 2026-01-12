// app/components/productCarousel.tsx
import React, {useEffect, useState} from 'react';
import {Card, CardContent} from '../ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselApi,
} from '../ui/carousel';
import {
  Link,
  NavLink,
  Navigate,
  useLoaderData,
  useNavigate,
} from '@remix-run/react';
import {Button} from '../ui/button';
import {ChevronLeftIcon, ChevronRightIcon, Divide, XIcon} from 'lucide-react';
import {Money} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';
import {ProductItemFragment, CollectionQuery} from 'storefrontapi.generated';
import {PartialPredictiveSearchResult} from '../SearchResultsPredictive';
import {CurrencyCode} from '@shopify/hydrogen/storefront-api-types';
import '../../styles/routeStyles/product.css';
import {LoaderFunctionArgs, redirect} from '@remix-run/server-runtime';
import {ReloadIcon} from '@radix-ui/react-icons';
import {FaHeart, FaRegHeart} from 'react-icons/fa';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {useIsLoggedIn} from '~/lib/hooks';
import {toast} from 'sonner';
import {Dialog, DialogClose, DialogContent} from '../ui/dialog';

interface ReviewMedia {
  url: string;
  type: string;
}

export const ReviewMediaCarousel = ({
  url,
}: {
  // accept full product OR a looser shape (to silence type-checking when your caller doesn't have full objects)
  url: ReviewMedia[];
}) => {
  const cardClassName =
    'group-hover:shadow-xl h-full transition-shadow duration-500 cursor-pointer';

  const cardContentClassName = 'flex flex-col h-full';

  const navigate = useNavigate();
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [zoomCarouselApi, setZoomCarouselApi] = useState<CarouselApi | null>(
    null,
  );
  const [zoomCurrentIndex, setZoomCurrentIndex] = useState(0);
  const [zoomTotalItems, setZoomTotalItems] = useState(0);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  useEffect(() => {
    if (!zoomCarouselApi) return;

    const updateZoomState = () => {
      setZoomCurrentIndex(zoomCarouselApi.selectedScrollSnap());
      setZoomTotalItems(zoomCarouselApi.scrollSnapList().length);
    };

    updateZoomState();

    zoomCarouselApi.on('select', updateZoomState);

    return () => void zoomCarouselApi.off('select', updateZoomState);
  }, [zoomCarouselApi]);

  useEffect(() => {
    if (!zoomCarouselApi || !isZoomOpen) return;
    zoomCarouselApi.scrollTo(zoomIndex, true);
  }, [zoomCarouselApi, isZoomOpen, zoomIndex]);

  const scrollToIndex = (index: number) => carouselApi?.scrollTo(index);
  const scrollZoomToIndex = (index: number) => zoomCarouselApi?.scrollTo(index);
  console.log(url, 'url');

  const increaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    scrollToIndex(currentIndex + 1);
  };

  const decreaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    scrollToIndex(currentIndex - 1);
  };

  const openZoomAtIndex = (index: number) => {
    setZoomIndex(index);
    setIsZoomOpen(true);
  };

  let locationName: string | undefined;
  let locationState: string | undefined;
  let locationCountry: string | undefined;

  const titleCase = (w: string) =>
    w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

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
                      className={`flex items-center justify-center w-[90%] pb-[12px]

                        `}
                    >
                      {img.type === 'image' && (
                        <button
                          type="button"
                          onClick={() => openZoomAtIndex(idx)}
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

              <div className="absolute inset-0 z-40 flex items-center justify-between pointer-events-none">
                <Button
                  onClick={decreaseIndex}
                  className={`pointer-events-auto rounded-full w-8 h-8 p-0 shadow-none cursor-pointer`}
                  variant="secondary"
                >
                  <ChevronLeftIcon className="h-6 w-6 text-white" />
                </Button>
                <Button
                  onClick={increaseIndex}
                  className={`cursor-pointer pointer-events-auto rounded-full w-8 h-8 p-0 shadow-none`}
                  variant="secondary"
                >
                  <ChevronRightIcon className="h-6 w-6 text-white" />
                </Button>
              </div>
            </Carousel>
            {totalItems > 1 && (
              <div className="carousel-preview-dots absolute bottom-[-50px] left-0 right-0 z-40 flex items-end justify-center gap-3 h-24 pt-5">
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
      <Dialog open={isZoomOpen} onOpenChange={setIsZoomOpen}>
        <DialogContent className="h-dvh w-dvw max-w-none rounded-none border-0 bg-transparent p-0 shadow-none">
          <DialogClose className="absolute right-6 top-[100px] z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border rounded-md cursor-pointer text-white hover:bg-black/80">
            <XIcon className="h-[300px] w-5 x-icon" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <div className="relative z-10 flex h-full w-full items-center justify-center">
            <div className="relative w-full">
              <Carousel
                setApi={setZoomCarouselApi}
                className="w-full max-w-7xl transform-none"
              >
                <CarouselContent>
                  {url?.map((media, idx) => (
                    <CarouselItem
                      className="flex items-center justify-center"
                      key={`${media.url}-${idx}`}
                    >
                      <div className="flex h-full w-full items-center justify-center px-4">
                        {media.type === 'image' && (
                          <img
                            src={media.url}
                            className="max-h-[80vh] w-auto max-w-[90vw] rounded-lg object-contain"
                          />
                        )}
                        {media.type === 'video' && (
                          <video
                            className="max-h-[80vh] w-auto max-w-[90vw] rounded-lg"
                            controls
                            playsInline
                            preload="metadata"
                          >
                            <source src={media.url} type="video/mp4" />
                          </video>
                        )}
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <div className="absolute bottom-[-50px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-4">
                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      scrollZoomToIndex(zoomCurrentIndex - 1);
                    }}
                    className="rounded-full w-10 h-10 p-0 shadow-none bg-white/20 hover:bg-white/30"
                    variant="secondary"
                  >
                    <ChevronLeftIcon className="h-6 w-6 text-white" />
                  </Button>
                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      scrollZoomToIndex(zoomCurrentIndex + 1);
                    }}
                    className="rounded-full w-10 h-10 p-0 shadow-none bg-white/20 hover:bg-white/30"
                    variant="secondary"
                  >
                    <ChevronRightIcon className="h-6 w-6 text-white" />
                  </Button>
                </div>
              </Carousel>
              {zoomTotalItems > 1 && (
                <div className="absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center gap-3">
                  {Array.from({length: zoomTotalItems}).map((_, idx) => (
                    <button
                      key={`zoom-dot-${idx}`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        scrollZoomToIndex(idx);
                      }}
                      className={`h-2 w-2 rounded-full border border-white/60 ${idx === zoomCurrentIndex ? 'bg-white' : 'bg-white/30'}`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
};

export default ReviewMediaCarousel;
