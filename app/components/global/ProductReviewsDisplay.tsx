import React, {useEffect, useState} from 'react';
import {Link, useRouteLoaderData} from '@remix-run/react';
import {Card, CardContent, CardHeader} from '../ui/card';
import {Rating, RatingButton} from 'components/ui/shadcn-io/rating';
import {Button} from '../ui/button';
import {Input} from '../ui/input';
import {ReloadIcon} from '@radix-ui/react-icons';
import ReviewMediaCarousel from './ReviewMediaCarousel';
import {CarouselZoom} from 'components/ui/shadcn-io/carousel-zoom';
import {ImageZoom} from 'components/ui/shadcn-io/image-zoom';
import ReviewVideoPlayer from './ReviewVideoPlayer';
import { replaceSpacesWithDashes } from '~/utils/grammer';

const REVIEW_CHAR_LIMIT = 200;

export interface Review {
  text?: string;
  createdAt?: string;
  customerId?: string;
  productId?: string;
  productName?: string;
  productHandle?: string;
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
  showProductLink?: boolean;
  onRemove?: (review: Review) => Promise<void> | void;
  onEdit?: (
    review: Review,
    updates: {
      text: string;
      title: string;
      stars: number;
      image?: File | null;
      video?: File | null;
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
  showProductLink = false,
}: ProductReviewsDisplayProps) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

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
    productId,
    productName,
    productHandle,
    customerImage,
    customerVideo,
  } = review;

  const productLinkHandle = productHandle?.trim()
    ? productHandle.trim()
    : replaceSpacesWithDashes(productName)?.toLowerCase();
  const productLinkPath = productLinkHandle
    ? `/products/${productLinkHandle}`
    : null;
  const urls = [
    {
      url: customerVideo,
      type: 'video',
      posterUrl: customerImage ?? undefined,
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
    setSelectedVideo(null);
    setVideoPreview(customerVideo ?? null);
    setEditIsFeatured(review.isFeatured ?? false);
  }, [
    displayTitle,
    displayText,
    parsedStars,
    customerImage,
    customerVideo,
    review.isFeatured,
  ]);

  const resetEditState = () => {
    setEditTitle(displayTitle);
    setEditText(displayText.slice(0, REVIEW_CHAR_LIMIT));
    setEditStars(parsedStars);
    setSelectedImage(null);
    setImagePreview(customerImage ?? null);
    setSelectedVideo(null);
    setVideoPreview(customerVideo ?? null);
    setEditIsFeatured(review.isFeatured ?? false);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedImage(file);
    setImagePreview(file ? URL.createObjectURL(file) : (customerImage ?? null));
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedVideo(file);
    setVideoPreview(file ? URL.createObjectURL(file) : (customerVideo ?? null));
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
        video: selectedVideo,
        isFeatured: isAdmin ? editIsFeatured : undefined,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="review-card w-full">
      {isEditing ? (
        <>
          <div className="review-container">
            <div className="review-left-side  review-left-side-display">
              <div className="stars-writtenby-buttons">
                <div className="flex items-center justify-center rating-and-author">
                  <div>
                    <Rating value={editStars} onValueChange={setEditStars}>
                      {Array.from({length: 5}).map((_, index) => (
                        <RatingButton key={index} className="stars" />
                      ))}
                    </Rating>
                    <div className='flex justify-center'>{displayAuthor}</div>
                  </div>
                </div>
                <div className="review-right-side-slot">
                  <div className="review-right-side-container">
                    <div className="reviewbuttons-container">
                      <div className="review-right-side">
                        <Button
                        size='reviewbtn'
                          onClick={handleEdit}
                          disabled={isSaving}
                          className="reviewbutton cursor-pointer mb-2"
                        >
                          {isSaving ? (
                            <ReloadIcon className="animate-spin" />
                          ) : (
                            'Save'
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size='reviewbtn'
                          onClick={() => {
                            resetEditState();
                            setIsEditing(false);
                          }}
                          disabled={isSaving}
                          className="cursor-pointer reviewbutton"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="mx-5 mb-4 mt-2 flex justify-center">

                  <div className="flex justify-center items-center font-semibold me-2">isFeatured:</div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size='reviewbtn'
                      variant={editIsFeatured ? 'default' : 'outline'}
                      onClick={() => setEditIsFeatured(true)}
                      disabled={isSaving}
                      className="cursor-pointer"
                    >
                      Yes
                    </Button>
                    <Button
                      type="button"
                      size='reviewbtn'
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
                <div className="px-2 my-1 flex justify-center">
                  <ImageZoom>
                    <img
                      src={imagePreview}
                      alt="Edited review"
                      className="max-h-56 object-contain mb-3 cursor-zoom-in"
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
                onChange={handleImageFileChange}
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
                  className="cursor-pointer mb-4 whitespace-normal text-center max-w-full"
                  disabled={isSaving}
                >
                  Replace Image
                </Button>
              </div>

              {videoPreview && (
                <div className="home-video px-2 pb-2">
                  <ReviewVideoPlayer
                    key={videoPreview}
                    className="home-video__player"
                    src={videoPreview}
                  />
                </div>
              )}

              {/* Video upload */}
              <input
                type="file"
                accept="video/*"
                className="hidden"
                id={`edit-video-${review.createdAt}`}
                onChange={handleVideoFileChange}
              />
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    document
                      .getElementById(`edit-video-${review.createdAt}`)
                      ?.click()
                  }
                  className="cursor-pointer mb-4 whitespace-normal text-center max-w-full"
                  disabled={isSaving}
                >
                  Replace Video
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
                    <div className="flex items-center justify-center rating-and-author">
                      <div>
                        <Rating value={parsedStars} readOnly>
                          {Array.from({length: 5}).map((_, index) => (
                            <RatingButton key={index} className="stars" />
                          ))}
                        </Rating>

                        <div className='flex justify-center'>{displayAuthor}</div>
                      </div>
                    </div>
                    
                    <div className="review-right-side-slot">
                      <div className="review-right-side-container">
                        <div className="reviewbuttons-container">
                          <div className="review-right-side">
                            <Button
                              variant="destructive"
                              size='reviewbtn'
                              onClick={handleRemove}
                              disabled={isRemoving}
                              className="mb-2 cursor-pointer reviewbutton"
                            >
                              {isRemoving ? (
                                <ReloadIcon className="animate-spin" />
                              ) : (
                                'Delete'
                              )}
                            </Button>

                            <Button
                              variant="secondary"
                              size='reviewbtn'
                              onClick={() => {
                                resetEditState();
                                setIsEditing(true);
                              }}
                              disabled={isSaving}
                              className="cursor-pointer reviewbutton"
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
                  <div className="stars-writtenby pt-4">
                    <div className="flex items-center justify-center">
                      <div>
                        <div className="flex justify-center">
                          <Rating value={parsedStars} readOnly>
                            {Array.from({length: 5}).map((_, index) => (
                              <RatingButton key={index} className="stars" />
                            ))}
                          </Rating>
                        </div>

                        <div className='flex justify-center'>{displayAuthor}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {showProductLink && productLinkPath && (
                <div className="w-full flex justify-center pt-1">
                  <Link
                    to={productLinkPath}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:text-primary py-1 px-2 mb-2 mt-1"
                  >
                    {productName ?? 'View product'}
                  </Link>
                </div>
              )}
                <div className="customer-media-container pt-2 rounded-md">
                {customerImage && customerVideo ? (
                  <CarouselZoom items={urls}>
                    {(openAtIndex) => (
                      <ReviewMediaCarousel
                        url={urls}
                        onMediaClick={openAtIndex}
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
                      <CarouselZoom items={[{url: customerVideo, type: 'video'}]}>
                        {(openAtIndex) => (
                          <div className="home-video px-2 pb-2">
                            <ReviewVideoPlayer
                              className="home-video__player"
                              src={customerVideo}
                              showControls={false}
                              showPlayOverlay
                              onPlayClick={() =>
                                openAtIndex(0, {autoplay: true})
                              }
                            />
                          </div>
                        )}
                      </CarouselZoom>
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
