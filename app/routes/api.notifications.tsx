import {json, type ActionFunctionArgs, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  markCustomerNotificationRead,
  syncCustomerNotifications,
} from '~/lib/notifications.server';

export async function loader({context, request}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const result = await syncCustomerNotifications(context, {
    limit: Number.isFinite(limit) && limit && limit > 0 ? limit : undefined,
  });

  return json(result);
}

export async function action({context, request}: ActionFunctionArgs) {
  const form = await request.formData();
  const notificationId = form.get('notificationId');

  if (typeof notificationId !== 'string' || !notificationId.trim().length) {
    return json({ok: false, error: 'Missing notificationId.'}, {status: 400});
  }

  const result = await markCustomerNotificationRead(context, notificationId);
  return json(result);
}

