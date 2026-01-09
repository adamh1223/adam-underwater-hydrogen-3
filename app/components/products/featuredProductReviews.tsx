import {Await} from '@remix-run/react';
import {Suspense, useState} from 'react';
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
              const featuredReviews = response.products.nodes.flatMap((node) =>
                parseReviewsValue(node.metafield?.value).filter(
                  (review) => review.isFeatured === true,
                ),
              );

              if (!featuredReviews.length) return null;
              let parsedReviews: any[] = [];
              try {
                const rawReviews = featuredReviews;
                parsedReviews = rawReviews
                  ? (JSON.parse(rawReviews) as any[])
                  : [];
              } catch (error) {
                console.error(
                  'Unable to parse product reviews metafield',
                  error,
                );
                parsedReviews = [];
              }
              const [reviewsList, setReviewsList] = useState(parsedReviews);
              const updateExistingReviews = (newReviews: any[]) => {
                setReviewsList(newReviews);
              };
              const handleEditReview = async (
                reviewToEdit: any,
                updates: {
                  text: string;
                  title: string;
                  stars: number;
                  image?: File | null;
                  isFeatured?: boolean;
                },
              ) => {
                if (!currentCustomerId || !reviewToEdit?.createdAt) return;

                const form = new FormData();
                form.append('productId', product.id);
                form.append('customerId', currentCustomerId);
                form.append('createdAt', reviewToEdit.createdAt);
                form.append('review', updates.text);
                form.append('stars', updates.stars.toString());
                form.append('title', updates.title);
                form.append('customerName', customerName);
                if (updates.image) {
                  form.append('image', updates.image);
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
                    console.error(
                      'Failed to edit review',
                      await response.text(),
                    );
                    return;
                  }

                  const data = await response.json();
                  const updatedReviews = data?.reviews ?? [];
                  setReviewsList(updatedReviews);
                } catch (error) {
                  console.error('Error editing review', error);
                }
              };
              return (
                <ProductReviewsCarousel
                  reviews={featuredReviews}
                  isAdmin={
                    currentCustomerId === 'gid://shopify/Customer/7968375079049'
                  }
                  currentCustomerId={currentCustomerId}
                  onEdit={}
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
