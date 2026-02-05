import {json, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {getNotificationRecommendedProducts} from '~/lib/notifications.server';

export async function loader({context, request}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');

  if (category !== 'Prints' && category !== 'Video') {
    return json({ok: false, error: 'Invalid category.'}, {status: 400});
  }

  const products = await getNotificationRecommendedProducts(context, category);
  return json({ok: true, category, products});
}

export async function action() {
  return new Response(null, {status: 405});
}

