import Sectiontitle from '~/components/global/Sectiontitle';
import '../styles/routeStyles/work.css';
import {LoaderFunctionArgs} from '@remix-run/server-runtime';
import {
  FEATURED_COLLECTION_QUERY,
  RECOMMENDED_PRODUCTS_QUERY,
} from '~/lib/homeQueries';
import RecommendedProducts from '~/components/products/recommendedProducts';
import {useLoaderData} from '@remix-run/react';
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';

export async function loader(args: LoaderFunctionArgs) {
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

  if (!customer.data.customer.metafield?.value) {
    return [];
  }
  const wishlistProducts = JSON.parse(
    customer.data.customer.metafield?.value,
  ) as string[];

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
  return (
    <>
      <div className="flex justify-center items-center gap-4 mt-3">
        <img
          src={
            'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/icon.png'
          }
          className="icon-header"
        />

        <img
          src={
            'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/work.png'
          }
          className="work-header"
        />
      </div>
      <div>
        <Sectiontitle text="Seaforestation (Trailer)" />
      </div>
      <div className="clip-wrapper flex justify-center position-relative px-[40px] pt-[20px] pb-[10px]">
        <iframe
          className="clip"
          src="https://player.vimeo.com/video/814128392?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
          allow="autoplay; fullscreen; picture-in-picture;"
          title="Seaforestation Trailer"
        ></iframe>
      </div>

      {/* <script src="https://player.vimeo.com/api/player.js"></script> */}
      <div>
        <Sectiontitle text="Urchinomics/Sumiré Uni Co" />
      </div>
      <div className="clip-wrapper flex justify-center position-relative px-[40px] pt-[20px] pb-[15px]">
        <iframe
          className="clip"
          src="https://player.vimeo.com/video/795362432?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
          allow="autoplay; fullscreen; picture-in-picture;"
          title="Urchinomics"
        ></iframe>
      </div>
      <script src="https://player.vimeo.com/api/player.js"></script>
      <section>
        <div className="flex justify-center me-4">
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

      <RecommendedProducts
        products={collection?.recommendedProducts}
        wishlistProducts={collection?.wishlistProducts}
        isLoggedIn={collection?.isLoggedIn}
      />
    </>
  );
}

export default WorkPage;
