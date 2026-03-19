import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';

export async function loader({context}: LoaderFunctionArgs) {
  const authorizeResponse = await context.customerAccount.authorize();

  // Check if we have a stored post-login redirect path
  const postLoginRedirect = context.session.get('postLoginRedirect');

  if (
    typeof postLoginRedirect === 'string' &&
    postLoginRedirect.startsWith('/') &&
    authorizeResponse.status >= 300 &&
    authorizeResponse.status < 400
  ) {
    // Clear the stored redirect so it doesn't persist
    context.session.unset('postLoginRedirect');
    const sessionCookie = await context.session.commit();

    const headers = new Headers();
    // Carry over any cookies from the authorize response (auth tokens, etc.)
    const authCookies = authorizeResponse.headers.getSetCookie?.() ?? [];
    for (const cookie of authCookies) {
      headers.append('Set-Cookie', cookie);
    }
    headers.append('Set-Cookie', sessionCookie);

    return redirect(postLoginRedirect, {headers});
  }

  return authorizeResponse;
}
