import React, {useEffect, useState} from 'react';
import {useRouteLoaderData} from '@remix-run/react';
import {Card} from '../ui/card';
import {Rating, RatingButton} from 'components/ui/shadcn-io/rating';
import {Button} from '../ui/button';
import {Input} from '../ui/input';
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
  onEdit?: (
    review: Review,
    updates: {text: string; title: string; stars: number},
  ) => Promise<void> | void;
}

const ProductReviewsDisplay = ({
  review,
  currentCustomerId,
  onRemove,
  onEdit,
}: ProductReviewsDisplayProps) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
  const [editTitle, setEditTitle] = useState(displayTitle);
  const [editText, setEditText] = useState(displayText);
  const [editStars, setEditStars] = useState(parsedStars);
  const isCurrentUserReview = Boolean(
    customerId &&
      resolvedCurrentCustomerId &&
      customerId === resolvedCurrentCustomerId,
  );

  useEffect(() => {
    setEditTitle(displayTitle);
    setEditText(displayText);
    setEditStars(parsedStars);
  }, [displayTitle, displayText, parsedStars]);

  const handleRemove = async () => {
    if (!onRemove) return;
    setIsRemoving(true);
    try {
      await onRemove(review);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleEdit = async () => {
    if (!onEdit) return;
    setIsSaving(true);
    try {
      await onEdit(review, {
        text: editText,
        title: editTitle,
        stars: editStars,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card>
        {isEditing ? (
          <>
            <Input
              name="title"
              placeholder="Title"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              className="mb-2"
            />
            <Input
              name="review"
              placeholder="Write your review"
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
              className="mb-2"
            />
            <Rating value={editStars} onValueChange={setEditStars}>
              {Array.from({length: 5}).map((_, index) => (
                <RatingButton key={index} className="stars" />
              ))}
            </Rating>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={handleEdit}
                disabled={isSaving}
                className="cursor-pointer"
              >
                {isSaving ? 'Saving...' : 'Save Review'}
              </Button>
              <Button
                className="cursor-pointer"
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <Rating value={parsedStars} readOnly>
                {Array.from({length: 5}).map((_, index) => (
                  <RatingButton key={index} className="stars" />
                ))}
              </Rating>
              <p>Written by {displayAuthor}</p>
              <p>{displayTitle}</p>
              <p>{displayText}</p>
            </div>
            {isCurrentUserReview ? (
              <>
                <div className="flex justify-end">
                  <div>
                    <h1>YOUR REVIEW</h1>
                    <Button
                      variant="destructive"
                      onClick={handleRemove}
                      disabled={isRemoving}
                      className="mb-2 cursor-pointer"
                    >
                      {isRemoving ? 'Removing...' : 'Remove Review'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setIsEditing((prev) => !prev)}
                      disabled={isSaving}
                      className="mb-2 ml-2 cursor-pointer"
                    >
                      {isEditing ? 'Cancel edit' : 'Edit Review'}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
};

export default ProductReviewsDisplay;
