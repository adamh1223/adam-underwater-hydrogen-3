import React, {useState} from 'react';
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
  const isLoggedIn = Boolean(customerId);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {name, value} = e.target;
    if (name === 'title') {
      setTitle(value);
    } else setReview(value);
  };
  console.log(review, 'review2');
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
        name="Review Title"
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
