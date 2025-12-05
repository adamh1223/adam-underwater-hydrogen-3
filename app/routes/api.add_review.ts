import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';
// import {createClient} from '@supabase/supabase-js';
import {ADMIN_METAFIELD_SET} from '~/lib/homeQueries';
import {uploadImage} from '~/lib/supabase.server';
// const BUCKET = 'main-bucket';
// function getSupabase(env: Env) {
//   const url = env.SUPABASE_URL;
//   const key = env.SUPABASE_KEY;

//   if (!url || !key) {
//     throw new Error('Supabase credentials are not configured');
//   }

//   return createClient(url, key, {
//     // Auth is not needed for simple storage uploads in this flow.
//     auth: {
//       autoRefreshToken: false,
//       persistSession: false,
//     },
//   });
// }

// export const uploadImage = async (env: Env, image: File) => {
//   const supabase = getSupabase(env);
//   const objectName = `${Date.now()}-${image.name}`;

//   const {data, error} = await supabase.storage
//     .from(BUCKET)
//     .upload(objectName, image, {
//       cacheControl: '3600',
//     });

//   if (error || !data) {
//     throw new Error(
//       `Image upload failed: ${error?.message ?? 'unknown error'}`,
//     );
//   }

//   return supabase.storage.from(BUCKET).getPublicUrl(objectName).data.publicUrl;
// };
function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;

  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

export async function action({request, context}: ActionFunctionArgs) {
  try {
    const form = await request.formData();
    const productId = form.get('productId') as string;
    const productName = form.get('productName') as string;
    const reviewText = form.get('review') as string;
    const customerId = form.get('customerId') as string;
    const stars = form.get('stars') as string;
    const title = form.get('title') as string;
    const customerName = form.get('customerName') as string;
    const imageFile = form.get('image') as File | null;

    console.log(productId, 'prodid');

    if (!productId) {
      return json({error: 'Missing productId'}, {status: 400});
    }
    if (!reviewText) {
      return json({error: 'Missing review text'}, {status: 400});
    }

    const adminToken = context.env.SHOPIFY_ADMIN_TOKEN;
    const shop = 'fuyqg4-fh.myshopify.com';
    console.log(adminToken, '555admintoken');
    console.log(shop, '555shop');

    if (!adminToken) {
      return json({error: 'SHOPIFY_ADMIN_TOKEN not found'}, {status: 500});
    }

    // 1️⃣ Fetch existing reviews metafield
    const existingResponse = await fetch(
      `https://${shop}/admin/api/2024-10/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': adminToken,
        },
        body: JSON.stringify({
          query: `
            query GetProductReviews($id: ID!) {
              product(id: $id) {
                metafield(namespace: "custom", key: "reviews") {
                  id
                  value
                }
              }
            }
          `,
          variables: {id: productId},
        }),
      },
    );

    const existingText = await existingResponse.text();

    if (!existingResponse.ok) {
      console.error(
        'Admin API fetch failed:',
        existingResponse.status,
        existingText,
      );
      return json(
        {
          error: 'Failed to read existing reviews',
          status: existingResponse.status,
        },
        {status: 500},
      );
    }

    let existingJson: any = {};
    try {
      existingJson = JSON.parse(existingText);
    } catch (error) {
      console.error(
        'Failed to parse existing reviews JSON:',
        error,
        existingText,
      );
      return json(
        {error: 'Invalid reviews data returned by Admin API'},
        {status: 500},
      );
    }

    let existingReviews: any[] = [];

    const mf = existingJson?.data?.product?.metafield;
    if (mf?.value) {
      try {
        existingReviews = JSON.parse(mf.value);
      } catch {
        existingReviews = [];
      }
    }

    // let imageDataUrl: string | undefined;
    // if (imageFile && typeof imageFile === 'object') {
    //   const arrayBuffer = await imageFile.arrayBuffer();
    //   const base64 = Buffer.from(arrayBuffer).toString('base64');
    //   const mimeType = imageFile.type || 'application/octet-stream';
    //   imageDataUrl = `data:${mimeType};base64,${base64}`;
    // }
    let customerImage;
    if (imageFile) {
      customerImage = await uploadImage(context.env, imageFile);
    }

    if (imageFile) {
      // const promisedImages = imageFiles?.map((file: File) =>
      //   uploadImage(context.env, file),
      // );
      // customerImages = await Promise.all(promisedImages);
    }
    console.log(customerImage, 'customerimages');

    // Append new review
    const updatedReviews = [
      ...existingReviews,
      {
        text: reviewText,
        createdAt: new Date().toISOString(),
        customerId,
        stars,
        title,
        customerName,
        customerImage,
      },
    ];

    // 2️⃣ Submit updated metafield to Admin API
    const mutationResponse = await fetch(
      `https://${shop}/admin/api/2024-10/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': adminToken,
          'User-Agent': 'Hydrogen-Review-App',
        },
        body: JSON.stringify({
          query: ADMIN_METAFIELD_SET,
          variables: {
            metafields: [
              {
                ownerId: productId,
                namespace: 'custom',
                key: 'reviews',
                type: 'json',
                value: JSON.stringify(updatedReviews),
              },
            ],
          },
        }),
      },
    );
    let mutationJSON = {} as any;
    try {
      const responseText = await mutationResponse.text();
      try {
        mutationJSON = JSON.parse(responseText);
      } catch (error) {
        console.error(error);
        mutationJSON = {};
      }
    } catch (error) {
      console.error(error);
      mutationJSON = {};
    }

    const errors =
      mutationJSON?.data?.metafieldsSet?.userErrors ??
      mutationJSON?.errors ??
      null;

    if (errors && errors.length > 0) {
      console.error('Admin API errors:', errors);
      return json({error: errors}, {status: 500});
    }
    const courierToken = 'dk_prod_YD7MPFEFARMTTYM3ASDX55T6ZD08';
    try {
      await fetch('https://api.courier.com/send', {
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
            template: 'Q8S41DS49B4J9KPBJCBQEDEBSBH8',
            data: {
              customerName,
              productName,
              reviewTitle: title,
              stars,
              reviewText,
              reviewImage: customerImage,
            },
            routing: {
              method: 'single',
              channels: ['email'],
            },
          },
        }),
      });
    } catch (error) {
      console.log(error, 'errorlog');
    }
    return json({success: true, reviews: updatedReviews});
  } catch (error) {
    console.error(error, '111111');
    return json({error: 'Request failed'}, {status: 500});
  }
}

export async function loader() {
  return new Response(null, {status: 405});
}
