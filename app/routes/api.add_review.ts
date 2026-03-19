import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';
import {ADMIN_METAFIELD_SET} from '~/lib/homeQueries';
import {
  ADMIN_NOTIFICATION_EMAIL,
  sendDirectEmail,
} from '~/lib/email-provider.server';
import {formatReviewLocation} from '~/lib/reviews';
import {uploadReviewMedia} from '~/lib/review-media.server';
import {
  parseReviewMediaDiscountReward,
  REVIEW_MEDIA_DISCOUNT_CODE,
  REVIEW_MEDIA_DISCOUNT_KEY,
  REVIEW_MEDIA_DISCOUNT_NAMESPACE,
  serializeReviewMediaDiscountReward,
  type ReviewMediaDiscountReward,
} from '~/lib/reviewMediaDiscountReward';

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
    const customerState = form.get('customerState') as string;
    const customerCountry = form.get('customerCountry') as string;
    const imageFile = form.get('image') as File | null;
    const videoFile = form.get('video') as File | null;

    if (!productId) {
      return json({error: 'Missing productId'}, {status: 400});
    }
    if (!reviewText) {
      return json({error: 'Missing review text'}, {status: 400});
    }

    const adminToken = context.env.SHOPIFY_ADMIN_TOKEN;
    const shop = 'fuyqg4-fh.myshopify.com';

    if (!adminToken) {
      return json({error: 'SHOPIFY_ADMIN_TOKEN not found'}, {status: 500});
    }

    let customerReviewMediaDiscountReward: ReviewMediaDiscountReward | null =
      null;
    if (customerId) {
      const rewardResponse = await fetch(
        `https://${shop}/admin/api/2024-10/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': adminToken,
          },
          body: JSON.stringify({
            query: `
              query GetCustomerReviewMediaDiscountReward($id: ID!) {
                customer(id: $id) {
                  metafield(
                    namespace: "${REVIEW_MEDIA_DISCOUNT_NAMESPACE}"
                    key: "${REVIEW_MEDIA_DISCOUNT_KEY}"
                  ) {
                    value
                  }
                }
              }
            `,
            variables: {id: customerId},
          }),
        },
      );
      if (!rewardResponse.ok) {
        const rewardResponseText = await rewardResponse.text();
        console.error(
          'Failed to read customer review media discount reward metafield:',
          rewardResponse.status,
          rewardResponseText,
        );
      } else {
        const rewardResponseText = await rewardResponse.text();
        try {
          const rewardJson = JSON.parse(rewardResponseText) as {
            data?: {customer?: {metafield?: {value?: string | null} | null} | null};
          };
          customerReviewMediaDiscountReward = parseReviewMediaDiscountReward(
            rewardJson?.data?.customer?.metafield?.value,
          );
        } catch (error) {
          console.error(
            'Failed to parse customer review media discount reward JSON:',
            error,
            rewardResponseText,
          );
        }
      }
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
        const parsedReviews = JSON.parse(mf.value);
        existingReviews = Array.isArray(parsedReviews) ? parsedReviews : [];
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
      customerImage = await uploadReviewMedia(context.env, imageFile);
    }
    let customerVideo;
    if (videoFile) {
      customerVideo = await uploadReviewMedia(context.env, videoFile);
    }

    const createdAt = new Date().toISOString();

    // Append new review
    const updatedReviews = [
      ...existingReviews,
      {
        text: reviewText,
        createdAt,
        customerId,
        stars,
        productId,
        productName,
        title,
        customerName,
        customerState: customerState || undefined,
        customerCountry: customerCountry || undefined,
        customerImage,
        customerVideo,
        isFeatured: false,
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

    // 3️⃣ Assign REVIEW15 reward if review includes image or video
    let discountCode: string | null = null;
    const hasMedia = Boolean(customerImage || customerVideo);
    const hasEligibleCustomer = Boolean(customerId);

    if (hasMedia && hasEligibleCustomer && !customerReviewMediaDiscountReward) {
      discountCode = REVIEW_MEDIA_DISCOUNT_CODE;
    }

    if (
      hasMedia &&
      hasEligibleCustomer &&
      !customerReviewMediaDiscountReward &&
      discountCode &&
      customerId
    ) {
      const rewardToPersist: ReviewMediaDiscountReward = {
        productId,
        discountCode,
        reviewCreatedAt: createdAt,
        awardedAt: createdAt,
      };
      customerReviewMediaDiscountReward = rewardToPersist;

      try {
        const rewardMutationResponse = await fetch(
          `https://${shop}/admin/api/2024-10/graphql.json`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': adminToken,
            },
            body: JSON.stringify({
              query: ADMIN_METAFIELD_SET,
              variables: {
                metafields: [
                  {
                    ownerId: customerId,
                    namespace: REVIEW_MEDIA_DISCOUNT_NAMESPACE,
                    key: REVIEW_MEDIA_DISCOUNT_KEY,
                    type: 'json',
                    value: serializeReviewMediaDiscountReward(rewardToPersist),
                  },
                ],
              },
            }),
          },
        );

        const rewardMutationText = await rewardMutationResponse.text();
        let rewardMutationJson: any = {};
        try {
          rewardMutationJson = JSON.parse(rewardMutationText);
        } catch (error) {
          console.error(
            'Failed to parse customer review media discount reward mutation response:',
            error,
            rewardMutationText,
          );
          rewardMutationJson = {};
        }

        const rewardErrors =
          rewardMutationJson?.data?.metafieldsSet?.userErrors ??
          rewardMutationJson?.errors ??
          null;
        if (rewardErrors && rewardErrors.length > 0) {
          console.error(
            'Customer review media discount reward mutation errors:',
            rewardErrors,
          );
        }
      } catch (rewardMutationError) {
        console.error(
          'Failed to persist customer review media discount reward:',
          rewardMutationError,
        );
      }
    }

    const responseDiscountCode =
      customerReviewMediaDiscountReward?.productId === productId
        ? customerReviewMediaDiscountReward.discountCode
        : null;

    try {
      await sendDirectEmail({
        env: context.env,
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: `New review submitted: ${productName}`,
        text: [
          `Customer: ${customerName}`,
          `Location: ${
            formatReviewLocation({
              customerState,
              customerCountry,
            }) ?? 'none'
          }`,
          `Product: ${productName}`,
          `Title: ${title}`,
          `Stars: ${stars}`,
          `Review: ${reviewText}`,
          `Image: ${customerImage ?? 'none'}`,
          `Video: ${customerVideo ?? 'none'}`,
          `Discount Code: ${responseDiscountCode ?? 'none (no media)'}`,
        ].join('\n'),
        html: `
          <h2>New review submitted</h2>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p><strong>Location:</strong> ${
            formatReviewLocation({
              customerState,
              customerCountry,
            }) ?? 'none'
          }</p>
          <p><strong>Product:</strong> ${productName}</p>
          <p><strong>Title:</strong> ${title}</p>
          <p><strong>Stars:</strong> ${stars}</p>
          <p><strong>Review:</strong><br />${reviewText}</p>
          <p><strong>Image:</strong> ${customerImage ? `<a href="${customerImage}">${customerImage}</a>` : 'none'}</p>
          <p><strong>Video:</strong> ${customerVideo ? `<a href="${customerVideo}">${customerVideo}</a>` : 'none'}</p>
          <p><strong>Discount Code:</strong> ${responseDiscountCode ?? 'none (no media)'}</p>
        `,
      });
    } catch (error) {
      console.error(error);
    }
    return json({
      success: true,
      reviews: updatedReviews,
      discountCode: responseDiscountCode,
      reviewMediaDiscountReward: customerReviewMediaDiscountReward,
    });
  } catch (error) {
    console.error(error, '111111');
    return json({error: 'Request failed'}, {status: 500});
  }
}

export async function loader() {
  return new Response(null, {status: 405});
}
