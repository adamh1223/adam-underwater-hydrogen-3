import React from 'react';
import {Card} from '../ui/card';
import {Rating, RatingButton} from 'components/ui/shadcn-io/rating';
interface Review {
  review: string;
  productId: string;
  customerId: string;
  stars: string;
  title: string;
  customerName: string;
}

const ProductReviewsDisplay = (review: Review) => {
  const title = review?.title;
  const productId = review?.productId;
  const customerId = review?.customerId;
  const stars = review?.stars;
  const customerName = review?.customerName;
  const reviewText = review?.review;

  return (
    <>
      <Card>
        <Rating value={parseInt(stars)} readOnly>
          {Array.from({length: 5}).map((_, index) => (
            <RatingButton key={index} />
          ))}
        </Rating>
        <p>{title}</p>
        <p>Written by {customerName}</p>
        <p>{reviewText}</p>
      </Card>
    </>
  );
};

export default ProductReviewsDisplay;
