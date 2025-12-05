import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';
import {
  CUSTOMER_UPDATE_MUTATION,
  CUSTOMER_UPDATE_WISHLIST,
} from '~/graphql/customer-account/CustomerUpdateMutation';
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';

export async function action({request, context}: ActionFunctionArgs) {
  try {
    const {customerAccount} = context;
    const productId = (await request.formData()).get('productId') as string;
    const data = await context.customerAccount.query(CUSTOMER_WISHLIST);

    let existingWishlist: string[];
    const customerMetafieldValue =
      data?.data?.customer?.metafield?.value ?? undefined;
    if (customerMetafieldValue) {
      existingWishlist = JSON.parse(customerMetafieldValue) as string[];
    } else {
      existingWishlist = [];
    }

    existingWishlist.push(productId);

    const customerId = data?.data?.customer?.id;
    console.log(customerId, 'customerid');

    const response = await customerAccount.mutate(CUSTOMER_UPDATE_WISHLIST, {
      variables: {
        metafields: {
          key: 'wishlist',
          namespace: 'custom',
          ownerId: customerId,
          type: 'list.product_reference',
          value: JSON.stringify(existingWishlist),
        },
      },
    });
    console.log(response.data.metafieldsSet.userErrors[0], 'resp');

    return json({success: true, result: ''});
  } catch (error) {
    console.error(error);
    return json({error: 'request failed', status: 500});
  }
}

export async function loader() {
  return new Response(null, {status: 405});
}
