import React, {useRef, useState} from 'react';
import {Input} from '../ui/input';
import {Button} from '../ui/button';
import {Rating, RatingButton} from 'components/ui/shadcn-io/rating';
import Sectiontitle from '../global/Sectiontitle';

function ReviewForm({
  productId,
  customerId,
  customerName,
}: {
  productId: string;
  customerId: string | undefined;
  customerName: string | undefined;
}) {
  const [review, setReview] = useState<string | undefined>();
  const [stars, setStars] = useState<number>(0);
  const [title, setTitle] = useState<string | undefined>();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isLoggedIn = Boolean(customerId);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    } catch (error) {}
  };

  console.log(review, '444review');
  console.log(title, '444title');

  return (
    <>
      <Sectiontitle text="Leave Product Review" />
      <br />
      <Input
        name="title"
        placeholder="title here"
        onChange={handleChange}
        disabled={!isLoggedIn}
      ></Input>
      <br />
      <Input
        name="review"
        placeholder="message"
        onChange={handleChange}
        disabled={!isLoggedIn}
      ></Input>
      <br />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={!isLoggedIn}
      />
      <div className="flex items-center gap-3 mb-3">
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
      <div className="flex items-center">
        <Rating value={stars} onValueChange={setStars}>
          {Array.from({length: 5}).map((_, index) => (
            <RatingButton key={index} className="stars" />
          ))}
        </Rating>
      </div>
      <div className="mt-3">
        <Button
          onClick={handleSubmit}
          disabled={!isLoggedIn}
          className="cursor-pointer"
        >
          Submit
        </Button>
      </div>
      {!isLoggedIn && (
        <p className="text-sm text-muted-foreground mt-2">
          Please sign in to leave a review.
        </p>
      )}
    </>
  );
}

export default ReviewForm;
