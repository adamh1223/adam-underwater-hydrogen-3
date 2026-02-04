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
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';

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

  return (
    <>
      <div className="contact-header-container">
        <img
          src={
            'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/icon.png'
          }
          className="icon-header"
        />

        <img
          src={
            'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/contact.png'
          }
          className="contact-header"
        />
      </div>
      <div className="flex justify-center">
        <ContactForm />
      </div>
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

      <RecommendedProducts
        products={collection?.recommendedProducts}
        wishlistProducts={collection?.wishlistProducts}
        isLoggedIn={collection?.isLoggedIn}
      />
    </>
  );
}

export default ContactPage;
