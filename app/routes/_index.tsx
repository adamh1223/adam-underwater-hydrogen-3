import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {Await, useLoaderData, Link, type MetaFunction} from '@remix-run/react';
import {Suspense} from 'react';
import {Image, Money} from '@shopify/hydrogen';
import type {
  FeaturedCollectionFragment,
  RecommendedProductsQuery,
} from 'storefrontapi.generated';
import Hero from '~/components/hero/Hero';
import ProductCarousel from '~/components/products/productCarousel';
import {
  FEATURED_COLLECTION_QUERY,
  RECOMMENDED_PRODUCTS_QUERY,
  FEATURED_REVIEWS_QUERY,
} from '~/lib/homeQueries';
import RecommendedProducts from '~/components/products/recommendedProducts';
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';
import FeaturedProductReviews from '~/components/products/featuredProductReviews';

export const meta: MetaFunction = () => {
  return [{title: 'Adam Underwater | Home'}];
};

export async function loader(args: LoaderFunctionArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  let customer = null;
  try {
    customer = await args.context.customerAccount.query(CUSTOMER_WISHLIST);
  } catch (error) {
    console.warn('Not logged in');
    customer = null;
  }
  if (!customer) {
    return {
      ...deferredData,
      ...criticalData,
      wishlistProducts: [],
      isLoggedIn: undefined,
    };
  }
  const isLoggedIn = args.context.customerAccount.isLoggedIn();
  const currentCustomerId = customer.data.customer.id;

  if (!customer.data.customer.metafield?.value) {
    return [];
  }
  const wishlistProducts = JSON.parse(
    customer.data.customer.metafield?.value,
  ) as string[];

  return {
    ...deferredData,
    ...criticalData,
    wishlistProducts,
    isLoggedIn,
    currentCustomerId,
  };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
export async function loadCriticalData({context}: LoaderFunctionArgs) {
  const [{collections}] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY),
    // Add other queries here, so that they are loaded in parallel
  ]);

  return {
    featuredCollection: collections.nodes[0],
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
export function loadDeferredData({context}: LoaderFunctionArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .catch((error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });

  const featuredReviews = context.storefront
    .query(FEATURED_REVIEWS_QUERY)
    .catch((error) => {
      console.error(error);
      return null;
    });

  return {
    recommendedProducts,
    featuredReviews,
  };
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  console.log(data, 'datadata');

  return (
    <div className="home">
      <Hero></Hero>
      <section>
        <div className="flex justify-center pt-5 me-4">
          <img
            src={
              'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/featured6.png'
            }
            className="featured-img"
          />
        </div>
        <div className="flex justify-center font-bold text-xl pb-2">
          <p>Framed Canvas Wall Art</p>
        </div>
      </section>
      {/* <FeaturedCollection collection={data.featuredCollection} /> */}
      <RecommendedProducts
        products={data.recommendedProducts}
        wishlistProducts={data.wishlistProducts}
        isLoggedIn={data.isLoggedIn}
      />
      <div className="flex justify-center font-bold text-xl pb-2">
        <p>What our customers are saying</p>
      </div>
      <FeaturedProductReviews
        reviews={data.featuredReviews}
        currentCustomerId={data.currentCustomerId}
      />
    </div>
  );
}

function FeaturedCollection({
  collection,
}: {
  collection: FeaturedCollectionFragment;
}) {
  if (!collection) return null;
  const image = collection?.image;
  return (
    <>
      <Link
        className="featured-collection"
        to={`/collections/${collection.handle}`}
      >
        {image && (
          <div className="featured-collection-image">
            <Image data={image} sizes="50vw" />
          </div>
        )}
      </Link>
    </>
  );
}
