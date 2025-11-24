import React, { useState } from 'react';
import {useRouteLoaderData} from '@remix-run/react';
import {Card} from '../ui/card';
import {Rating, RatingButton} from 'components/ui/shadcn-io/rating';
import {Button} from '../ui/button';
interface Review {
  text?: string;
  createdAt?: string;
  customerId?: string;
  productId?: string;
  stars?: number | string;
  title?: string;
  customerName?: string;
}
interface ProductReviewsDisplayProps {
  review: Review;
  currentCustomerId?: string;
  onRemove?: (review: Review) => Promise<void> | void;
}

const ProductReviewsDisplay = ({
  review,
  currentCustomerId,
  onRemove,
}: ProductReviewsDisplayProps) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const routeData = useRouteLoaderData<{
    customer?: {customer?: {id?: string}};
  }>('routes/products.$handle');
  const loaderCustomerId = routeData?.customer?.customer?.id;
  const resolvedCurrentCustomerId = currentCustomerId ?? loaderCustomerId;
  const {title, stars, customerName, text, customerId} = review;
  const parsedStars =
    typeof stars === 'string' ? parseInt(stars, 10) : (stars ?? 0);
  const displayTitle = title?.trim() ? title : 'Review';
  const displayAuthor = customerName?.trim() ? customerName : 'Anonymous';
  const displayText = text ?? '';
  const isCurrentUserReview = Boolean(
    customerId &&
      resolvedCurrentCustomerId &&
      customerId === resolvedCurrentCustomerId,
  );

  const handleRemove = async () => {
    if (!onRemove) return;
    setIsRemoving(true);
    try {
      await onRemove(review);
    } finally {
      setIsRemoving(false);
    }
  };

  console.log(isCurrentUserReview, '6661iscurrentuserreview');
  console.log(currentCustomerId, '6662currentcustomerid');
  console.log(currentCustomerId, '6663customerid');

  return (
    <>
      <Card>
        {isCurrentUserReview ? (
          <>
            <h1>YOUR REVIEW</h1>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={isRemoving}
              className="mb-2"
            >
              {isRemoving ? 'Removing...' : 'Remove Review'}
            </Button>
          </>
        ) : null}
        <Rating value={parsedStars} readOnly>
          {Array.from({length: 5}).map((_, index) => (
            <RatingButton key={index} />
          ))}
        </Rating>
        <p>{displayTitle}</p>
        <p>Written by {displayAuthor}</p>
        <p>{displayText}</p>
      </Card>
    </>
  );
};

export default ProductReviewsDisplay;
