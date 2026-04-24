import {json, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {getCustomerDiscountUsage} from '~/lib/customerDiscountUsage.server';

export async function loader({request, context}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const rawCode = url.searchParams.get('code');
  const code = rawCode?.trim();

  if (!code) {
    return json({error: 'Missing code'}, {status: 400});
  }

  try {
    await context.customerAccount.handleAuthStatus();
    const loggedIn = await context.customerAccount.isLoggedIn();
    if (!loggedIn) {
      return json({error: 'Unauthorized'}, {status: 401});
    }
  } catch {
    return json({error: 'Unauthorized'}, {status: 401});
  }

  const usage = await getCustomerDiscountUsage({
    customerAccount: context.customerAccount,
    code,
  });
  if (!usage) {
    return json({error: 'Unable to determine discount usage'}, {status: 503});
  }

  return json(usage);
}

export async function action() {
  return new Response(null, {status: 405});
}
