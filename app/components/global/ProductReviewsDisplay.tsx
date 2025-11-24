import React from 'react';
import {Card} from '../ui/card';
import {Rating, RatingButton} from 'components/ui/shadcn-io/rating';
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
}

const ProductReviewsDisplay = ({review}: ProductReviewsDisplayProps) => {
  const {title, stars, customerName, text} = review;
  const parsedStars =
    typeof stars === 'string' ? parseInt(stars, 10) : (stars ?? 0);

  return (
    <>
      <Card>
        <Rating value={parsedStars} readOnly>
          {Array.from({length: 5}).map((_, index) => (
            <RatingButton key={index} />
          ))}
        </Rating>
        <p>{title}</p>
        <p>Written by {customerName}</p>
        <p>{text}</p>
      </Card>
    </>
  );
};

export default ProductReviewsDisplay;
