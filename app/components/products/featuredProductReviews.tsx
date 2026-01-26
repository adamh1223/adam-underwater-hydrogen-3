import {Await} from '@remix-run/react';
import {Suspense, useEffect, useMemo, useState} from 'react';
import ProductReviewsCarousel from '../global/ProductReviewsCarousel';
import {Separator} from '../ui/separator';
import type {Review} from '../global/ProductReviewsDisplay';
import {Rating, RatingButton} from 'components/ui/shadcn-io/rating';
import {toast} from 'sonner';


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
const ADMIN_CUSTOMER_ID = 'gid://shopify/Customer/7968375079049';

const parseReviewsValue = (value?: string | null) => {
  if (!value) return [] as FeaturedReview[];
  try {
    const parsed = JSON.parse(value) as FeaturedReview[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as FeaturedReview[];
  }
};

const mergeProductReviews = (
  existingReviews: FeaturedReview[],
  productId: string,
  updatedReviews: Review[],
) => {
  const remaining = existingReviews.filter(
    (review) => review.productId !== productId,
  );

  return [...remaining, ...(updatedReviews as FeaturedReview[])];
};

function FeaturedReviewsContent({
  response,
  currentCustomerId,
}: {
  response: FeaturedReviewsQuery;
  currentCustomerId?: string;
}) {
  const [allReviews, setAllReviews] = useState<FeaturedReview[]>(() =>
    response.products.nodes.flatMap((node) =>
      parseReviewsValue(node.metafield?.value),
    ),
  );

  useEffect(() => {
    setAllReviews(
      response.products.nodes.flatMap((node) =>
        parseReviewsValue(node.metafield?.value),
      ),
    );
  }, [response]);

  const featuredReviews = useMemo(
    () => allReviews.filter((review) => review.isFeatured === true),
    [allReviews],
  );

  const totalRatings = allReviews.length;
  const totalStars = useMemo(
    () =>
      allReviews.reduce((sum, review) => {
        const starsValue =
          typeof review.stars === 'string'
            ? Number(review.stars)
            : review.stars;
        return Number.isFinite(starsValue)
          ? sum + (starsValue ?? 0)
          : sum;
      }, 0),
    [allReviews],
  );
  const averageRating = totalRatings ? totalStars / totalRatings : 0;
  const formattedAverageRating = totalRatings
    ? averageRating.toFixed(2)
    : '0.0';
  const isAdmin = currentCustomerId === ADMIN_CUSTOMER_ID;

  const handleRemoveReview = async (review: FeaturedReview) => {
    if (!review?.productId || !review?.createdAt) return;
    if (!currentCustomerId && !isAdmin) return;

    const form = new FormData();
    form.append('productId', review.productId);
    form.append(
      'customerId',
      isAdmin ? review.customerId ?? '' : currentCustomerId ?? '',
    );
    form.append('createdAt', review.createdAt);

    try {
      const response = await fetch('/api/remove_review', {
        method: 'POST',
        body: form,
        headers: {Accept: 'application/json'},
      });

      if (!response.ok) {
        console.error('Failed to remove review', await response.text());
        return;
      }

      const data = await response.json();
      const updatedReviews: Review[] = data?.reviews ?? [];
      setAllReviews((prev) =>
        mergeProductReviews(prev, review.productId ?? '', updatedReviews),
      );
      toast.success('Review Deleted');
    } catch (error) {
      console.error('Error removing review', error);
    }
  };

  const handleEditReview = async (
    review: FeaturedReview,
    updates: {
      text: string;
      title: string;
      stars: number;
      image?: File | null;
      video?: File | null;
      isFeatured?: boolean;
    },
  ) => {
    if (!review?.productId || !review?.createdAt) return;
    if (!currentCustomerId && !isAdmin) return;

    const form = new FormData();
    form.append('productId', review.productId);
    form.append('customerId', currentCustomerId ?? '');
    form.append('createdAt', review.createdAt);
    form.append('review', updates.text);
    form.append('stars', updates.stars.toString());
    form.append('title', updates.title);
    form.append('customerName', review.customerName ?? '');
    if (updates.image) {
      form.append('image', updates.image);
    }
    if (updates.video) {
      form.append('video', updates.video);
    }
    if (isAdmin && typeof updates.isFeatured === 'boolean') {
      form.append('isFeatured', updates.isFeatured ? 'yes' : 'no');
    }

    try {
      const response = await fetch('/api/edit_review', {
        method: 'POST',
        body: form,
        headers: {Accept: 'application/json'},
      });

      if (!response.ok) {
        console.error('Failed to edit review', await response.text());
        return;
      }

      const data = await response.json();
      const updatedReviews: Review[] = data?.reviews ?? [];
      setAllReviews((prev) =>
        mergeProductReviews(prev, review.productId ?? '', updatedReviews),
      );
      toast.success('Review Changes Saved');
    } catch (error) {
      console.error('Error editing review', error);
    }
  };

  if (!featuredReviews.length) return null;

  return (
    <>
      <div className="flex flex-col items-center gap-1 pt-3 pb-1 text-center">
        <div className="average-product-rating">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center" aria-hidden="true">
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
        isAdmin={isAdmin}
        currentCustomerId={currentCustomerId}
        showProductLink
        onRemove={handleRemoveReview}
        onEdit={handleEditReview}
      />
    </>
  );
}

function FeaturedProductReviews({
  reviews,
  currentCustomerId,
}: {
  reviews: Promise<FeaturedReviewsQuery | null>;
  currentCustomerId?: string;
}) {
  return (
    <>
      <Separator />
      <div className="featured-reviews">
        <Suspense fallback={<div>Loading...</div>}>
          <Await resolve={reviews}>
            {(response) => {
              if (!response) return null;
              return (
                <FeaturedReviewsContent
                  response={response}
                  currentCustomerId={currentCustomerId}
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
