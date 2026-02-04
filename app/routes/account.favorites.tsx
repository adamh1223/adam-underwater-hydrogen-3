import type {CustomerAddressInput} from '@shopify/hydrogen/customer-account-api-types';
import type {
  AddressFragment,
  CustomerFragment,
} from 'customer-accountapi.generated';
import {
  data,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@shopify/remix-oxygen';
import {
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
  type MetaFunction,
  type Fetcher,
  useLoaderData,
  Link,
} from '@remix-run/react';
import {
  UPDATE_ADDRESS_MUTATION,
  DELETE_ADDRESS_MUTATION,
  CREATE_ADDRESS_MUTATION,
} from '~/graphql/customer-account/CustomerAddressMutations';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '~/components/ui/card';
import '../styles/routeStyles/addresses.css';
import {Button} from '~/components/ui/button';
import {
  CUSTOMER_WISHLIST,
  productQuery,
  variantQuery,
} from '~/lib/customerQueries';
import ProductCarousel from '~/components/products/productCarousel';
import EProductsContainer from '~/components/eproducts/EProductsContainer';
import {useEffect} from 'react';
import Sectiontitle from '~/components/global/Sectiontitle';

export const meta: MetaFunction = () => {
  return [{title: 'Favorites'}];
};

export async function loader(args: LoaderFunctionArgs) {
  const {context} = args;
  await context.customerAccount.handleAuthStatus();
  // const token = await loadCriticalData(args);
  const customer = await context.customerAccount.query(CUSTOMER_WISHLIST);
  const isLoggedIn = context.customerAccount.isLoggedIn();

  if (!customer.data.customer.metafield?.value) {
    return [];
  }
  const wishlistProducts = JSON.parse(
    customer.data.customer.metafield?.value,
  ) as string[];
  console.log(wishlistProducts, 'wishlistprods');
  

  const productNodes = await Promise.all(
    wishlistProducts?.map((id) =>
      context.storefront.query(productQuery, {
        variables: {
          id,
        },
      }),
    ),
  );

  const products = productNodes?.map(({node}) => {
    return {...node};
  });

  const wishlist = {};

  return {products, isLoggedIn};
}

export async function action({request, context}: ActionFunctionArgs) {
  const {customerAccount} = context;
}

export default function Favorites() {
  const {customer} = useOutletContext<{customer: CustomerFragment}>();
  const {products, isLoggedIn} = useLoaderData<typeof loader>();

  return (
    <>
      <Sectiontitle text="My Favorites" />
      {products && <div className="prods-grid gap-x-5">
        {products?.map((product) => {
          {
            product.tags.includes('prints') ? (
              <div className="flex justify-center pb-2">
                Framed Canvas Print:
              </div>
            ) : (
              <div className="flex justify-center pb-2">
                Stock Footage Clip:
              </div>
            );
          }
          if (product.tags.includes('Prints')) {
            return (
              <>
                <ProductCarousel
                  product={product}
                  layout="grid"
                  isInWishlist={true}
                  isLoggedIn={isLoggedIn}
                />
              </>
            );
          }
          if (product.tags.includes('Video')) {
            return (
              <>
                <EProductsContainer
                  product={product}
                  layout="grid"
                  isInWishlist={true}
                  isLoggedIn={isLoggedIn}
                />
              </>
            );
          }
        })}
      </div>}
      {!products && 
      <div className='mt-3'>
      {/* THIS IS CODE FOR APOSTROPHE */}
      <p className='text-center'>You don&apos;t have any favorites yet.</p>
      <div className="flex justify-center mt-4">
        <Button variant="default">
          <Link to="/collections/prints">Start Shopping →</Link>
        </Button>
      </div>
    </div>}
    </>
  );
}
