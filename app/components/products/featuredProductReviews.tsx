import {Await} from '@remix-run/react';
import {Suspense} from 'react';
import ProductReviewsCarousel from '../global/ProductReviewsCarousel';
import {Separator} from '../ui/separator';
import type {Review} from '../global/ProductReviewsDisplay';
import { Rating, RatingButton } from 'components/ui/shadcn-io/rating';


interface FeaturedReviewsQuery {
  products: {
    nodes: Array<{
      id: string;
      title: string;
      metafield?: {
        value?: string | null;
      } | null;
    }>;
  };
}

type FeaturedReview = Review & {isFeatured?: boolean};

const parseReviewsValue = (value?: string | null) => {
  if (!value) return [] as FeaturedReview[];
  try {
    const parsed = JSON.parse(value) as FeaturedReview[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as FeaturedReview[];
  }
};

function FeaturedProductReviews({
  reviews,
  currentCustomerId,
}: {
  reviews: Promise<FeaturedReviewsQuery | null>;
  currentCustomerId: string;
}) {
  return (
    <>
      <Separator />
      <div className="featured-reviews">
        <Suspense fallback={<div>Loading...</div>}>
          <Await resolve={reviews}>
            {(response) => {
              if (!response) return null;
              const allReviews = response.products.nodes.flatMap((node) => 
                parseReviewsValue(node.metafield?.value),
              );
              
              const featuredReviews = allReviews.filter(
                (review) => review.isFeatured === true,
              );
              console.log(response.products, 'response');
              

              const totalRatings = allReviews.length;
              const totalStars = allReviews.reduce((sum, review) => {
                const starsValue =
                  typeof review.stars === 'string'
                    ? Number(review.stars)
                    : review.stars;
                return Number.isFinite(starsValue)
                  ? sum + (starsValue ?? 0)
                  : sum;
              }, 0);
              const averageRating = totalRatings
                ? totalStars / totalRatings
                : 0;

                const formattedAverageRating = totalRatings
                ? averageRating.toFixed(2)
                : '0.0';

              if (!featuredReviews.length) return null;
            
              return (
                <>
                  <div className="flex flex-col items-center gap-1 pt-3 pb-1 text-center">
                    <div className="average-product-rating">
                      <div className="flex items-center gap-2">
                        <div
                          className="relative flex items-center"
                          aria-hidden="true"
                        >
                          <Rating
                            readOnly
                            value={5}
                            className="text-muted-foreground"
                            aria-label="Maximum rating of 5 stars"
                          >
                            {Array.from({length: 5}).map((_, index) => (
                              <RatingButton key={index} className="h-5 w-5 p-0.5" />
                            ))}
                          </Rating>
                          <div
                            className="absolute inset-0 overflow-hidden text-yellow-400"
                            style={{
                              width: `${(averageRating / 5) * 100 + 2}%`,
                            }}
                          >
                            <Rating readOnly value={5} className="stars">
                              {Array.from({length: 5}).map((_, index) => (
                                <RatingButton
                                  key={index}
                                  className="h-5 w-5 p-0.5"
                                  aria-label={`Average rating ${formattedAverageRating} out of 5`}
                                />
                              ))}
                            </Rating>
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formattedAverageRating} (
                          {totalRatings === 1
                            ? '1 review'
                            : `${totalRatings.toLocaleString()} reviews`}
                          )
                        </span>
                      </div>
                    </div>
                  </div>
                  <ProductReviewsCarousel
                    reviews={featuredReviews}
                    isAdmin={
                      currentCustomerId ===
                      'gid://shopify/Customer/7968375079049'
                    }
                    currentCustomerId={currentCustomerId}
                    showProductLink
                    //   onEdit={}
                  />
                </>
              );
            }}
          </Await>
        </Suspense>
        <br />
      </div>
    </>
  );
}

export default FeaturedProductReviews;
