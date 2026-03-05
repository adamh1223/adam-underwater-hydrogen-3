import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  Await,
  useLoaderData,
  Link,
  type MetaFunction,
  useLocation,
} from '@remix-run/react';
import {Suspense, useEffect, useState} from 'react';
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
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import {getCustomerReviewLocation} from '~/lib/reviews';
import HomePageSkeleton from '~/components/home/HomePageSkeleton';
import {useEntranceSkeletonReady} from '~/components/skeletons/shared';

export const meta: MetaFunction = () => {
  const title = 'Adam Underwater | Underwater Video & Photo';
  const description =
    'Underwater video and photo services. Shop underwater wall art and premium stock footage.';
  const shareImage =
    'https://downloads.adamunderwater.com/store-1-au/public/imessage-icon.png';

  return [
    { title },
    { name: 'description', content: description },

    // Open Graph (Google + social)
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://adamunderwater.com' },
    { property: 'og:image', content: shareImage },
    { property: 'og:image:secure_url', content: shareImage },
    {
      property: 'og:image:alt',
      content: 'Adam Underwater icon preview',
    },

    // Twitter
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: shareImage },
    { name: 'twitter:image:alt', content: 'Adam Underwater icon preview' },
  ];
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
  let currentCustomerState: string | undefined;
  let currentCustomerCountry: string | undefined;

  try {
    const customerDetails = await args.context.customerAccount.query(
      CUSTOMER_DETAILS_QUERY,
    );
    const reviewLocation = getCustomerReviewLocation(
      customerDetails?.data?.customer,
    );
    currentCustomerState = reviewLocation.customerState;
    currentCustomerCountry = reviewLocation.customerCountry;
  } catch {
    currentCustomerState = undefined;
    currentCustomerCountry = undefined;
  }

  let wishlistProducts: string[] = [];
  const wishlistValue = customer.data.customer.metafield?.value;
  if (typeof wishlistValue === 'string' && wishlistValue.length) {
    try {
      const parsed = JSON.parse(wishlistValue);
      if (Array.isArray(parsed)) {
        wishlistProducts = parsed.filter(
          (value): value is string => typeof value === 'string',
        );
      }
    } catch {
      wishlistProducts = [];
    }
  }

  return {
    ...deferredData,
    ...criticalData,
    wishlistProducts,
    isLoggedIn,
    currentCustomerId,
    currentCustomerState,
    currentCustomerCountry,
  };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context}: LoaderFunctionArgs) {
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
function loadDeferredData({context}: LoaderFunctionArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .catch((error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });

  const featuredReviews = context.storefront
    .query(FEATURED_REVIEWS_QUERY)
    .then(async (response) => {
      const {hydrateReviewLocationsInMetafieldValue} = await import(
        '~/lib/reviews.server'
      );
      await Promise.all(
        (response?.products?.nodes ?? []).map(async (node) => {
          if (!node?.metafield?.value) return;
          node.metafield.value = await hydrateReviewLocationsInMetafieldValue(
            context.env,
            node.metafield.value,
          );
        }),
      );

      return response;
    })
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
  const location = useLocation();
  const [isPageReady, setIsPageReady] = useState(false);
  const isContentReady = useEntranceSkeletonReady(isPageReady);

  useEffect(() => {
    const hashTarget = location.hash ? location.hash.replace('#', '') : null;
    if (!hashTarget) return;

    const targetElement = document.getElementById(hashTarget);
    if (!targetElement) return;

    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        targetElement.scrollIntoView({block: 'start'});
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [location.hash]);

  return (
    <div className="home">
      {/* Full-page skeleton overlay — covers everything including navbar */}
      {!isContentReady && (
        <div className="fixed inset-0 z-[999] bg-background">
          <HomePageSkeleton />
        </div>
      )}

      {/* Real content — invisible until hero-img loads, then revealed */}
      <div className={isContentReady ? '' : 'invisible'}>
        <Hero onHeroImgLoad={() => setIsPageReady(true)} />
        <section>
          <div className="flex justify-center pt-5 me-4">
            <img
              src={
                'https://downloads.adamunderwater.com/store-1-au/public/featured6.png'
              }
              alt="Framed Canvas Wall Art"
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
        <div id="featured-reviews" className="scroll-mt-28">
          <div className="flex justify-center font-bold text-xl pb-2">
            <p>What our customers are saying</p>
          </div>
          <FeaturedProductReviews
            reviews={data.featuredReviews}
            currentCustomerId={data.currentCustomerId}
            currentCustomerState={data.currentCustomerState}
            currentCustomerCountry={data.currentCustomerCountry}
          />
        </div>
      </div>
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
