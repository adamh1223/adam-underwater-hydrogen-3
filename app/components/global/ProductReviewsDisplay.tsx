import React, {useEffect, useState} from 'react';
import {useRouteLoaderData} from '@remix-run/react';
import {Card, CardContent, CardHeader} from '../ui/card';
import {Rating, RatingButton} from 'components/ui/shadcn-io/rating';
import {Button} from '../ui/button';
import {Input} from '../ui/input';
import {ReloadIcon} from '@radix-ui/react-icons';
import ReviewMediaCarousel from './ReviewMediaCarousel';
import {CarouselZoom} from 'components/ui/shadcn-io/carousel-zoom';
import {ImageZoom} from 'components/ui/shadcn-io/image-zoom';

const REVIEW_CHAR_LIMIT = 200;

export interface Review {
  text?: string;
  createdAt?: string;
  customerId?: string;
  productId?: string;
  stars?: number | string;
  title?: string;
  customerName?: string;
  customerImage?: string;
  customerVideo?: string;
  isFeatured?: boolean;
}

interface ProductReviewsDisplayProps {
  review: Review;
  isAdmin: Boolean;
  currentCustomerId?: string;
  onRemove?: (review: Review) => Promise<void> | void;
  onEdit?: (
    review: Review,
    updates: {
      text: string;
      title: string;
      stars: number;
      image?: File | null;
      isFeatured?: boolean;
    },
  ) => Promise<void> | void;
}

const ProductReviewsDisplay = ({
  review,
  currentCustomerId,
  onRemove,
  onEdit,
  isAdmin,
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
  const resolvedCustomerId = currentCustomerId ?? loaderCustomerId;

  const {
    title,
    stars,
    customerName,
    text,
    customerId,
    customerImage,
    customerVideo,
  } = review;
  console.log(review, 'reviewlog');
  const urls = [
    {
      url: customerVideo,
      type: 'video',
    },
    {
      url: customerImage,
      type: 'image',
    },
  ];

  const parsedStars =
    typeof stars === 'string' ? parseInt(stars, 10) : (stars ?? 0);

  const displayTitle = title?.trim() ? title : 'Review';
  const displayAuthor = customerName?.trim() ? customerName : 'Anonymous';
  const displayText = text ?? '';
  const displayDate = (() => {
    const iso = review.createdAt;
    if (!iso) return '';

    // Expecting: YYYY-MM-DDT...
    const year = iso.slice(0, 4);
    const month = iso.slice(5, 7);
    const day = iso.slice(8, 10);

    if (!year || !month || !day) return iso;

    return `${Number(month)}/${Number(day)}/${year}`;
  })();

  const [editTitle, setEditTitle] = useState(displayTitle);
  const [editText, setEditText] = useState(
    displayText.slice(0, REVIEW_CHAR_LIMIT),
  );
  const [editStars, setEditStars] = useState(parsedStars);
  const [editIsFeatured, setEditIsFeatured] = useState(
    review.isFeatured ?? false,
  );

  const isCurrentUserReview =
    customerId && resolvedCustomerId && customerId === resolvedCustomerId;

  /** Sync displayed review -> editor state */
  useEffect(() => {
    setEditTitle(displayTitle);
    setEditText(displayText.slice(0, REVIEW_CHAR_LIMIT));
    setEditStars(parsedStars);
    setSelectedImage(null);
    setImagePreview(customerImage ?? null);
    setEditIsFeatured(review.isFeatured ?? false);
  }, [
    displayTitle,
    displayText,
    parsedStars,
    customerImage,
    review.isFeatured,
  ]);

  const resetEditState = () => {
    setEditTitle(displayTitle);
    setEditText(displayText.slice(0, REVIEW_CHAR_LIMIT));
    setEditStars(parsedStars);
    setSelectedImage(null);
    setImagePreview(customerImage ?? null);
    setEditIsFeatured(review.isFeatured ?? false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedImage(file);
    setImagePreview(file ? URL.createObjectURL(file) : (customerImage ?? null));
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
        isFeatured: isAdmin ? editIsFeatured : undefined,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="review-card h-full w-full">
      {isEditing ? (
        <>
          <div className="review-container">
            <div className="review-left-side">
              <div className="stars-writtenby-buttons">
                <div className="flex items-center justify-center">
                  <div>
                    <Rating value={editStars} onValueChange={setEditStars}>
                      {Array.from({length: 5}).map((_, index) => (
                        <RatingButton key={index} className="stars" />
                      ))}
                    </Rating>
                    <p>Written by {displayAuthor}</p>
                  </div>
                </div>
                <div>
                  <div className="review-right-side-container">
                    <div className="ps-1 pt-2 pe-2 flex justify-end">
                      <div className="review-right-side">
                        <Button
                          onClick={handleEdit}
                          disabled={isSaving}
                          className="cursor-pointer w-14 mb-2"
                        >
                          {isSaving ? (
                            <ReloadIcon className="animate-spin" />
                          ) : (
                            'Save'
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => {
                            resetEditState();
                            setIsEditing(false);
                          }}
                          disabled={isSaving}
                          className="cursor-pointer w-14"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="mx-5 mb-4">
                  <p className="mb-2 font-semibold">isFeatured:</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={editIsFeatured ? 'default' : 'outline'}
                      onClick={() => setEditIsFeatured(true)}
                      disabled={isSaving}
                      className="cursor-pointer"
                    >
                      Yes
                    </Button>
                    <Button
                      type="button"
                      variant={!editIsFeatured ? 'default' : 'outline'}
                      onClick={() => setEditIsFeatured(false)}
                      disabled={isSaving}
                      className="cursor-pointer"
                    >
                      No
                    </Button>
                  </div>
                </div>
              )}

              {imagePreview && (
                <div className="mt-3 flex justify-center">
                  <ImageZoom>
                    <img
                      src={imagePreview}
                      alt="Edited review"
                      className="max-h-56 rounded object-contain mb-3 cursor-zoom-in"
                    />
                  </ImageZoom>
                </div>
              )}

              {/* Image upload */}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id={`edit-image-${review.createdAt}`}
                onChange={handleFileChange}
              />
              <div className="flex justify-center">
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
                  Upload New Image
                </Button>
              </div>
              <div className="title-body-character-limit mx-5">
                {/* Title */}
                <p className="mb-2 font-semibold">Title:</p>
                <Input
                  name="title"
                  placeholder="Title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mb-2"
                />

                {/* Body */}
                <p className="mb-2 font-semibold">Body:</p>
                <Input
                  name="review"
                  placeholder="Write your review"
                  value={editText}
                  onChange={(e) =>
                    setEditText(e.target.value.slice(0, REVIEW_CHAR_LIMIT))
                  }
                  className="mb-2"
                />
                <div className="flex items-center justify-between text-sm mt-1 mb-2">
                  <span
                    className={
                      editText.length >= REVIEW_CHAR_LIMIT
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }
                  >
                    {editText.length}/{REVIEW_CHAR_LIMIT}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="review-container">
            <div className="review-left-side review-left-side-display">
              {(isCurrentUserReview || isAdmin) && (
                <>
                  <div className="stars-writtenby-buttons">
                    <div className="flex items-center justify-center">
                      <div>
                        <Rating value={parsedStars} readOnly>
                          {Array.from({length: 5}).map((_, index) => (
                            <RatingButton key={index} className="stars" />
                          ))}
                        </Rating>

                        <p>Written by {displayAuthor}</p>
                      </div>
                    </div>
                    <div>
                      <div className="review-right-side-container">
                        <div className="ps-1 pt-2 pe-2 flex justify-end">
                          <div className="review-right-side">
                            <Button
                              variant="destructive"
                              onClick={handleRemove}
                              disabled={isRemoving}
                              className="mb-2 cursor-pointer w-14"
                            >
                              {isRemoving ? (
                                <ReloadIcon className="animate-spin" />
                              ) : (
                                'Delete'
                              )}
                            </Button>

                            <Button
                              variant="secondary"
                              onClick={() => {
                                resetEditState();
                                setIsEditing(true);
                              }}
                              disabled={isSaving}
                              className="cursor-pointer w-14"
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {!isCurrentUserReview && !isAdmin && (
                <>
                  <div className="stars-writtenby py-4">
                    <div className="flex items-center justify-center">
                      <div>
                        <div className="flex justify-center">
                          <Rating value={parsedStars} readOnly>
                            {Array.from({length: 5}).map((_, index) => (
                              <RatingButton key={index} className="stars" />
                            ))}
                          </Rating>
                        </div>

                        <p>Written by {displayAuthor}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
                <div className="customer-media-container">
                {customerImage && customerVideo ? (
                  <CarouselZoom items={urls}>
                    {(openAtIndex) => (
                      <ReviewMediaCarousel
                        url={urls}
                        onImageClick={openAtIndex}
                      />
                    )}
                  </CarouselZoom>
                ) : (
                  <>
                    {customerImage && (
                      <div className="mb-3 flex justify-center">
                        <ImageZoom>
                          <img
                            src={customerImage}
                            alt="Review"
                            className="max-h-56 rounded object-contain cursor-zoom-in"
                          />
                        </ImageZoom>
                      </div>
                    )}
                    {customerVideo && (
                      <>
                        <div className="home-video px-2">
                          <video
                            className="home-video__player"
                            controls
                            playsInline
                            preload="metadata"
                          >
                            <source src={customerVideo} type="video/mp4" />
                          </video>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
              <Card className="review-summary-card mt-3 mb-2 mx-2">
                <div>
                  <div className="ps-5 pt-3">
                    <p className="review-title font-bold">{displayTitle}</p>
                  </div>
                  <div className="ps-5">
                    <p className="text-muted-foreground text-sm">
                      {displayDate}
                    </p>
                  </div>
                </div>
                <CardContent>
                  <p className="review-body">{displayText}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export default ProductReviewsDisplay;
