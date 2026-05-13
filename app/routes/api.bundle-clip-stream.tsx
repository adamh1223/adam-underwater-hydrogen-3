import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {verifyEmailDownloadToken} from '~/lib/email-download-token.server';
import {createR2SignedDownloadUrl, R2ObjectNotFoundError} from '~/lib/r2.server';
import {sanitizeDownloadFilename} from '~/lib/downloads';
import {adminGraphql} from '~/lib/shopify-admin.server';

const CLIP_ORDER_QUERY = `
  query BundleClipStream($id: ID!) {
    order(id: $id) {
      id
      lineItems(first: 100) {
        nodes {
          id
          variant {
            selectedOptions { name value }
            product { tags }
          }
        }
      }
    }
  }
` as const;

function buildStockKeyCandidates(vNumber: string, is4K: boolean): string[] {
  const num = Number.parseInt(vNumber, 10);
  if (!Number.isFinite(num) || num <= 0) return [];
  if (num >= 1 && num <= 93) {
    return is4K
      ? [`shared/stock/UM-8-4K-${num}.mov`, `shared/stock/UM-4K-${num}.mov`]
      : [`shared/stock/UM-8K-${num}.mov`, `shared/stock/UM-8-4K-${num}.mov`];
  }
  if (num >= 94 && num <= 157) {
    return is4K
      ? [`shared/stock/UM-5-4K-${num}.mov`, `shared/stock/UM-4K-${num}.mov`]
      : [`shared/stock/UM-5K-${num}.mov`, `shared/stock/UM-5-4K-${num}.mov`];
  }
  return [`shared/stock/UM-4K-${num}.mov`];
}

export async function loader({request, context}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const clipIndex = Number(url.searchParams.get('i') ?? '-1');
  // Optional display filename passed by the download-bundle page
  const displayName = url.searchParams.get('fn') ?? '';

  if (!token || !Number.isFinite(clipIndex) || clipIndex < 0) {
    return new Response('Bad request', {status: 400});
  }

  const verified = await verifyEmailDownloadToken({env: context.env, token});
  // vn present means single-clip token — reject; we only accept bundle-all tokens here
  if (!verified || verified.vn) return new Response('Invalid token', {status: 401});

  const orderRes = await adminGraphql<{
    data?: {
      order?: {
        id: string;
        lineItems?: {
          nodes?: Array<{
            id: string;
            variant?: {
              selectedOptions?: Array<{name?: string | null; value?: string | null}> | null;
              product?: {tags?: string[] | null} | null;
            } | null;
          }>;
        } | null;
      } | null;
    };
  }>({env: context.env, query: CLIP_ORDER_QUERY, variables: {id: verified.orderId}});

  const order = orderRes?.data?.order;
  if (!order) return new Response('Order not found', {status: 404});

  const lineItem = order.lineItems?.nodes?.find((n) => n.id === verified.lineItemId);
  if (!lineItem) return new Response('Line item not found', {status: 404});

  const tags = lineItem.variant?.product?.tags ?? [];
  if (!tags.includes('Bundle')) return new Response('Not a bundle', {status: 400});

  const resOption = lineItem.variant?.selectedOptions?.find(
    (o) => typeof o.name === 'string' && o.name.toLowerCase() === 'resolution',
  );
  const is4K = (resOption?.value ?? '8K').toUpperCase() === '4K';

  const clipTagRegex = /^clip(\d+)[-_](\d+)$/i;
  const clips = tags
    .map((t) => t.match(clipTagRegex))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({position: Number(m[1]), vNumber: m[2] ?? ''}))
    .filter((c) => c.vNumber)
    .sort((a, b) => a.position - b.position);

  const clip = clips[clipIndex];
  if (!clip) return new Response('Clip index out of range', {status: 404});

  const candidates = buildStockKeyCandidates(clip.vNumber, is4K);
  if (!candidates.length) return new Response('No file candidates', {status: 404});

  let signedUrl: string;
  try {
    signedUrl = await createR2SignedDownloadUrl(context.env, {
      objectKeyCandidates: candidates,
      downloadFilename: candidates[0]?.split('/').pop(),
      expiresInSeconds: 900,
    });
  } catch (err) {
    if (err instanceof R2ObjectNotFoundError) return new Response('File not found', {status: 404});
    throw err;
  }

  const upstream = await fetch(signedUrl);
  if (!upstream.ok || !upstream.body) return new Response('File unavailable', {status: 502});

  const filename = sanitizeDownloadFilename(
    displayName || candidates[0]?.split('/').pop() || 'download.mov',
  );
  const headers: Record<string, string> = {
    'Content-Type': upstream.headers.get('Content-Type') ?? 'video/quicktime',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store, private',
  };
  const cl = upstream.headers.get('Content-Length');
  if (cl) headers['Content-Length'] = cl;

  return new Response(upstream.body, {status: 200, headers});
}

export async function action() {
  return new Response(null, {status: 405});
}
