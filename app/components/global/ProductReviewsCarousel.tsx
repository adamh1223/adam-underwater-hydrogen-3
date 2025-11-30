import {useEffect, useMemo, useState} from 'react';
import ProductReviewsDisplay, {Review} from './ProductReviewsDisplay';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';

interface ProductReviewsCarouselProps {
  reviews: Review[];
  currentCustomerId?: string;
  onRemove?: (review: Review) => Promise<void> | void;
  onEdit?: (
    review: Review,
    updates: {text: string; title: string; stars: number; image?: File | null},
  ) => Promise<void> | void;
}

export default function ProductReviewsCarousel({
  reviews,
  currentCustomerId,
  onRemove,
  onEdit,
}: ProductReviewsCarouselProps) {
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sortedReviews = useMemo(() => {
    return [...(reviews ?? [])].sort((first, second) => {
      const secondTime = new Date(second?.createdAt ?? '').getTime() || 0;
      const firstTime = new Date(first?.createdAt ?? '').getTime() || 0;
      return secondTime - firstTime;
    });
  }, [reviews]);

  const slidesPerView = useMemo(() => {
    if (windowWidth === undefined) return 3;
    if (windowWidth >= 1024) return 3;
    if (windowWidth >= 720) return 2;
    return 1;
  }, [windowWidth]);

  const slideStyle = useMemo(() => {
    const percent = 100 / slidesPerView;
    return {flex: `0 0 ${percent}%`, maxWidth: `${percent}%`};
  }, [slidesPerView]);

  if (!sortedReviews.length) return null;

  return (
    <>
      <div className="reviews-container flex justify-center mt-3">
        <Carousel
          className="you-may-like-carousel w-full"
          opts={{
            loop: true,
            align: slidesPerView === 1 ? 'center' : 'start',
            slidesToScroll: 1,
          }}
        >
          <CarouselContent className="!flex !items-stretch !justify-start">
            {sortedReviews.map((review, index) => (
              <CarouselItem
                key={review?.createdAt ?? index}
                className="flex justify-center items-stretch"
                style={slideStyle}
              >
                <ProductReviewsDisplay
                  review={review}
                  currentCustomerId={currentCustomerId}
                  onRemove={onRemove}
                  onEdit={onEdit}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </>
  );
}
