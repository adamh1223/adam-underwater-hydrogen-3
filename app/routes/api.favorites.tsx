import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';

export async function action({request, context}: ActionFunctionArgs) {
  try {
    const {customerAccount} = context
    const body = await request.json();
await customerAccount.query(`#graphql
mutation addToWishlist(
    $productId: ID
)
customer {
    
}
`)
    return json({success: true, result: ''});
  } catch (error) {
    console.error(error);
    return json({error: 'request failed', status: 500});
  }
}

export async function loader() {
  return new Response(null, {status: 405});
}
