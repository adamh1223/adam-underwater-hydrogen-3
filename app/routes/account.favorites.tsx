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
import {applyHighestResolutionVariantToProducts} from '~/lib/resolution';
import ProductCarousel from '~/components/products/productCarousel';
import EProductsContainer from '~/components/eproducts/EProductsContainer';
import {useEffect} from 'react';
import Sectiontitle from '~/components/global/Sectiontitle';
import {buildIconLinkPreviewMeta} from '~/lib/linkPreview';

export const meta: MetaFunction = () => {
  return [
    ...buildIconLinkPreviewMeta('Adam Underwater | My Favorites'),
    {name: 'robots', content: 'noindex, nofollow'},
  ];
};

export async function loader(args: LoaderFunctionArgs) {
  const {context} = args;
  const isLoggedIn = await context.customerAccount.isLoggedIn();
  if (!isLoggedIn) {
    return {products: [], isLoggedIn};
  }

  const customer = await context.customerAccount.query(CUSTOMER_WISHLIST);

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
  
  

  const productNodes = await Promise.all(
    wishlistProducts.map((id) =>
      context.storefront.query(productQuery, {
        variables: {
          id,
        },
      }),
    ),
  );

  const products = applyHighestResolutionVariantToProducts(
    productNodes?.map(({node}) => {
      return {...node};
    }),
  );

  const wishlist = {};

  return {products, isLoggedIn};
}

export async function action({request, context}: ActionFunctionArgs) {
  const {customerAccount} = context;
}

export default function Favorites() {
  const {products, isLoggedIn} = useLoaderData<typeof loader>();

  if (!isLoggedIn) {
    return (
      <>
        <Sectiontitle text="My Favorites" />
        <p className="text-center mt-3">Sign in to view your favorites.</p>
      </>
    );
  }

  return (
    <>
      <Sectiontitle text="My Favorites" />
      {products?.length ? (
        <div className="prods-grid gap-x-5 favorites-product-grid collection-results-surface">
          {products.map((product) => {
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
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-center">
            You don&apos;t have any favorites yet.
          </p>
          <div className="flex justify-center mt-4">
            <Button variant="default">
              <Link to="/collections/prints">Start Shopping →</Link>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
