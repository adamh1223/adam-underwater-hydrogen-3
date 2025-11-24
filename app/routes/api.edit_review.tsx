import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';
import {ADMIN_METAFIELD_SET} from '~/lib/homeQueries';

export async function action({request, context}: ActionFunctionArgs) {
  try {
    const form = await request.formData();
    const productId = form.get('productId') as string;
    const reviewText = (form.get('review') as string) ?? '';
    const customerId = (form.get('customerId') as string) ?? '';
    const stars = (form.get('stars') as string) ?? '';
    const title = (form.get('title') as string) ?? '';
    const customerName = (form.get('customerName') as string) ?? '';
    const createdAt = form.get('createdAt') as string;

    if (!productId) {
      return json({error: 'Missing productId'}, {status: 400});
    }

    if (!createdAt) {
      return json({error: 'Missing createdAt'}, {status: 400});
    }

    const adminToken = context.env.SHOPIFY_ADMIN_TOKEN;
    const shop = 'fuyqg4-fh.myshopify.com';

    if (!adminToken) {
      return json({error: 'SHOPIFY_ADMIN_TOKEN not found'}, {status: 500});
    }

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
    const mf = existingJson?.data?.product?.metafield;

    let existingReviews: any[] = [];
    if (mf?.value) {
      try {
        existingReviews = JSON.parse(mf.value);
      } catch {
        existingReviews = [];
      }
    }

    const targetIndex = existingReviews.findIndex(
      (review) => review?.createdAt === createdAt,
    );

    if (targetIndex === -1) {
      return json({error: 'Review not found'}, {status: 404});
    }

    const targetReview = existingReviews[targetIndex] ?? {};

    if (
      customerId &&
      targetReview?.customerId &&
      targetReview.customerId !== customerId
    ) {
      return json({error: 'Not authorized to edit this review'}, {status: 403});
    }

    const updatedReview = {
      ...targetReview,
      text: reviewText || targetReview?.text || '',
      stars: stars || targetReview?.stars || 0,
      title: title || targetReview?.title || '',
      customerName: customerName || targetReview?.customerName || '',
      updatedAt: new Date().toISOString(),
    };

    const updatedReviews = [...existingReviews];
    updatedReviews[targetIndex] = updatedReview;

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

    return json({success: true, reviews: updatedReviews});
  } catch (error) {
    console.error(error, 'edit-review-error');
    return json({error: 'Request failed'}, {status: 500});
  }
}

export async function loader() {
  return new Response(null, {status: 405});
}
