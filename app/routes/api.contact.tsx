import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';
import {isbot} from 'isbot';
import {validateContactSubmission} from '~/lib/contactAntiSpam';
import {uploadImage} from '~/lib/supabase.server';

export async function action({request, context}: ActionFunctionArgs) {
  const formData = await request.formData();
  const getTextField = (key: string) => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };

  const name = getTextField('name');
  const email = getTextField('email');
  const message = getTextField('message');
  const website = getTextField('website');
  const formStartMs = getTextField('formStartMs');
  const userAgentIsBot = isbot(request.headers.get('user-agent'));

  const validation = validateContactSubmission({
    name,
    email,
    message,
    website,
    formStartMs,
    userAgentIsBot,
  });

  if (!validation.ok) {
    if (validation.code === 'SPAM_DETECTED') {
      console.warn('Blocked contact spam submission', {
        spamScore: validation.spamScore,
        spamFlags: validation.spamFlags,
      });
    }

    return json({error: validation.error}, {status: 400});
  }

  const {name: safeName, email: safeEmail, message: safeMessage} =
    validation.value;
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
            name: safeName,
            email: safeEmail,
            message: safeMessage,
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
    return json({error: 'request failed'}, {status: 500});
  }
}

export async function loader() {
  return new Response(null, {status: 405});
}
