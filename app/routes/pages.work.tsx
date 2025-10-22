import Sectiontitle from '~/components/global/Sectiontitle';
import '../styles/routeStyles/work.css';
import {LoaderFunctionArgs} from '@remix-run/server-runtime';
import {
  FEATURED_COLLECTION_QUERY,
  RECOMMENDED_PRODUCTS_QUERY,
} from '~/lib/homeQueries';
import RecommendedProducts from '~/components/products/recommendedProducts';
import {useLoaderData} from '@remix-run/react';
export async function loader(args: LoaderFunctionArgs) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
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
  console.log(collection.recommendedProducts, 'collection');
  return (
    <>
      <div className="flex justify-center pb-5 ps-5">
        <img src={'/work2.png'} style={{height: '115px'}} className="pt-3" />
      </div>
      <div>
        <Sectiontitle text="Seaforestation (Trailer)" />
      </div>
      <div className="clip-wrapper flex justify-center position-relative">
        <iframe
          className="clip"
          src="https://player.vimeo.com/video/814128392?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
          allow="autoplay; fullscreen; picture-in-picture;"
          title="Seaforestation Trailer"
        ></iframe>
      </div>

      {/* <script src="https://player.vimeo.com/api/player.js"></script> */}
      <div>
        <Sectiontitle text="Urchinomics x Sumiré Uni Co" />
      </div>
      <div className="clip-wrapper flex justify-center position-relative p-[50px]">
        <iframe
          className="clip"
          src="https://player.vimeo.com/video/795362432?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
          allow="autoplay; fullscreen; picture-in-picture;"
          title="Urchinomics"
        ></iframe>
      </div>
      <script src="https://player.vimeo.com/api/player.js"></script>
      <section>
        <div className="flex justify-center pt-5">
          <img src={'/featured.png'} className="featured-img" />
        </div>
        <div className="flex justify-center font-bold text-xl pb-2">
          <p>Framed Canvas Wall Art</p>
        </div>
      </section>

      <RecommendedProducts products={collection?.recommendedProducts} />
    </>
  );
}

export default WorkPage;
