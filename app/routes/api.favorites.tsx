import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';
import {
  CUSTOMER_UPDATE_MUTATION,
  CUSTOMER_UPDATE_WISHLIST,
} from '~/graphql/customer-account/CustomerUpdateMutation';

export async function action({request, context}: ActionFunctionArgs) {
  try {
    const {customerAccount} = context;
    const productId = (await request.formData()).get('productId');
    const data = await context.customerAccount.query(`#graphql
    query {
        customer {
            id
        }
    }
    `);
    const customerId = data.data.customer.id;
    console.log(customerId, 'customerid');

    const response = await customerAccount.mutate(CUSTOMER_UPDATE_WISHLIST, {
      variables: {
        metafields: {
          key: 'wishlist',
          namespace: 'custom',
          ownerId: customerId,
          type: 'list.product_reference',
          value: JSON.stringify([productId]),
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
