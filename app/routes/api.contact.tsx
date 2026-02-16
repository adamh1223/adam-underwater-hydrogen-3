import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';
import {isbot} from 'isbot';
import {validateContactSubmission} from '~/lib/contactAntiSpam';
import {uploadImage} from '~/lib/supabase.server';
import {
  ADMIN_NOTIFICATION_EMAIL,
  sendDirectEmail,
} from '~/lib/email-provider.server';

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

  try {
    const imagesHtml = uploadedImages.length
      ? `<p><strong>Images:</strong></p><ul>${uploadedImages
          .map((url) => `<li><a href="${url}">${url}</a></li>`)
          .join('')}</ul>`
      : '<p><strong>Images:</strong> none</p>';

    await sendDirectEmail({
      env: context.env,
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: `New contact form message from ${safeName}`,
      replyTo: safeEmail,
      text: [
        `Name: ${safeName}`,
        `Email: ${safeEmail}`,
        `Message: ${safeMessage}`,
        `Images: ${uploadedImages.join(', ') || 'none'}`,
      ].join('\n'),
      html: `
        <h2>New contact form message</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage.replace(/\n/g, '<br />')}</p>
        ${imagesHtml}
      `,
    });
    return json({success: true});
  } catch (error) {
    console.error(error);
    return json({error: 'request failed'}, {status: 500});
  }
}

export async function loader() {
  return new Response(null, {status: 405});
}
