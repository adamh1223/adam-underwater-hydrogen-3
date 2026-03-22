import React, {useEffect, useRef, useState} from 'react';
import {Input} from '../ui/input';
import {Button} from '../ui/button';
import {Rating, RatingButton} from 'components/ui/shadcn-io/rating';
import Sectiontitle from '../global/Sectiontitle';
import {ReloadIcon} from '@radix-ui/react-icons';
import {Link, useNavigate} from '@remix-run/react';
import {toast} from 'sonner';
import {LuCopy} from 'react-icons/lu';
import type {ReviewMediaDiscountReward} from '~/lib/reviewMediaDiscountReward';

const REVIEW_CHAR_LIMIT = 200;

type ReviewFormSuccessToast = {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

function ReviewForm({
  productId,
  productName,
  customerId,
  customerName,
  customerState,
  customerCountry,
  updateExistingReviews,
  userReviewExists,
  isBlocked,
  successToast,
  submittedMessage,
  showDiscountPromo = false,
  reviewMediaDiscountReward = null,
  onReviewMediaDiscountRewardChange,
  showSignInToUseCode = false,
  signInUrl,
  precomputedDiscountUsesRemaining,
}: {
  productId: string;
  productName: string;
  customerId: string | undefined;
  customerName: string | undefined;
  customerState?: string;
  customerCountry?: string;
  userReviewExists: boolean;
  isBlocked: boolean;
  updateExistingReviews: (reviews: any[]) => void;
  successToast?: ReviewFormSuccessToast;
  submittedMessage?: string;
  showDiscountPromo?: boolean;
  reviewMediaDiscountReward?: ReviewMediaDiscountReward | null;
  onReviewMediaDiscountRewardChange?: (
    reward: ReviewMediaDiscountReward | null,
  ) => void;
  /** When true, show a "Sign in to use code" link below the revealed discount code. */
  showSignInToUseCode?: boolean;
  /** URL for the sign-in link shown when `showSignInToUseCode` is true. */
  signInUrl?: string;
  /**
   * Pre-computed discount uses remaining (0 or 1). When provided (not undefined),
   * the component skips the authenticated `/api/review-discount-usage` call.
   */
  precomputedDiscountUsesRemaining?: number | null;
}) {
  const [pendingReviewSubmit, setPendingReviewSubmit] = useState(false);
  const [review, setReview] = useState('');
  const [stars, setStars] = useState(0);
  const [title, setTitle] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileVideoInputRef = useRef<HTMLInputElement | null>(null);
  const copyLabelTimerRef = useRef<number | null>(null);
  const copySplashStartTimerRef = useRef<number | null>(null);
  const copySplashStopTimerRef = useRef<number | null>(null);

  const [reviewSubmittedMessage, setReviewSubmittedMessage] =
    useState<string>();
  const [customerReviewMediaDiscountReward, setCustomerReviewMediaDiscountReward] =
    useState<ReviewMediaDiscountReward | null>(reviewMediaDiscountReward);
  const [codeCopied, setCodeCopied] = useState(false);
  const [copySplashActive, setCopySplashActive] = useState(false);
  const [discountUsesRemaining, setDiscountUsesRemaining] = useState<
    number | null
  >(null);
  const navigate = useNavigate();

  useEffect(() => {
    setCustomerReviewMediaDiscountReward(reviewMediaDiscountReward);
  }, [reviewMediaDiscountReward]);

  // Sync precomputed discount uses remaining from the parent (e.g. token page loader).
  useEffect(() => {
    if (typeof precomputedDiscountUsesRemaining === 'number') {
      setDiscountUsesRemaining(precomputedDiscountUsesRemaining);
    }
  }, [precomputedDiscountUsesRemaining]);

  useEffect(
    () => () => {
      if (copyLabelTimerRef.current) {
        window.clearTimeout(copyLabelTimerRef.current);
      }
      if (copySplashStartTimerRef.current) {
        window.clearTimeout(copySplashStartTimerRef.current);
      }
      if (copySplashStopTimerRef.current) {
        window.clearTimeout(copySplashStopTimerRef.current);
      }
    },
    [],
  );

  const rewardForCurrentProduct =
    customerReviewMediaDiscountReward?.productId === productId
      ? customerReviewMediaDiscountReward
      : null;
  const shouldShowDiscountPromo =
    showDiscountPromo &&
    (!customerReviewMediaDiscountReward || Boolean(rewardForCurrentProduct));
  const discountCode = rewardForCurrentProduct?.discountCode ?? null;

  const discountRevealed = Boolean(discountCode);
  const hasQueuedMedia = Boolean(
    selectedImage || selectedVideo || imagePreview || videoPreview,
  );
  const showPromoBesideUploads =
    shouldShowDiscountPromo && !reviewSubmittedMessage && !hasQueuedMedia;
  const showPromoBelowSubmit =
    shouldShowDiscountPromo && !reviewSubmittedMessage && hasQueuedMedia;
  const showPromoAfterSubmission =
    shouldShowDiscountPromo && Boolean(reviewSubmittedMessage);

  useEffect(() => {
    if (reviewSubmittedMessage) {
      const timer = setTimeout(
        () => setReviewSubmittedMessage(undefined),
        2500,
      );
      return () => clearTimeout(timer);
    }
  }, [reviewSubmittedMessage]);

  useEffect(() => {
    let isCancelled = false;

    const resolveUsage = async () => {
      // When a precomputed value is provided (token page), skip the
      // authenticated API call entirely — it would return 401.
      if (precomputedDiscountUsesRemaining !== undefined) return;

      if (!discountCode || !customerId) {
        setDiscountUsesRemaining(null);
        return;
      }

      try {
        const response = await fetch(
          `/api/review-discount-usage?code=${encodeURIComponent(discountCode)}`,
          {
            headers: {Accept: 'application/json'},
          },
        );

        if (!response.ok) {
          if (!isCancelled) {
            setDiscountUsesRemaining(null);
          }
          return;
        }

        const json = (await response.json()) as {
          usesRemaining?: number;
        };
        if (isCancelled) return;
        if (typeof json.usesRemaining === 'number') {
          setDiscountUsesRemaining(json.usesRemaining);
        } else {
          setDiscountUsesRemaining(null);
        }
      } catch {
        if (!isCancelled) {
          setDiscountUsesRemaining(null);
        }
      }
    };

    resolveUsage();

    return () => {
      isCancelled = true;
    };
  }, [customerId, discountCode, precomputedDiscountUsesRemaining]);

  const isLoggedIn = Boolean(customerId);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {name, value} = e.target;
    if (name === 'title') {
      setTitle(value);
    } else {
      setReview(value.slice(0, REVIEW_CHAR_LIMIT));
    }
  };
  const [fileError, setFileError] = useState('');
  const [videoFileError, setVideoFileError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;

    setFileError('');
    if (file && file?.size / (1024 * 1024) > 20) {
      setFileError('Image exceeds 20 mb limit');
      return;
    }
    setSelectedImage(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const triggerFileSelect = () => fileInputRef.current?.click();
  const triggerVideoFileSelect = () => fileVideoInputRef.current?.click();

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const videoFile = e.target.files?.[0] ?? null;
    setVideoFileError('');
    if (videoFile && videoFile?.size / (1024 * 1024) > 40) {
      setFileError('Image exceeds 40 mb limit');
      return;
    }
    setSelectedVideo(videoFile);
    setVideoPreview(videoFile ? URL.createObjectURL(videoFile) : null);
  };

  const disableSubmitButton =
    !review || !stars || !title || userReviewExists || isBlocked;

  const handleSubmit = async () => {
    try {
      setPendingReviewSubmit(true);

      const form = new FormData();
      form.append('review', review);
      form.append('productId', productId);
      form.append('customerId', customerId || '');
      form.append('stars', String(stars));
      form.append('title', title || '');
      form.append('customerName', customerName || '');
      form.append('customerState', customerState || '');
      form.append('customerCountry', customerCountry || '');
      form.append('productName', productName);

      if (selectedImage) {
        form.append('image', selectedImage);
      }
      if (selectedVideo) {
        form.append('video', selectedVideo);
      }

      const response = await fetch('/api/add_review', {
        method: 'POST',
        body: form,
        headers: {Accept: 'application/json'},
      });

      if (!response.ok) {
        console.error('Failed to add review', await response.text());
        setPendingReviewSubmit(false);
        return;
      }

      const json = (await response.json()) as {
        reviews?: any[];
        discountCode?: string | null;
        reviewMediaDiscountReward?: ReviewMediaDiscountReward | null;
      };
      updateExistingReviews(json.reviews ?? []);

      const returnedReward = json.reviewMediaDiscountReward ?? null;
      setCustomerReviewMediaDiscountReward(returnedReward);
      onReviewMediaDiscountRewardChange?.(returnedReward);

      // Capture discount code if returned
      const returnedDiscountCode =
        returnedReward?.productId === productId
          ? returnedReward.discountCode
          : (json.discountCode ?? null);

      // Reset form fields
      setFileError('');
      setPendingReviewSubmit(false);
      setReview('');
      setStars(0);
      setTitle('');
      setSelectedImage(null);
      setImagePreview(null);
      setSelectedVideo(null);
      setVideoPreview(null);

      if (returnedDiscountCode) {
        setDiscountUsesRemaining(1); // Newly assigned code, never used
        setReviewSubmittedMessage('Review Submitted!');
        toast.success('Review posted! Your discount code has been revealed.');
      } else {
        setReviewSubmittedMessage(submittedMessage ?? 'Review Submitted!');
        const toastMessage = successToast?.message ?? 'Review Posted';
        if (successToast?.action) {
          toast.success(toastMessage, {action: successToast.action});
        } else {
          toast.success(toastMessage);
        }
      }
    } catch (err) {
      setPendingReviewSubmit(false);
      console.error(err);
    }
  };

  const renderDiscountPromoCard = (extraClassName = '') => (
    <div className={`review-discount-promo-card ${extraClassName}`.trim()}>
      <div className='flex justify-center'>

      <p className="text-md font-bold text-start mb-2">
        Claim a $15 discount!
      </p>
      </div>
      <div className='flex justify-center'>

      <p className="text-sm text-start text-muted-foreground mb-2">
        Leave a review with an image and/or video
      </p>
      </div>
      {discountRevealed ? (
        <div className="review-discount-revealed-row">
          <div className="invisible-ink-wrapper">
            <span
              className={`invisible-ink-text invisible-ink-text--large${
                discountRevealed ? ' invisible-ink-text--revealed' : ''
              }`}
            >
              {discountCode || 'REVIEW-XXXXXXXX'}
            </span>
            <div className="invisible-ink-overlay invisible-ink-overlay--revealed" />
          </div>
          <button
            type="button"
            onClick={() => {
              if (discountCode) {
                navigator.clipboard.writeText(discountCode);
                setCodeCopied(true);
                setCopySplashActive(false);
                if (copyLabelTimerRef.current) {
                  window.clearTimeout(copyLabelTimerRef.current);
                }
                if (copySplashStartTimerRef.current) {
                  window.clearTimeout(copySplashStartTimerRef.current);
                }
                if (copySplashStopTimerRef.current) {
                  window.clearTimeout(copySplashStopTimerRef.current);
                }
                copySplashStartTimerRef.current = window.setTimeout(
                  () => setCopySplashActive(true),
                  0,
                );
                copySplashStopTimerRef.current = window.setTimeout(
                  () => setCopySplashActive(false),
                  900,
                );
                copyLabelTimerRef.current = window.setTimeout(
                  () => setCodeCopied(false),
                  3000,
                );
                toast.success('Copied to Clipboard!', {
                  action: {
                    label: 'Browse Products',
                    onClick: () => navigate('/prints'),
                  },
                });
              }
            }}
            className={`review-discount-copy-btn${
              copySplashActive ? ' review-discount-copy-btn--splash' : ''
            }`}
            aria-label="Copy discount code"
          >
            <LuCopy className="review-discount-copy-icon" aria-hidden="true" />
            <span>{codeCopied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      ) : (
        <div className="invisible-ink-wrapper">
          <span
            className={`invisible-ink-text invisible-ink-text--large${
              discountRevealed ? ' invisible-ink-text--revealed' : ''
            }`}
          >
            {discountCode || 'REVIEW-XXXXXXXX'}
          </span>
          <div className="invisible-ink-overlay" />
        </div>
      )}
      {discountRevealed && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Uses remaining: {discountUsesRemaining === 0 ? 0 : 1}
        </p>
      )}
      <div className='flex justify-center'>

      <p className="text-xs text-start text-muted-foreground mt-2">
        {discountRevealed
          ? 'Apply code at checkout for $15 off'
          : 'One use per customer. Submit a review with media to unlock.'}
      </p>
      </div>
      {discountRevealed && showSignInToUseCode && signInUrl && (
        <div className="flex justify-center mt-1">
          <Link
            to={signInUrl}
            className="text-xs text-primary underline"
          >
            Sign in to use code
          </Link>
        </div>
      )}
    </div>
  );

  const renderSubmitButton = () => (
    <Button
      onClick={handleSubmit}
      disabled={!isLoggedIn || disableSubmitButton}
      className="cursor-pointer"
    >
      {pendingReviewSubmit ? (
        <ReloadIcon className="animate-spin" />
      ) : (
        'Submit'
      )}
    </Button>
  );

  return (
    <>
   <div className='my-2'>

      <Sectiontitle text="Leave Product Review"/>
   </div>
      

      {!reviewSubmittedMessage ? (
        <>
          <div className="leave-review-container w-full min-w-0 flex justify-center">
            <div className="leave-review w-full min-w-0">
              <div className="review-form-rating-title-row mb-2">
                <div className="review-form-stars-wrap">
                  <Rating value={stars} onValueChange={setStars}>
                    {Array.from({length: 5}).map((_, index) => (
                      <RatingButton key={index} className="stars" />
                    ))}
                  </Rating>
                </div>
                <div className="review-form-title-wrap">
                  <Input
                    name="title"
                    placeholder="title here"
                    onChange={handleChange}
                    disabled={!isLoggedIn}
                    value={title}
                  />
                </div>
              </div>

              {/* Review */}
              <Input
                name="review"
                placeholder="message"
                onChange={handleChange}
                disabled={!isLoggedIn}
                value={review}
                maxLength={REVIEW_CHAR_LIMIT}
              />

              <div className="flex items-center justify-between mt-1 text-sm">
                <span
                  className={
                    review.length >= REVIEW_CHAR_LIMIT
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }
                >
                  {review.length}/{REVIEW_CHAR_LIMIT}
                </span>
              </div>

              
              {fileError && <h2>{fileError}</h2>}
              <div
                className={`review-form-upload-zone mt-2 ${
                  showPromoBesideUploads
                    ? 'review-form-upload-zone--with-promo'
                    : ''
                }`}
              >
                <div
                  className={
                    showPromoBesideUploads
                      ? 'review-form-upload-controls'
                      : 'min-w-0'
                  }
                >
                  {/* Upload */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={!isLoggedIn}
                  />

                  <div className="flex items-center gap-3 mb-5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={triggerFileSelect}
                      disabled={!isLoggedIn}
                      className="cursor-pointer"
                    >
                      Upload image
                    </Button>

                    {imagePreview && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <img
                          src={imagePreview}
                          alt="Selected"
                          className="h-12 w-12 object-cover rounded"
                        />
                        <span className="truncate max-w-[160px]">
                          {selectedImage?.name}
                        </span>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileVideoInputRef}
                    type="file"
                    accept="video/mp4,.mov"
                    className="hidden"
                    onChange={handleVideoFileChange}
                    disabled={!isLoggedIn}
                  />

                  <div className="flex items-center gap-3 mb-5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={triggerVideoFileSelect}
                      disabled={!isLoggedIn}
                      className="cursor-pointer"
                    >
                      Upload Video
                    </Button>
                    {videoPreview && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <video
                          className="home-video__player"
                          controls
                          playsInline
                          preload="metadata"
                        >
                          <source src={`${videoPreview}#t=0.001`} />
                          <track
                            kind="captions"
                            srcLang="en"
                            label="English captions"
                            src="data:text/vtt,WEBVTT"
                          />
                        </video>
                        <span className="truncate max-w-[160px]">
                          {selectedVideo?.name}
                        </span>
                      </div>
                    )}
                  </div>
                  {showPromoBesideUploads && renderSubmitButton()}
                </div>
                {showPromoBesideUploads && (
                  <div className="review-form-upload-inline-promo">
                    {renderDiscountPromoCard('review-discount-promo-card--inline')}
                  </div>
                )}
              </div>
              {!showPromoBesideUploads && renderSubmitButton()}
              {showPromoBelowSubmit && (
                <div className="mt-5">{renderDiscountPromoCard()}</div>
              )}
              {!isLoggedIn && (
                <>
                  <div className="pt-2 sign-in-link">
                    <p className="text-sm text-muted-foreground mt-2">
                      Please{' '}
                      <Link
                        to="/account/login"
                        className="text-primary underline"
                      >
                        sign in
                      </Link>{' '}
                      to leave a review.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">{reviewSubmittedMessage}</p>
        </div>
      )}

      {/* Discount promo card - after submission state */}
      {showPromoAfterSubmission && (
        <div className="flex justify-end mt-5">
          {renderDiscountPromoCard()}
        </div>
      )}
    </>
  );
}

export default ReviewForm;
