import React, {useEffect, useRef, useState} from 'react';
import {Input} from '../ui/input';
import {Button} from '../ui/button';
import {Rating, RatingButton} from 'components/ui/shadcn-io/rating';
import Sectiontitle from '../global/Sectiontitle';
import {ReloadIcon} from '@radix-ui/react-icons';
import {Link} from '@remix-run/react';
import {toast} from 'sonner';

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
  updateExistingReviews,
  userReviewExists,
  isBlocked,
  successToast,
  submittedMessage,
}: {
  productId: string;
  productName: string;
  customerId: string | undefined;
  customerName: string | undefined;
  userReviewExists: Boolean;
  isBlocked: Boolean;
  updateExistingReviews: (reviews: any[]) => void;
  successToast?: ReviewFormSuccessToast;
  submittedMessage?: string;
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

  const [reviewSubmittedMessage, setReviewSubmittedMessage] =
    useState<string>();

  useEffect(() => {
    if (reviewSubmittedMessage) {
      const timer = setTimeout(
        () => setReviewSubmittedMessage(undefined),
        2500,
      );
      return () => clearTimeout(timer);
    }
  }, [reviewSubmittedMessage]);

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

      const json = await response.json();
      updateExistingReviews(json.reviews);

      // Reset
      setFileError('');
      setPendingReviewSubmit(false);
      setReview('');
      setStars(0);
      setTitle('');
      setSelectedImage(null);
      setImagePreview(null);
      setReviewSubmittedMessage(submittedMessage ?? 'Review Submitted!');

      const toastMessage = successToast?.message ?? 'Review Posted';
      if (successToast?.action) {
        toast.success(toastMessage, {action: successToast.action});
      } else {
        toast.success(toastMessage);
      }
    } catch (err) {
      setPendingReviewSubmit(false);
      console.error(err);
    }
  };

  return (
    <>
    <br/>
      <Sectiontitle text="Leave Product Review"/>
      <br />

      {!reviewSubmittedMessage ? (
        <>
          <div className="leave-review-container flex justify-center">
            <div className="leave-review">
              {/* Stars */}
              <div className="flex items-center mb-5">
                <Rating value={stars} onValueChange={setStars}>
                  {Array.from({length: 5}).map((_, index) => (
                    <RatingButton key={index} className="stars" />
                  ))}
                </Rating>
              </div>

              {/* Title */}
              <Input
                name="title"
                placeholder="title here"
                onChange={handleChange}
                disabled={!isLoggedIn}
                value={title}
              />

              <br />

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

              <br />
              {fileError && <h2>{fileError}</h2>}
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
              {/* Submit */}
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
        <div>{reviewSubmittedMessage}</div>
      )}
    </>
  );
}

export default ReviewForm;
