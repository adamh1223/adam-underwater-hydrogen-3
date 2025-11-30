import React, {useEffect, useState} from 'react';
import {useRouteLoaderData} from '@remix-run/react';
import {Card, CardContent, CardHeader} from '../ui/card';
import {Rating, RatingButton} from 'components/ui/shadcn-io/rating';
import {Button} from '../ui/button';
import {Input} from '../ui/input';
export interface Review {
  text?: string;
  createdAt?: string;
  customerId?: string;
  productId?: string;
  stars?: number | string;
  title?: string;
  customerName?: string;
  customerImage?: string;
}
interface ProductReviewsDisplayProps {
  review: Review;
  currentCustomerId?: string;
  onRemove?: (review: Review) => Promise<void> | void;
  onEdit?: (
    review: Review,
    updates: {text: string; title: string; stars: number; image?: File | null},
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
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const routeData = useRouteLoaderData<{
    customer?: {customer?: {id?: string}};
  }>('routes/products.$handle');
  const loaderCustomerId = routeData?.customer?.customer?.id;
  const resolvedCurrentCustomerId = currentCustomerId ?? loaderCustomerId;
  const {title, stars, customerName, text, customerId, customerImage} = review;
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
    setSelectedImage(null);
    setImagePreview(customerImage ?? null);
  }, [customerImage, displayText, displayTitle, parsedStars]);

  const resetEditState = () => {
    setEditTitle(displayTitle);
    setEditText(displayText);
    setEditStars(parsedStars);
    setSelectedImage(null);
    setImagePreview(customerImage ?? null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

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
        image: selectedImage,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card className="mb-5">
        {isEditing ? (
          <>
            <p className="mb-2 text-sm text-muted-foreground">Current review</p>
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
            <div className="mt-3">
              <p className="mb-2 text-sm text-muted-foreground">Image</p>
              {imagePreview ? (
                <div className="mb-3">
                  <img
                    src={imagePreview}
                    alt={`${displayTitle} image attachment`}
                    className="max-h-64 rounded object-contain"
                  />
                </div>
              ) : null}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id={`edit-image-${review.createdAt}`}
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  document.getElementById(`edit-image-${review.createdAt}`)?.click()
                }
                className="cursor-pointer"
                disabled={isSaving}
              >
                Upload new image
              </Button>
            </div>
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
                onClick={() => {
                  resetEditState();
                  setIsEditing(false);
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="review-container">
              <div className="ps-5 py-3 review-left-side">
                <Rating value={parsedStars} readOnly>
                  {Array.from({length: 5}).map((_, index) => (
                    <RatingButton key={index} className="stars" />
                  ))}
                </Rating>
                <p>Written by {displayAuthor}</p>
                <Card className="mt-3 mb-1">
                  <CardHeader>
                    <p>
                      <strong>{displayTitle}</strong>
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p>{displayText}</p>
                    {customerImage ? (
                      <div className="mt-4">
                        <img
                          src={customerImage}
                          alt={`${displayTitle} image attachment`}
                          className="max-h-64 rounded object-contain"
                        />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
              <div className="review-right-side-container">
                {isCurrentUserReview ? (
                  <>
                    <div className="pe-5 p-3 flex justify-end">
                      <div className="review-right-side">
                        <div className="pb-3 flex justify-center ">
                          Your Review
                        </div>
                        <div className="">
                          <Button
                            variant="destructive"
                            onClick={handleRemove}
                            disabled={isRemoving}
                            className="mb-2 cursor-pointer w-32 "
                          >
                            {isRemoving ? 'Removing...' : 'Remove Review'}
                          </Button>
                        </div>
                        <div className="">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              resetEditState();
                              setIsEditing((prev) => !prev);
                            }}
                            disabled={isSaving}
                            className="cursor-pointer w-32"
                          >
                            {isEditing ? 'Cancel edit' : 'Edit Review'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
};

export default ProductReviewsDisplay;
