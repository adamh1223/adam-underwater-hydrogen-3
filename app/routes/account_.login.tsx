import type {LoaderFunctionArgs} from '@shopify/remix-oxygen';

export async function loader({request, context}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirectTo');

  if (redirectTo) {
    context.session.set('postLoginRedirect', redirectTo);
  }

  const loginResponse = await context.customerAccount.login();

  // If we stored a redirect, we need to commit the session cookie alongside
  // the login redirect response so the value persists through the OAuth flow.
  if (redirectTo) {
    const sessionCookie = await context.session.commit();
    const headers = new Headers(loginResponse.headers);
    headers.append('Set-Cookie', sessionCookie);
    return new Response(loginResponse.body, {
      status: loginResponse.status,
      statusText: loginResponse.statusText,
      headers,
    });
  }

  return loginResponse;
}
