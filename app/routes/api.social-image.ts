import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const OG_IMAGE_PADDING = 42;
const OG_IMAGE_RADIUS = 28;
const SHARE_BACKGROUND_COLOR = 'hsl(222.2 84% 4.9%)';
const DEFAULT_SHARE_IMAGE =
  'https://downloads.adamunderwater.com/store-1-au/public/imessage-icon.png';
const ALLOWED_IMAGE_HOSTS = new Set([
  'cdn.shopify.com',
  'downloads.adamunderwater.com',
]);

function normalizeImageUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const isAllowedHost =
      ALLOWED_IMAGE_HOSTS.has(url.hostname) ||
      url.hostname.endsWith('.myshopify.com');

    if (url.protocol !== 'https:' || !isAllowedHost) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function buildRoundedRectPath(
  context: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

async function loadImageBitmap(sourceUrl: string): Promise<ImageBitmap | null> {
  try {
    const response = await fetch(sourceUrl, {
      headers: {Accept: 'image/*'},
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return null;

    const blob = await response.blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

function drawContainedImage({
  context,
  bitmap,
  width,
  height,
}: {
  context: OffscreenCanvasRenderingContext2D;
  bitmap: ImageBitmap;
  width: number;
  height: number;
}) {
  const availableWidth = width - OG_IMAGE_PADDING * 2;
  const availableHeight = height - OG_IMAGE_PADDING * 2;
  const scale = Math.min(
    availableWidth / bitmap.width,
    availableHeight / bitmap.height,
  );
  const renderedWidth = bitmap.width * scale;
  const renderedHeight = bitmap.height * scale;
  const x = (width - renderedWidth) / 2;
  const y = (height - renderedHeight) / 2;

  context.save();
  buildRoundedRectPath(
    context,
    x,
    y,
    renderedWidth,
    renderedHeight,
    OG_IMAGE_RADIUS,
  );
  context.clip();
  context.drawImage(bitmap, x, y, renderedWidth, renderedHeight);
  context.restore();
}

export async function loader({request}: LoaderFunctionArgs) {
  const requestUrl = new URL(request.url);
  const requestedSource = normalizeImageUrl(requestUrl.searchParams.get('src'));
  const bitmap =
    (requestedSource && (await loadImageBitmap(requestedSource))) ||
    (await loadImageBitmap(DEFAULT_SHARE_IMAGE));

  if (!bitmap) {
    throw new Response('Unable to generate social image', {status: 500});
  }

  const canvas = new OffscreenCanvas(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT);
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Response('Unable to initialize canvas', {status: 500});
  }

  context.fillStyle = SHARE_BACKGROUND_COLOR;
  context.fillRect(0, 0, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT);
  drawContainedImage({
    context,
    bitmap,
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
  });

  const output = await canvas.convertToBlob({type: 'image/png'});

  return new Response(await output.arrayBuffer(), {
    headers: {
      'cache-control': 'public, max-age=3600, s-maxage=86400',
      'content-type': 'image/png',
    },
  });
}
