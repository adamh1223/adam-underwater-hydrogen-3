import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from '@shopify/remix-oxygen';
import {useLoaderData, useOutletContext} from '@remix-run/react';
import type {CustomerFragment} from 'customer-accountapi.generated';
import AccountReviews from '~/components/global/AccountReviews';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import Sectiontitle from '~/components/global/Sectiontitle';
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';
import {useIsLoggedIn} from '~/lib/hooks';
import {getCustomerReviewLocation} from '~/lib/reviews';
import {buildIconLinkPreviewMeta} from '~/lib/linkPreview';

const CUSTOMER_REVIEWS_QUERY = `#graphql
  query CustomerReviews($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 50, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        handle
        tags
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        images(first: 10) {
          nodes {
            url
            altText
          }
        }
        featuredImage {
          url
          altText
        }
        metafield(namespace: "custom", key: "reviews") {
          value
        }
      }
    }
  }
`;

export const meta: MetaFunction = () => {
  return buildIconLinkPreviewMeta('Adam Underwater | My Reviews');
};

export async function loader({context}: LoaderFunctionArgs) {
  const isLoggedIn = await context.customerAccount.isLoggedIn();
  if (!isLoggedIn) {
    return {products: [], customer: null, wishlistProducts: [], isLoggedIn};
  }

  const [productsResponse, customerResponse, wishlistResponse] =
    await Promise.all([
      context.storefront.query(CUSTOMER_REVIEWS_QUERY),
      context.customerAccount.query(CUSTOMER_DETAILS_QUERY),
      context.customerAccount.query(CUSTOMER_WISHLIST).catch(() => null),
    ]);

  const products = productsResponse?.products?.nodes ?? [];
  const customer = customerResponse?.data?.customer ?? null;
  const wishlistValue = wishlistResponse?.data?.customer?.metafield?.value;
  let wishlistProducts: string[] = [];

  try {
    wishlistProducts = wishlistValue
      ? (JSON.parse(wishlistValue) as string[])
      : [];
  } catch (error) {
    console.error('Unable to parse wishlist', error);
  }
  return {products, customer, wishlistProducts, isLoggedIn};
}

export default function AccountReviewsRoute() {
  const {products, customer, wishlistProducts, isLoggedIn} =
    useLoaderData<typeof loader>();
  const outletContext = useOutletContext<{customer: CustomerFragment | null}>();

  if (!isLoggedIn) {
    return (
      <div className="account-reviews space-y-3">
        <Sectiontitle text="My Reviews" />
        <p className="text-center mt-3">Sign in to view your reviews.</p>
      </div>
    );
  }

  const resolvedCustomer = customer ?? outletContext.customer;
  

  const customerId = resolvedCustomer?.id;
  const customerName = [
    resolvedCustomer?.firstName ?? '',
    resolvedCustomer?.lastName ?? '',
  ]
    .join(' ')
    .trim();
  const {customerState, customerCountry} =
    getCustomerReviewLocation(resolvedCustomer);

  return (
    <div className="account-reviews space-y-3">
      <Sectiontitle text="My Reviews" />
      <AccountReviews
        products={products}
        customerId={customerId}
        customerName={customerName || undefined}
        customerState={customerState}
        customerCountry={customerCountry}
        wishlistProducts={wishlistProducts}
        isLoggedIn={isLoggedIn}
      />
    </div>
  );
}
