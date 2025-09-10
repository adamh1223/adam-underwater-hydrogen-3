import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';

export async function action({request}: ActionFunctionArgs) {
  const body = await request.json();
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
            //@ts-expect-error body is an object
            ...body,
          },
          routing: {
            method: 'single',
            channels: ['email'],
          },
        },
      }),
    });
    const JSONResponse = await response.json();
    console.log(JSONResponse, '0987');
    return json({success: true, result: JSONResponse});
  } catch (error) {
    console.error(error);
    return json({error: 'request failed', status: 500});
  }
}

export async function loader() {
  return new Response(null, {status: 405});
}
