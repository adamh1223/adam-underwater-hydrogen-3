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

export type ActionResponse = {
  addressId?: string | null;
  createdAddress?: AddressFragment;
  defaultAddress?: string | null;
  deletedAddress?: string | null;
  error: Record<AddressFragment['id'], string> | null;
  updatedAddress?: AddressFragment;
};

export const meta: MetaFunction = () => {
  return [{title: 'Favorites'}];
};

export async function loader(args: LoaderFunctionArgs) {
  const {context} = args;
  await context.customerAccount.handleAuthStatus();
  // const token = await loadCriticalData(args);
  const customer = await context.customerAccount.query(CUSTOMER_WISHLIST);

  console.log(customer, '0101010010101010101001010101010100110101');
  if (!customer.data.customer.metafield?.value) {
    return [];
  }
  const wishlistProducts = JSON.parse(
    customer.data.customer.metafield?.value,
  ) as string[];
  
  const productNodes = await Promise.all(
    wishlistProducts?.map((id) =>
      context.storefront.query(productQuery, {
        variables: {
          id,
        },
      }),
    ),
  );
  console.log(productNodes, '40404040044004040404040404040404040');

  const products = productNodes?.map(({node}) => {
    console.log(node, '30303030030303030303030303003030303030303');

    return {...node};
  });
  console.log(products, '2020200202020202020202020202200220202020020202020202');

  const wishlist = {};
  console.log(wishlist, '1111111111111111111');
  return {products};
}
// async function loadCriticalData({context}: LoaderFunctionArgs) {
//   const token = await context.customerAccount.getAccessToken();

//   return token;
// }
// async function loadDeferredData({context}: LoaderFunctionArgs) {
//   const token = await context.customerAccount.getAccessToken();
//   const recommendedProducts = context.storefront
//     .query(CUSTOMER_WISHLIST, {
//       variables: {
//         token,
//       },
//     })
//     .catch((error) => {
//       // Log query errors, but don't throw them so the page can still render
//       console.error(error, '00000000000000000000000000000000000000000000000');
//       return null;
//     });

//   return {
//     recommendedProducts,
//   };
// }
export async function action({request, context}: ActionFunctionArgs) {
  const {customerAccount} = context;
}

export default function Favorites() {
  const {customer} = useOutletContext<{customer: CustomerFragment}>();
  const {products} = useLoaderData<typeof loader>();

  console.log(customer.id, '2000');
  console.log(products, '20001');
  return (
    <>
      {products?.map((product) => {
        console.log(product, 'productlog');

        if (product.tags.includes('Prints')) {
          return (
            <>
              <div className="m-5">
                <div className="flex justify-center pb-2">
                  Framed Canvas Print:
                </div>
                <ProductCarousel product={product} layout="grid" />
              </div>
            </>
          );
        }
        if (product.tags.includes('Video')) {
          return (
            <>
              <div className="mx-5">
                <div className="flex justify-center pb-2">
                  Stock Footage Clip:
                </div>
                <EProductsContainer product={product} layout="grid" />
              </div>
            </>
          );
        }
      })}
    </>
  );
}
