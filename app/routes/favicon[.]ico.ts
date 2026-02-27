import type {LoaderFunctionArgs} from '@shopify/remix-oxygen';

const CLOUDFLARE_FAVICON_URL =
  'https://downloads.adamunderwater.com/store-1-au/public/favicon-48.png';

export async function loader({request}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const responseUrl = new URL(CLOUDFLARE_FAVICON_URL);
  responseUrl.search = url.search;

  return Response.redirect(responseUrl.toString(), 302);
}

