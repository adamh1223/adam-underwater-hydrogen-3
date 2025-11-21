import React, {useState} from 'react';
import {Input} from '../ui/input';
import {Button} from '../ui/button';
import {Rating, RatingButton} from 'components/ui/shadcn-io/rating';

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
  const [stars, setStars] = useState<number | undefined>();
  const [title, setTitle] = useState<string | undefined>();
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
  if (!customerId) {
    return null;
  }
  console.log(review, '444review');
  console.log(title, '444title');

  return (
    <>
      <Input name="review" placeholder="hi" onChange={handleChange}></Input>
      <Input
        name="title"
        placeholder="title here"
        onChange={handleChange}
      ></Input>
      <Rating value={stars} onValueChange={setStars}>
        {Array.from({length: 5}).map((_, index) => (
          <RatingButton key={index} />
        ))}
      </Rating>

      <Button onClick={handleSubmit}>Submit</Button>
    </>
  );
}

export default ReviewForm;
