import {json, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import type {Review} from '~/components/global/ProductReviewsDisplay';
import {productQuery} from '~/lib/customerQueries';
import {GET_REVIEW_QUERY} from '~/lib/homeQueries';

type FeaturedReviewDetailResponse =
  | {
      ok: true;
      notificationId: string | null;
      product: unknown;
      review: Review;
    }
  | {ok: false; notificationId: string | null; error: string};

export async function loader({context, request}: LoaderFunctionArgs) {
  await context.customerAccount.handleAuthStatus();

  if (!context.customerAccount.isLoggedIn()) {
    return json<FeaturedReviewDetailResponse>(
      {ok: false, notificationId: null, error: 'Not authenticated.'},
      {status: 401},
    );
  }

  const url = new URL(request.url);
  const notificationId = url.searchParams.get('notificationId');
  const productId = url.searchParams.get('productId');
  const reviewCreatedAt = url.searchParams.get('reviewCreatedAt');

  if (!productId || !reviewCreatedAt) {
    return json<FeaturedReviewDetailResponse>(
      {
        ok: false,
        notificationId,
        error: 'Missing productId or reviewCreatedAt.',
      },
      {status: 400},
    );
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
  if (!customerId) {
    return json<FeaturedReviewDetailResponse>(
      {ok: false, notificationId, error: 'Not authenticated.'},
      {status: 401},
    );
  }

  const productResponse = await context.storefront
    .query(productQuery, {variables: {id: productId}})
    .catch(() => null);
  const product = productResponse?.node ?? null;
  if (!product) {
    return json<FeaturedReviewDetailResponse>(
      {ok: false, notificationId, error: 'Product not found.'},
      {status: 404},
    );
  }

  const reviewResponse = await context.storefront
    .query(GET_REVIEW_QUERY, {variables: {productId}})
    .catch(() => null);
  const rawValue = reviewResponse?.product?.metafield?.value as
    | string
    | null
    | undefined;

  if (!rawValue) {
    return json<FeaturedReviewDetailResponse>(
      {ok: false, notificationId, error: 'Review not found.'},
      {status: 404},
    );
  }

  let parsed: Review[] = [];
  try {
    parsed = JSON.parse(rawValue) as Review[];
  } catch {
    parsed = [];
  }

  const matching =
    parsed
      .filter((review) => review?.customerId === customerId)
      .find((review) => review?.createdAt === reviewCreatedAt) ?? null;

  if (!matching) {
    return json<FeaturedReviewDetailResponse>(
      {ok: false, notificationId, error: 'Review not found.'},
      {status: 404},
    );
  }

  return json<FeaturedReviewDetailResponse>({
    ok: true,
    notificationId,
    product,
    review: matching,
  });
}

export async function action() {
  return new Response(null, {status: 405});
}

