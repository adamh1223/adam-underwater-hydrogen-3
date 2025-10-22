import {useLoaderData} from '@remix-run/react';
import {LoaderFunctionArgs} from '@remix-run/server-runtime';
import ContactForm from '~/components/form/Contact';
import NavExample from '~/components/navbar/NavExample';
import RecommendedProducts from '~/components/products/recommendedProducts';
import {
  FEATURED_COLLECTION_QUERY,
  RECOMMENDED_PRODUCTS_QUERY,
} from '~/lib/homeQueries';
import '../styles/routeStyles/contact.css';

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

function ContactPage() {
  const collection = useLoaderData<typeof loader>() || {};
  console.log(collection.recommendedProducts, 'collection');

  return (
    <>
      <div className="flex flex-col items-center pt-4">
        <img
          src="/contact2.png"
          alt="Contact Banner"
          className="mb-5"
          style={{height: '100px'}}
        />
        <ContactForm />
      </div>
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

export default ContactPage;
