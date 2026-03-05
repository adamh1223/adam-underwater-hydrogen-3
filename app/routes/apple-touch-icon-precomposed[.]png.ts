import type {LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {proxyCloudflareAsset} from '~/lib/cloudflareAssetProxy';

const APPLE_TOUCH_ICON_PRECOMPOSED_URL =
  'https://downloads.adamunderwater.com/store-1-au/public/apple-touch-icon.png';

export async function loader({request}: LoaderFunctionArgs) {
  return proxyCloudflareAsset(
    request,
    APPLE_TOUCH_ICON_PRECOMPOSED_URL,
    'image/png',
  );
}
