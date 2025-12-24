import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';
import {uploadImage} from '~/lib/supabase.server';

export async function action({request, context}: ActionFunctionArgs) {
  const formData = await request.formData();
  const name = (formData.get('name') as string) ?? '';
  const email = (formData.get('email') as string) ?? '';
  const message = (formData.get('message') as string) ?? '';
  const contactImages = formData.getAll('contactImages');
  const imageFiles = contactImages.filter(
    (file): file is File => file instanceof File && file.size > 0,
  );

  if (imageFiles.length > 3) {
    return json({error: 'You can upload up to 3 images.'}, {status: 400});
  }

  const uploadedImages: string[] = [];

  try {
    for (const image of imageFiles) {
      const url = await uploadImage(context.env, image);
      uploadedImages.push(url);
    }
  } catch (error) {
    console.error('Image upload failed:', error);
    return json(
      {error: 'Failed to upload images. Please try again.'},
      {status: 500},
    );
  }

  const courierToken = 'dk_prod_YD7MPFEFARMTTYM3ASDX55T6ZD08';
  try {
    const response = await fetch('https://api.courier.com/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${courierToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          to: {
            email: 'adam@hussmedia.io',
          },
          template: 'Q6HCEKAAFXM5CFH41HR0RSHRWH6R',
          data: {
            name,
            email,
            message,
            contactImages: uploadedImages,
          },
          routing: {
            method: 'single',
            channels: ['email'],
          },
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Courier request failed:', response.status, text);
      return json(
        {error: 'Failed to send message notification.'},
        {status: 500},
      );
    }

    const JSONResponse = await response.json();
    
    return json({success: true, result: JSONResponse});
  } catch (error) {
    console.error(error);
    return json({error: 'request failed', status: 500});
  }
}

export async function loader() {
  return new Response(null, {status: 405});
}
