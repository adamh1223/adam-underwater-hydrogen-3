import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';
import {ADMIN_METAFIELD_SET} from '~/lib/homeQueries';

export async function action({request, context}: ActionFunctionArgs) {
  try {
    const form = await request.formData();
    const productId = form.get('productId') as string;
    const reviewText = form.get('review') as string;

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

    const existingJson = await existingResponse.json();

    let existingReviews: any[] = [];

    const mf = existingJson?.data?.product?.metafield;
    if (mf?.value) {
      try {
        existingReviews = JSON.parse(mf.value);
      } catch {
        existingReviews = [];
      }
    }

    // Append new review
    const updatedReviews = [
      ...existingReviews,
      {
        text: reviewText,
        createdAt: new Date().toISOString(),
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

    const responseText = await mutationResponse.text();
    console.log('ADMIN RAW RESPONSE:', responseText);

    const mutationJson = await mutationResponse.json();

    const errors =
      mutationJson?.data?.metafieldsSet?.userErrors ??
      mutationJson?.errors ??
      null;

    if (errors && errors.length > 0) {
      console.error('Admin API errors:', errors);
      return json({error: errors}, {status: 500});
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
