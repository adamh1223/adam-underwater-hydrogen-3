import {useCallback, useEffect, useRef, useState} from 'react';
import {type MetaFunction, useLoaderData} from '@remix-run/react';
import Sectiontitle from '~/components/global/Sectiontitle';
import '../styles/routeStyles/work.css';
import {LoaderFunctionArgs} from '@remix-run/server-runtime';
import {redirect} from '@shopify/remix-oxygen';
import {
  FEATURED_COLLECTION_QUERY,
  RECOMMENDED_PRODUCTS_QUERY,
} from '~/lib/homeQueries';
import RecommendedProducts from '~/components/products/recommendedProducts';
import {getRedirectPathFromLegacyPagePath} from '~/lib/pagePaths';
import {VimeoFacade} from '~/components/video/VimeoFacade';
import {YouTubeFacade} from '~/components/video/YouTubeFacade';

const R2 = 'https://downloads.adamunderwater.com/store-1-au/public';
export function links() {
  return [{rel: 'preload', as: 'image', href: `${R2}/work.png`}];
}

export const meta: MetaFunction = () => {
  const title =
    'Underwater Video Portfolio | Adam Underwater — Stock Footage & Cinematography';
  const description =
    'Watch underwater video reels and cinematography by Adam Underwater. Professional 4K underwater stock footage of marine life, kelp forests, sharks, and ocean wildlife in San Diego, CA.';

  return [
    {title},
    {name: 'title', content: title},
    {name: 'description', content: description},
    {
      tagName: 'link',
      rel: 'canonical',
      href: 'https://adamunderwater.com/work',
    },
    {property: 'og:type', content: 'website'},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    {property: 'og:url', content: 'https://adamunderwater.com/work'},
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:title', content: title},
    {name: 'twitter:description', content: description},
  ];
};
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';
import WorkPageSkeleton from '~/components/skeletons/WorkPageSkeleton';
import {SkeletonGate} from '~/components/skeletons/shared';

export async function loader(args: LoaderFunctionArgs) {
  const url = new URL(args.request.url);
  const redirectPath = getRedirectPathFromLegacyPagePath(url.pathname);
  if (redirectPath) {
    throw redirect(`${redirectPath}${url.search}`, 301);
  }

  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  //   need the customer variable, add these lines for other instances of recommended products
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

function WorkPage() {
  const collection = useLoaderData<typeof loader>() || {};
  const [isFeaturedImageReady, setIsFeaturedImageReady] = useState(false);
  const featuredImgRef = useRef<HTMLImageElement>(null);
  const isPageReady = isFeaturedImageReady;

  const handleFeaturedImgLoad = useCallback(() => {
    setIsFeaturedImageReady(true);
  }, []);

  // Catch cached images whose onLoad fired before React hydrated
  useEffect(() => {
    const img = featuredImgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      handleFeaturedImgLoad();
    }
  }, [handleFeaturedImgLoad]);

  return (
    <SkeletonGate isReady={isPageReady} skeleton={<WorkPageSkeleton />}>
      <div className="flex justify-center items-center gap-4 mt-3">
        <img
          src={
            'https://downloads.adamunderwater.com/store-1-au/public/icon.png'
          }
          alt="Adam Underwater logo"
          className="icon-header"
        />

        <img
          src={
            'https://downloads.adamunderwater.com/store-1-au/public/work.png'
          }
          alt="Underwater video portfolio by Adam Underwater"
          className="work-header"
        />
      </div>
      <div>
        <Sectiontitle text="Seaforestation (Trailer)" />
      </div>
      <div className="clip-wrapper flex justify-center position-relative px-[40px] pt-[20px] pb-[10px]">
        {/* TODO: replace YOUTUBE_VIDEO_ID with your actual YouTube video ID */}
        <YouTubeFacade
          videoId="VCyUJvI69FA"
          title="Seaforestation Trailer"
          className="clip"
        />
      </div>

      <div>
        <Sectiontitle text="Tasmania Giant Kelp Forest Restoration" />
      </div>
      <div className="clip-wrapper flex justify-center position-relative px-[40px] pt-[20px] pb-[15px]">
        <YouTubeFacade
          videoId="u1s9f3bpQEs"
          title="Tasmania Giant Kelp Forest Restoration"
          className="clip"
        />
      </div>
      <section>
        <div className="flex justify-center me-4">
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

export default WorkPage;
