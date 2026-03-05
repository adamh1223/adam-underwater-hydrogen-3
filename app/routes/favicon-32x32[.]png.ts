import type {LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {proxyCloudflareAsset} from '~/lib/cloudflareAssetProxy';

const FAVICON_32_URL =
  'https://downloads.adamunderwater.com/store-1-au/public/favicon-48.png';

export async function loader({request}: LoaderFunctionArgs) {
  return proxyCloudflareAsset(request, FAVICON_32_URL, 'image/png');
}
