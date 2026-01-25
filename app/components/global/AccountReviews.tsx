import React, {useEffect, useMemo, useState} from 'react';
import {Link} from '@remix-run/react';
import {ArrowRightIcon} from '@radix-ui/react-icons';
import {Card, CardContent, CardHeader, CardTitle} from '~/components/ui/card';
import ProductReviewsDisplay, {
  type Review,
} from '~/components/global/ProductReviewsDisplay';
import ProductCarousel from '../products/productCarousel';

interface AccountReviewsProps {
  products: ProductReviewSource[];
  customerId?: string | null;
  customerName?: string;
  wishlistProducts?: string[];
  isLoggedIn?: Promise<boolean> | undefined;
}

interface ProductReviewSource {
  id: string;
  title: string;
  handle: string;
  tags?: string[];
  images?: {nodes?: {url: string; altText?: string | null}[]};
  priceRange?: {
    minVariantPrice?: {
      amount: string;
      currencyCode: string;
    };
  };
  featuredImage?: {
    url: string;
    altText?: string | null;
  } | null;
  metafield?: {
    value?: string | null;
  } | null;
}

interface UserProductReview {
  productId: string;
  productTitle: string;
  productHandle: string;
  //   productImage?: {
  //     url: string;
  //     altText?: string | null;
  //   } | null;
  product: ProductReviewSource;
  review: Review;
}

const parseReviews = (
  products: ProductReviewSource[],
  customerId?: string | null,
): UserProductReview[] => {
  if (!customerId) return [];

  return products.flatMap((product) => {
    const productWithFallbackImage: ProductReviewSource = {
      ...product,
      tags: product.tags ?? [],
      images:
        product.images ??
        (product.featuredImage
          ? {
              nodes: [
                {
                  url: product.featuredImage.url,
                  altText: product.featuredImage.altText ?? product.title,
                },
              ],
            }
          : undefined),
    };
    const rawValue = product.metafield?.value;
    let parsedProductReviews: Review[] = [];

    if (rawValue) {
      try {
        parsedProductReviews = JSON.parse(rawValue) as Review[];
      } catch (error) {
        console.error('Unable to parse product reviews metafield', error);
      }
    }

    return parsedProductReviews
      .filter((review) => review.customerId === customerId)
      .map((review) => ({
        productId: product.id,
        productTitle: product.title,
        productHandle: product.handle,
        product: productWithFallbackImage,
        review,
      }));
  });
};

const AccountReviews = ({
  products,
  customerId,
  customerName,
  wishlistProducts,
  isLoggedIn,
}: AccountReviewsProps) => {
  const initialReviews = useMemo(
    () => parseReviews(products, customerId),
    [products, customerId],
  );

  const [userReviews, setUserReviews] =
    useState<UserProductReview[]>(initialReviews);

  useEffect(() => {
    setUserReviews(parseReviews(products, customerId));
  }, [products, customerId]);

  const handleRemoveReview = async (entry: UserProductReview) => {
    if (!customerId || !entry.review?.createdAt) return;

    const form = new FormData();
    form.append('productId', entry.productId);
    form.append('customerId', customerId);
    form.append('createdAt', entry.review.createdAt);

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

      setUserReviews((prev) => {
        const matching = updatedReviews.find(
          (review) =>
            review.customerId === customerId &&
            review.createdAt === entry.review.createdAt,
        );

        if (!matching) {
          return prev.filter(
            (item) =>
              !(
                item.productId === entry.productId &&
                item.review.createdAt === entry.review.createdAt
              ),
          );
        }

        return prev.map((item) =>
          item.productId === entry.productId &&
          item.review.createdAt === entry.review.createdAt
            ? {...item, review: matching}
            : item,
        );
      });
    } catch (error) {
      console.error('Error removing review', error);
    }
  };

  const handleEditReview = async (
    entry: UserProductReview,
    updates: {
      text: string;
      title: string;
      stars: number;
      image?: File | null;
      video?: File | null;
      isFeatured?: boolean;
    },
  ) => {
    if (!customerId || !entry.review?.createdAt) return;

    const form = new FormData();
    form.append('productId', entry.productId);
    form.append('customerId', customerId);
    form.append('createdAt', entry.review.createdAt);
    form.append('review', updates.text);
    form.append('stars', updates.stars.toString());
    form.append('title', updates.title);
    form.append('customerName', customerName ?? '');
    if (updates.image) {
      form.append('image', updates.image);
    }
    if (updates.video) {
      form.append('video', updates.video);
    }
    if (typeof updates.isFeatured === 'boolean') {
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

      setUserReviews((prev) => {
        const matching = updatedReviews.find(
          (review) =>
            review.customerId === customerId &&
            review.createdAt === entry.review.createdAt,
        );

        if (!matching) return prev;

        return prev.map((item) =>
          item.productId === entry.productId &&
          item.review.createdAt === entry.review.createdAt
            ? {...item, review: matching}
            : item,
        );
      });
    } catch (error) {
      console.error('Error editing review', error);
    }
  };

  if (!userReviews.length) {
    return (
      <div className="mt-4 text-center text-muted-foreground">
        <p>You haven&apos;t left any reviews yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {userReviews.map((entry) => (
        <div
          key={`${entry.productId}-${entry.review.createdAt}`}
          className="grid gap-4 md:grid-cols-[1fr_auto_1fr] items-stretch mx-[30px]"
        >
          <div className="h-full">
            <ProductCarousel
              product={entry.product}
              layout="grid"
              isInWishlist={
                wishlistProducts?.includes(entry.productId) ?? false
              }
              isLoggedIn={isLoggedIn}
            />
          </div>

          <div className="hidden md:flex items-center">
            <div className="w-full h-px bg-muted" />
            <ArrowRightIcon className="mx-2 text-muted-foreground" />
            <div className="w-full h-px bg-muted" />
          </div>

          <div className="flex flex-col gap-2 mb-5">
            <div className="md:hidden flex items-center justify-center">
              <ArrowRightIcon className="text-muted-foreground" />
            </div>
            <ProductReviewsDisplay
              review={entry.review}
              currentCustomerId={customerId ?? undefined}
              onRemove={() => handleRemoveReview(entry)}
              onEdit={(review, update) => handleEditReview(entry, update)}
              isAdmin={false}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default AccountReviews;
