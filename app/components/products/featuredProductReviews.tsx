import {Await} from '@remix-run/react';
import {Suspense} from 'react';
import ProductReviewsCarousel from '../global/ProductReviewsCarousel';
import {Separator} from '../ui/separator';
import type {Review} from '../global/ProductReviewsDisplay';

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
}: {
  reviews: Promise<FeaturedReviewsQuery | null>;
}) {
  return (
    <>
      <Separator />
      <div className="featured-reviews">
        <Suspense fallback={<div>Loading...</div>}>
          <Await resolve={reviews}>
            {(response) => {
              if (!response) return null;
              const featuredReviews = response.products.nodes.flatMap((node) =>
                parseReviewsValue(node.metafield?.value).filter(
                  (review) => review.isFeatured === true,
                ),
              );

              if (!featuredReviews.length) return null;

              return (
                <ProductReviewsCarousel
                  reviews={featuredReviews}
                  isAdmin={false}
                />
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
