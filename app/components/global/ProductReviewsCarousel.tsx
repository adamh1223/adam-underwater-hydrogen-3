import {useEffect, useMemo, useRef, useState} from 'react';
import ProductReviewsDisplay, {Review} from './ProductReviewsDisplay';
import {Button} from '../ui/button';

interface ProductReviewsCarouselProps {
  reviews: Review[];
  isAdmin: Boolean;
  currentCustomerId?: string;
  showProductLink?: boolean;
  onRemove?: (review: Review) => Promise<void> | void;
  onEdit?: (
    review: Review,
    updates: {
      text: string;
      title: string;
      stars: number;
      image?: File | null;
      isFeatured?: boolean;
    },
  ) => Promise<void> | void;
}

export default function ProductReviewsCarousel({
  reviews,
  isAdmin,
  currentCustomerId,
  onRemove,
  onEdit,
  showProductLink = false,
}: ProductReviewsCarouselProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [visibleHeight, setVisibleHeight] = useState(700);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return undefined;

    const updateHeight = () => {
      setContentHeight(element.offsetHeight);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(element);
    window.addEventListener('resize', updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  const sortedReviews = useMemo(() => {
    return [...(reviews ?? [])].sort((first, second) => {
      const secondTime = new Date(second?.createdAt ?? '').getTime() || 0;
      const firstTime = new Date(first?.createdAt ?? '').getTime() || 0;
      return secondTime - firstTime;
    });
  }, [reviews]);

  const maxHeight =
    contentHeight > visibleHeight ? `${visibleHeight}px` : undefined;

  if (!sortedReviews.length) return null;

  return (
    <>
      <div className="reviews-container mt-3 px-3 w-full">
        <div
          className="w-full overflow-hidden transition-[max-height] duration-300 ease-in-out"
          style={{maxHeight}}
        >
          <div
            ref={contentRef}
            className="columns-2 gap-3 md:columns-3 lg:columns-4"
          >
            {sortedReviews.map((review, index) => (
              <div
                key={review?.createdAt ?? index}
                className="mb-[10px] break-inside-avoid"
              >
                <ProductReviewsDisplay
                  review={review}
                  currentCustomerId={currentCustomerId}
                  onRemove={onRemove}
                  onEdit={onEdit}
                  isAdmin={isAdmin}
                  showProductLink={showProductLink}
                />
              </div>
            ))}
          </div>
        </div>
        {contentHeight > visibleHeight && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="secondary"
              className="cursor-pointer rounded border border-black px-6 py-2 text-sm font-medium transition hover:text-white"
              type="button"
              onClick={() => setVisibleHeight((prev) => prev + 1000)}
            >
              Load More Reviews
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
