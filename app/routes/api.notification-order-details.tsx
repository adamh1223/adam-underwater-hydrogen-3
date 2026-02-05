import {json, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {getNotificationOrderDetails} from '~/lib/notifications.server';
import {GET_REVIEW_QUERY} from '~/lib/homeQueries';

export async function loader({context, request}: LoaderFunctionArgs) {
  await context.customerAccount.handleAuthStatus();

  if (!context.customerAccount.isLoggedIn()) {
    return json({ok: false, error: 'Not authenticated.'}, {status: 401});
  }

  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId');
  if (!orderId) {
    return json({ok: false, error: 'Missing orderId.'}, {status: 400});
  }

  const order = await getNotificationOrderDetails(context, orderId);
  if (!order) {
    return json({ok: false, error: 'Order not found.'}, {status: 404});
  }

  const customerIdQuery = `#graphql
    query NotificationCustomerId {
      customer {
        id
      }
    }
  ` as const;

  const customerResponse = await context.customerAccount
    .query(customerIdQuery)
    .catch(() => null);
  const customerId = customerResponse?.data?.customer?.id as string | undefined;

  let userReviewsByProductId: Record<string, any> | null = null;
  if (customerId) {
    const printProductIds = Array.from(
      new Set(
        (order.lineItems ?? [])
          .filter((lineItem) => {
            const tags = lineItem.product?.tags ?? [];
            return tags.includes('Prints') && !tags.includes('Video');
          })
          .map((lineItem) => lineItem.product?.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );

    const results = await Promise.all(
      printProductIds.map(async (productId) => {
        try {
          const response = await context.storefront.query(GET_REVIEW_QUERY, {
            variables: {productId},
          });
          const rawValue = response?.product?.metafield?.value;
          if (!rawValue) return {productId, review: null};

          let parsed: any[] = [];
          try {
            parsed = JSON.parse(rawValue) as any[];
          } catch {
            parsed = [];
          }

          const matching = parsed
            .filter((review) => review?.customerId === customerId)
            .sort((a, b) =>
              String(b?.createdAt ?? '').localeCompare(String(a?.createdAt ?? '')),
            )[0];

          return {productId, review: matching ?? null};
        } catch (error) {
          console.error('Unable to load product reviews', error);
          return {productId, review: null};
        }
      }),
    );

    userReviewsByProductId = results.reduce<Record<string, any>>((acc, item) => {
      acc[item.productId] = item.review;
      return acc;
    }, {});
  }

  return json({ok: true, order, userReviewsByProductId});
}

export async function action() {
  return new Response(null, {status: 405});
}
