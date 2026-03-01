import type {Review} from '~/components/global/ProductReviewsDisplay';
import {adminGraphql} from '~/lib/shopify-admin.server';
import {
  getCustomerReviewLocation,
  type ReviewLocationFields,
} from '~/lib/reviews';

type CustomerNode = {
  id?: string | null;
  defaultAddress?: {
    zoneCode?: string | null;
    territoryCode?: string | null;
  } | null;
  addresses?: {
    nodes?: Array<{
      zoneCode?: string | null;
      territoryCode?: string | null;
    } | null> | null;
  } | null;
} | null;

const REVIEW_LOCATION_CUSTOMERS_QUERY = `#graphql
  query ReviewLocationCustomers($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Customer {
        id
        defaultAddress {
          zoneCode
          territoryCode
        }
        addresses(first: 6) {
          nodes {
            zoneCode
            territoryCode
          }
        }
      }
    }
  }
` as const;

function hasReviewLocation(review: Review) {
  return Boolean(review.customerState || review.customerCountry);
}

export async function hydrateMissingReviewLocations(
  env: Env,
  reviews: Review[],
): Promise<Review[]> {
  const customerIds = Array.from(
    new Set(
      reviews
        .filter((review) => !hasReviewLocation(review))
        .map((review) => review.customerId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (!customerIds.length) return reviews;

  try {
    const response = await adminGraphql<{data?: {nodes?: CustomerNode[]}}>({
      env,
      query: REVIEW_LOCATION_CUSTOMERS_QUERY,
      variables: {ids: customerIds},
    });

    const locationsByCustomerId = new Map<string, ReviewLocationFields>();
    for (const node of response?.data?.nodes ?? []) {
      if (!node?.id) continue;
      const location = getCustomerReviewLocation(node);
      if (!location.customerState && !location.customerCountry) continue;
      locationsByCustomerId.set(node.id, location);
    }

    if (!locationsByCustomerId.size) return reviews;

    return reviews.map((review) => {
      if (hasReviewLocation(review) || !review.customerId) return review;
      const location = locationsByCustomerId.get(review.customerId);
      if (!location) return review;

      return {
        ...review,
        customerState: location.customerState,
        customerCountry: location.customerCountry,
      };
    });
  } catch (error) {
    console.error('Unable to hydrate review locations', error);
    return reviews;
  }
}

export async function hydrateReviewLocationsInMetafieldValue(
  env: Env,
  value?: string | null,
): Promise<string | null | undefined> {
  if (!value) return value;

  let parsed: Review[] = [];
  try {
    parsed = JSON.parse(value) as Review[];
  } catch {
    return value;
  }

  if (!Array.isArray(parsed) || !parsed.length) return value;

  const hydrated = await hydrateMissingReviewLocations(env, parsed);
  return JSON.stringify(hydrated);
}
