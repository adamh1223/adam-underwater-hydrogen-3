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

type TaggedReview = Review & {tags?: string[] | string; tag?: string};

const parseTags = (value?: string[] | string) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const isFeaturedReview = (review: TaggedReview) => {
  const tags = parseTags(review.tags ?? review.tag);
  return tags.includes('featured');
};

const parseReviewsValue = (value?: string | null) => {
  if (!value) return [] as TaggedReview[];
  try {
    const parsed = JSON.parse(value) as TaggedReview[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as TaggedReview[];
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
                parseReviewsValue(node.metafield?.value).filter(isFeaturedReview),
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
