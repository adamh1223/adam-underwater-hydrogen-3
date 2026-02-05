import {json, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {getNotificationOrderDetails} from '~/lib/notifications.server';

export async function loader({context, request}: LoaderFunctionArgs) {
  await context.customerAccount.handleAuthStatus();

  if (!context.customerAccount.isLoggedIn()) {
    return json({ok: false, error: 'Not authenticated.'}, {status: 401});
  }

  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId');
  if (!orderId) {
    return json({ok: false, error: 'Missing orderId.'}, {status: 400});
  }

  const order = await getNotificationOrderDetails(context, orderId);
  if (!order) {
    return json({ok: false, error: 'Order not found.'}, {status: 404});
  }

  return json({ok: true, order});
}

export async function action() {
  return new Response(null, {status: 405});
}

