import type {LoaderFunctionArgs} from '@shopify/remix-oxygen';

const DEFAULT_R2_PUBLIC_BASE_URL = 'https://downloads.adamunderwater.com';
const PUBLIC_ASSET_PREFIX = 'store-1-au/public';
const ROOT_ASSET_REQUEST_PATTERN =
  /^\/[^/]+\.(?:png|jpe?g|svg|webp|gif|ico)$/i;

function getR2PublicBaseUrl(env: Env | undefined) {
  const candidate =
    env?.R2_PUBLIC_BASE_URL?.trim() || DEFAULT_R2_PUBLIC_BASE_URL;
  return candidate.replace(/\/+$/, '');
}

function buildCloudflarePublicAssetUrl(pathname: string, env: Env | undefined) {
  const sanitizedPath = pathname.replace(/^\/+/, '');
  const base = getR2PublicBaseUrl(env);
  return `${base}/${PUBLIC_ASSET_PREFIX}/${sanitizedPath}`;
}

export async function loader({request, context}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (ROOT_ASSET_REQUEST_PATTERN.test(pathname)) {
    return Response.redirect(
      buildCloudflarePublicAssetUrl(
        pathname,
        (context as {env?: Env} | undefined)?.env,
      ),
      302,
    );
  }

  throw new Response(`${pathname} not found`, {
    status: 404,
  });
}

export default function CatchAllPage() {
  return null;
}
