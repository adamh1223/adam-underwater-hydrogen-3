import React, {useState} from 'react';
import {Input} from '../ui/input';
import {Button} from '../ui/button';

function ReviewForm({productId}: {productId: string}) {
  const [review, setReview] = useState<string | undefined>();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {value} = e.target;
    setReview(value);
  };
  console.log(review, 'review2');
  const handleSubmit = async () => {
    try {
      const form = new FormData();
      //   form.append('productId', product.id);
      form.append('review', review as string);
      form.append('productId', productId);
      console.log(form, 'form');

      const response = await fetch('/api/add_review', {
        method: 'POST',
        body: form,
        headers: {Accept: 'application/json'},
      });
      const json = await response.json();
    } catch (error) {}
  };

  return (
    <>
      <Input placeholder="hi" onChange={handleChange}></Input>
      <Button onClick={handleSubmit}>Submit</Button>
    </>
  );
}

export default ReviewForm;
