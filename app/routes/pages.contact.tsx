import {useCallback, useEffect, useRef, useState} from 'react';
import {useLoaderData, type MetaFunction} from '@remix-run/react';
import {LoaderFunctionArgs} from '@remix-run/server-runtime';

export const meta: MetaFunction = () => {
  const title = 'Contact Adam Underwater | Book Underwater Video & Photo Services';
  const description =
    'Get in touch with Adam Underwater for underwater photography, underwater videography, stock footage licensing, or custom print orders. Based in San Diego, CA.';

  return [
    {title},
    {name: 'title', content: title},
    {name: 'description', content: description},
    {
      tagName: 'link',
      rel: 'canonical',
      href: 'https://adamunderwater.com/pages/contact',
    },
    {property: 'og:type', content: 'website'},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    {property: 'og:url', content: 'https://adamunderwater.com/pages/contact'},
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:title', content: title},
    {name: 'twitter:description', content: description},
  ];
};
import ContactForm from '~/components/form/Contact';
import NavExample from '~/components/navbar/NavExample';
import RecommendedProducts from '~/components/products/recommendedProducts';
import {
  FEATURED_COLLECTION_QUERY,
  RECOMMENDED_PRODUCTS_QUERY,
} from '~/lib/homeQueries';
import '../styles/routeStyles/contact.css';
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';
import ContactPageSkeleton from '~/components/skeletons/ContactPageSkeleton';
import {SkeletonGate} from '~/components/skeletons/shared';

export async function loader(args: LoaderFunctionArgs) {
  const deferredData = loadDeferredData(args);
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

  return {...deferredData, ...criticalData, wishlistProducts, isLoggedIn};
}

async function loadCriticalData({context}: LoaderFunctionArgs) {
  const [{collections}] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY),
  ]);

  return {
    featuredCollection: collections.nodes[0],
  };
}

function loadDeferredData({context}: LoaderFunctionArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .catch((error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error, '00000000000000000000000000000000000000000000000');
      return null;
    });

  return {
    recommendedProducts,
  };
}

function ContactPage() {
  const collection = useLoaderData<typeof loader>() || {};
  const [isPageReady, setIsPageReady] = useState(false);
  const hasCalledLoad = useRef(false);
  const featuredImgRef = useRef<HTMLImageElement>(null);

  const handleFeaturedImgLoad = useCallback(() => {
    if (hasCalledLoad.current) return;
    hasCalledLoad.current = true;
    setIsPageReady(true);
  }, []);

  // Catch cached images whose onLoad fired before React hydrated
  useEffect(() => {
    const img = featuredImgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      handleFeaturedImgLoad();
    }
  }, [handleFeaturedImgLoad]);

  return (
    <SkeletonGate isReady={isPageReady} skeleton={<ContactPageSkeleton />}>
      <div className="contact-header-container">
        <img
          src={
            'https://downloads.adamunderwater.com/store-1-au/public/icon.png'
          }
          alt="Adam Underwater logo"
          className="icon-header"
        />

        <img
          src={
            'https://downloads.adamunderwater.com/store-1-au/public/contact.png'
          }
          alt="Contact Adam Underwater"
          className="contact-header"
        />
      </div>
      <div className="flex justify-center">
        <ContactForm />
      </div>
      <section>
        <div className="flex justify-center pt-5 me-4">
          <img
            ref={featuredImgRef}
            src={
              'https://downloads.adamunderwater.com/store-1-au/public/featured6.png'
            }
            alt="Featured framed canvas wall art — underwater photography prints by Adam Underwater"
            className="featured-img"
            onLoad={handleFeaturedImgLoad}
          />
        </div>
        <div className="flex justify-center font-bold text-xl pb-2">
          <p>Framed Canvas Wall Art</p>
        </div>
      </section>

      <RecommendedProducts
        products={collection?.recommendedProducts}
        wishlistProducts={collection?.wishlistProducts}
        isLoggedIn={collection?.isLoggedIn}
      />
    </SkeletonGate>
  );
}

export default ContactPage;
