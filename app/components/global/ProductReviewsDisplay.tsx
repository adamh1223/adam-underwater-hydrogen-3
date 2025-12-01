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
      <Card className="review-card mb-5 h-full w-full">
        {isEditing ? (
          <>
            <div className="review-container">
              <div className="ps-5 py-3 review-left-side">
                <p className="mb-2 text-sm text-muted-foreground">
                  Current review
                </p>
                <Rating value={editStars} onValueChange={setEditStars}>
                  {Array.from({length: 5}).map((_, index) => (
                    <RatingButton key={index} className="stars" />
                  ))}
                </Rating>
                <div className="mt-3">
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
                      document
                        .getElementById(`edit-image-${review.createdAt}`)
                        ?.click()
                    }
                    className="cursor-pointer mb-4"
                    disabled={isSaving}
                  >
                    Upload new image
                  </Button>
                </div>
                <p className="mb-2">
                  <strong>Title:</strong>
                </p>
                <Input
                  name="title"
                  placeholder="Title"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className="mb-2"
                />
                <p className="mb-2">
                  <strong>Body:</strong>
                </p>
                <Input
                  name="review"
                  placeholder="Write your review"
                  value={editText}
                  onChange={(event) => setEditText(event.target.value)}
                  className="mb-2"
                />
              </div>

              <div className="review-right-side-container">
                <div className="pe-5 p-3 flex justify-end">
                  <div className="review-right-side">
                    <div>
                      <Button
                        onClick={handleEdit}
                        disabled={isSaving}
                        className="cursor-pointer w-14 mb-2"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                    <div>
                      <Button
                        className="cursor-pointer w-14"
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
                  </div>
                </div>
              </div>
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
                {customerImage ? (
                  <div className="mt-4">
                    <img
                      src={customerImage}
                      alt={`${displayTitle} image attachment`}
                      className="max-h-64 rounded object-contain"
                    />
                  </div>
                ) : null}
                <Card className="mt-3 mb-1">
                  <CardHeader>
                    <p className="review-title">
                      <strong>{displayTitle}</strong>
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="review-body">{displayText}</p>
                  </CardContent>
                </Card>
              </div>
              <div className="review-right-side-container">
                {isCurrentUserReview ? (
                  <>
                    <div className="pe-5 p-3 flex justify-end">
                      <div className="review-right-side">
                        <div className="">
                          <Button
                            variant="destructive"
                            onClick={handleRemove}
                            disabled={isRemoving}
                            className="mb-2 cursor-pointer w-14"
                          >
                            {isRemoving ? 'Removing...' : 'Delete'}
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
                            className="cursor-pointer w-14"
                          >
                            {isEditing ? 'Cancel edit' : 'Edit'}
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
