import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';
import {ADMIN_METAFIELD_SET} from '~/lib/homeQueries';
import {deleteReviewMedia, uploadReviewMedia} from '~/lib/review-media.server';
import {createNotificationId} from '~/lib/notifications';
import {
  ADMIN_NOTIFICATION_EMAIL,
  sendDirectEmail,
} from '~/lib/email-provider.server';

export async function action({request, context}: ActionFunctionArgs) {
  try {
    const form = await request.formData();
    const productId = form.get('productId') as string;
    const productName = form.get('productName') as string;
    const reviewText = (form.get('review') as string) ?? '';
    const customerId = (form.get('customerId') as string) ?? '';
    const stars = (form.get('stars') as string) ?? '';
    const title = (form.get('title') as string) ?? '';
    let customerName = (form.get('customerName') as string) ?? '';
    const createdAt = form.get('createdAt') as string;
    const imageFile = form.get('image') as File | null;
    const videoFile = form.get('video') as File | null;
    const isFeaturedValue = form.get('isFeatured') as string | null;

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

    const isAdminCustomer =
      customerId === 'gid://shopify/Customer/7968375079049';
    const isFeatured =
      isFeaturedValue === null
        ? undefined
        : isFeaturedValue.toLowerCase() === 'yes';

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

    const existingJson: any = await existingResponse.json();
    const mf = existingJson?.data?.product?.metafield;

    let existingReviews: any[] = [];
    if (mf?.value) {
      try {
        const parsedReviews = JSON.parse(mf.value);
        existingReviews = Array.isArray(parsedReviews) ? parsedReviews : [];
      } catch {
        existingReviews = [];
      }
    }
    console.warn(existingReviews, '000existing');

    const targetIndex = existingReviews.findIndex(
      (review) => review?.createdAt === createdAt,
    );

    if (targetIndex === -1) {
      return json({error: 'Review not found'}, {status: 404});
    }

    const targetReview = existingReviews[targetIndex] ?? {};
    customerName = isAdminCustomer ? targetReview.customerName : customerName;
    console.warn(targetReview, '000target');

    if (
      customerId &&
      targetReview?.customerId &&
      targetReview.customerId !== customerId &&
      !isAdminCustomer
    ) {
      return json({error: 'Not authorized to edit this review'}, {status: 403});
    }

    let newCustomerImage = targetReview?.customerImage;
    if (imageFile && typeof imageFile !== 'string') {
      try {
        const uploadedUrl = await uploadReviewMedia(context.env, imageFile as File);
        if (targetReview?.customerImage) {
          try {
            await deleteReviewMedia(context.env, targetReview.customerImage);
          } catch (error) {
            console.error('Failed to delete previous review image', error);
          }
        }
        newCustomerImage = uploadedUrl;
      } catch (error) {
        console.error('Failed to upload new review image', error);
        return json({error: 'Image upload failed'}, {status: 500});
      }
    }
    let newCustomerVideo = targetReview?.customerVideo;
    if (videoFile && typeof videoFile !== 'string') {
      try {
        const uploadedUrl = await uploadReviewMedia(context.env, videoFile as File);
        if (targetReview?.customerVideo) {
          try {
            await deleteReviewMedia(context.env, targetReview.customerVideo);
          } catch (error) {
            console.error('Failed to delete previous review video', error);
          }
        }
        newCustomerVideo = uploadedUrl;
      } catch (error) {
        console.error('Failed to upload new review video', error);
        return json({error: 'Video upload failed'}, {status: 500});
      }
    }

    const updatedReview = {
      ...targetReview,
      text: reviewText || targetReview?.text || '',
      stars: stars || targetReview?.stars || 0,
      title: title || targetReview?.title || '',
      customerName: customerName || targetReview?.customerName || '',
      customerImage: newCustomerImage,
      customerVideo: newCustomerVideo,
      isFeatured: isAdminCustomer
        ? (isFeatured ?? targetReview?.isFeatured ?? false)
        : (targetReview?.isFeatured ?? false),
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

    const wasFeatured = Boolean(targetReview?.isFeatured);
    const isNowFeatured = Boolean(updatedReview?.isFeatured);
    const reviewOwnerCustomerId = targetReview?.customerId as string | undefined;

    if (isAdminCustomer && isNowFeatured && !wasFeatured && reviewOwnerCustomerId) {
      try {
        const existingCustomerNotificationsResponse = await fetch(
          `https://${shop}/admin/api/2024-10/graphql.json`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': adminToken,
              'User-Agent': 'Hydrogen-Review-App',
            },
            body: JSON.stringify({
              query: `#graphql
                query CustomerNotifications($id: ID!) {
                  customer(id: $id) {
                    metafield(namespace: "custom", key: "notifications") {
                      value
                    }
                  }
                }
              `,
              variables: {id: reviewOwnerCustomerId},
            }),
          },
        );

        const existingCustomerNotificationsJson: any =
          await existingCustomerNotificationsResponse.json();
        const existingValue =
          existingCustomerNotificationsJson?.data?.customer?.metafield?.value;

        let customerNotifications: any[] = [];
        if (typeof existingValue === 'string' && existingValue.length) {
          try {
            const parsed = JSON.parse(existingValue);
            customerNotifications = Array.isArray(parsed) ? parsed : [];
          } catch {
            customerNotifications = [];
          }
        }

        const alreadyNotified = customerNotifications.some(
          (notification) =>
            notification?.type === 'review_featured' &&
            notification?.payload?.productId === productId &&
            notification?.payload?.reviewCreatedAt === createdAt,
        );

        if (!alreadyNotified) {
          customerNotifications.unshift({
            id: createNotificationId(),
            type: 'review_featured',
            title: 'Your review has been featured!',
            message:
              'Your review has been featured on the home page! Check it out here.',
            createdAt: new Date().toISOString(),
            readAt: null,
            href: '/#featured-reviews',
            payload: {
              productId,
              productName,
              reviewCreatedAt: createdAt,
            },
          });
        }

        await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
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
                  ownerId: reviewOwnerCustomerId,
                  namespace: 'custom',
                  key: 'notifications',
                  type: 'json',
                  value: JSON.stringify(customerNotifications.slice(0, 50)),
                },
              ],
            },
          }),
        });
      } catch (error) {
        console.error('Unable to create review featured notification', error);
      }
    }

    try {
      await sendDirectEmail({
        env: context.env,
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: `Review updated: ${productName}`,
        text: [
          `Customer: ${customerName}`,
          `Product: ${productName}`,
          `Title: ${title}`,
          `Stars: ${stars}`,
          `Review: ${reviewText}`,
          `Image: ${newCustomerImage ?? 'none'}`,
          `Video: ${newCustomerVideo ?? 'none'}`,
        ].join('\n'),
        html: `
          <h2>Review updated</h2>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p><strong>Product:</strong> ${productName}</p>
          <p><strong>Title:</strong> ${title}</p>
          <p><strong>Stars:</strong> ${stars}</p>
          <p><strong>Review:</strong><br />${reviewText}</p>
          <p><strong>Image:</strong> ${newCustomerImage ? `<a href="${newCustomerImage}">${newCustomerImage}</a>` : 'none'}</p>
          <p><strong>Video:</strong> ${newCustomerVideo ? `<a href="${newCustomerVideo}">${newCustomerVideo}</a>` : 'none'}</p>
        `,
      });
    } catch (error) {
      console.error(error);
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
