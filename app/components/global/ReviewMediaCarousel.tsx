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
import {ChevronLeftIcon, ChevronRightIcon, Divide} from 'lucide-react';
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
    'group-hover:shadow-xl h-full transition-shadow duration-500 cursor-pointer mb-5 pb-3';

  const cardContentClassName = 'flex flex-col h-full';

  const navigate = useNavigate();
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

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

  const scrollToIndex = (index: number) => carouselApi?.scrollTo(index);
  console.log(url, 'url');

  const increaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    scrollToIndex(currentIndex + 1);
  };

  const decreaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    scrollToIndex(currentIndex - 1);
  };

  let locationName: string | undefined;
  let locationState: string | undefined;
  let locationCountry: string | undefined;

  const titleCase = (w: string) =>
    w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

  return (
    <article className="group relative h-full">
      <Card className={cardClassName}>
        <div className={cardContentClassName}>
          <div
            className={`relative w-full h-full rounded ${'top-part-card-grid'}`}
          >
            <Carousel
              setApi={setCarouselApi}
              className="w-full max-w-7xl transform-none pb-4"
            >
              <CarouselContent>
                {url?.map((img, idx) => (
                  <CarouselItem
                    className="flex items-center justify-center"
                    key={idx}
                  >
                    <div
                      className={`flex items-center justify-center w-[85%] pt-5 pb-[12px] ps-4 pe-4

                        `}
                    >
                      {img.type === 'image' && (
                        <img
                          src={img.url}
                          className={`rounded object-cover transform group-hover:scale-105 transition-transform duration-500`}
                        />
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
          </div>
        </div>
      </Card>
    </article>
  );
};

export default ReviewMediaCarousel;
