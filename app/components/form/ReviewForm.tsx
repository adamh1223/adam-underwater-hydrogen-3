import React, {useEffect, useRef, useState} from 'react';
import {Input} from '../ui/input';
import {Button} from '../ui/button';
import {Label} from '../ui/label';
import {Rating, RatingButton} from 'components/ui/shadcn-io/rating';
import Sectiontitle from '../global/Sectiontitle';
import {ReloadIcon} from '@radix-ui/react-icons';
import {toast, Toaster} from 'sonner';

function ReviewForm({
  productId,
  customerId,
  customerName,
  updateExistingReviews,
}: {
  productId: string;
  customerId: string | undefined;
  customerName: string | undefined;
  updateExistingReviews: (reviews: any[]) => void;
}) {
  const [pendingReviewSubmit, setPendingReviewSubmit] = useState(false);
  const [review, setReview] = useState<string | undefined>();
  const [stars, setStars] = useState<number>(0);
  const [title, setTitle] = useState<string | undefined>();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [reviewSubmittedMessage, setReviewSubmittedMessage] = useState<
    string | undefined
  >();
  useEffect(() => {
    if (reviewSubmittedMessage) {
      const timer = setTimeout(() => {
        setReviewSubmittedMessage(undefined);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [reviewSubmittedMessage]);
  const isLoggedIn = Boolean(customerId);
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const {name, value} = e.target;
    if (name === 'title') {
      setTitle(value);
    } else setReview(value);
  };
  console.log(review, 'review2');
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    } else {
      setSelectedImage(null);
      setImagePreview(null);
    }
  };
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };
  const handleSubmit = async () => {
    try {
      setPendingReviewSubmit(true);
      const form = new FormData();
      //   form.append('productId', product.id);
      form.append('review', review as string);
      form.append('productId', productId);
      form.append('customerId', customerId as string);
      form.append('stars', stars?.toString() as string);
      form.append('title', title as string);
      form.append('customerName', customerName as string);
      if (selectedImage) {
        form.append('image', selectedImage);
      }
      console.log(form, 'form');

      const response = await fetch('/api/add_review', {
        method: 'POST',
        body: form,
        headers: {Accept: 'application/json'},
      });
      const json = await response.json();
      updateExistingReviews(json.reviews);
      setPendingReviewSubmit(false);
      setReview('');
      setStars(0);
      setTitle('');
      setSelectedImage(null);
      setImagePreview(null);
      setReviewSubmittedMessage('Review Submitted!');
    } catch (error) {}
    setPendingReviewSubmit(false);
  };

  console.log(review, '444review');
  console.log(title, '444title');

  return (
    <>
      <Sectiontitle text="Leave Product Review" />
      <br />
      {!reviewSubmittedMessage ? (
        <>
          <div className="leave-review-container flex justify-center">
            <div className="leave-review">
              <div className="flex items-center mb-5">
                <Rating value={stars} onValueChange={setStars}>
                  {Array.from({length: 5}).map((_, index) => (
                    <RatingButton key={index} className="stars" />
                  ))}
                </Rating>
              </div>
              <Input
                name="title"
                placeholder="title here"
                onChange={handleChange}
                disabled={!isLoggedIn}
              ></Input>
              <br />
              <div className="space-y-2">
                <Label className="required" htmlFor="message">
                  Message
                </Label>
                <textarea
                  id="message"
                  name="review"
                  value={review ?? ''}
                  onChange={handleChange}
                  placeholder="message"
                  rows={4}
                  className="w-full message bg-background border border-input border-gray-300 dark:border-gray-700 rounded-sm p-2"
                  disabled={!isLoggedIn}
                />
              </div>
              <br />
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
                      alt="Selected review attachment"
                      className="h-12 w-12 object-cover rounded"
                    />
                    <span className="truncate max-w-[160px]">
                      {selectedImage?.name}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <Button
                  onClick={handleSubmit}
                  disabled={!isLoggedIn}
                  className="cursor-pointer"
                >
                  {pendingReviewSubmit ? (
                    <ReloadIcon className="animate-spin" />
                  ) : (
                    'Submit'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div>{reviewSubmittedMessage}</div>
      )}
      {!isLoggedIn && (
        <p className="text-sm text-muted-foreground mt-2">
          Please sign in to leave a review.
        </p>
      )}
    </>
  );
}

export default ReviewForm;
