import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {verifyEmailDownloadToken} from '~/lib/email-download-token.server';
import {createR2SignedDownloadUrl, R2ObjectNotFoundError} from '~/lib/r2.server';
import {adminGraphql} from '~/lib/shopify-admin.server';

const BUNDLE_ORDER_QUERY = `
  query BundleOrderDownload($id: ID!) {
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

export async function loader({context, params}: LoaderFunctionArgs) {
  const token = params.token;
  if (!token) return new Response('Not found', {status: 404});

  const verified = await verifyEmailDownloadToken({env: context.env, token});
  // vn present = single-clip token; reject those here
  if (!verified || verified.vn) return new Response('Not found', {status: 404});

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
  }>({env: context.env, query: BUNDLE_ORDER_QUERY, variables: {id: verified.orderId}});

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

  if (!clips.length) return new Response('No clips found', {status: 404});

  // Fetch real product titles
  const tagQuery = clips.map((c) => `tag:v${c.vNumber}`).join(' OR ');
  const titlesRes = await adminGraphql<{
    data?: {products?: {nodes?: Array<{title?: string | null; tags?: string[] | null}>} | null};
  }>({
    env: context.env,
    query: `query T($q: String!) { products(first: 50, query: $q) { nodes { title tags } } }`,
    variables: {q: tagQuery},
  }).catch(() => null);

  const titleMap = new Map<string, string>();
  for (const product of titlesRes?.data?.products?.nodes ?? []) {
    if (!product.title) continue;
    for (const tag of product.tags ?? []) {
      const m = tag.match(/^v(\d+)$/i);
      if (m) {
        titleMap.set(m[1], product.title);
        break;
      }
    }
  }

  // Generate presigned URLs for every clip
  const downloads: Array<{name: string; url: string}> = [];
  for (const {vNumber, position} of clips) {
    const candidates = buildStockKeyCandidates(vNumber, is4K);
    if (!candidates.length) continue;
    try {
      const url = await createR2SignedDownloadUrl(context.env, {
        objectKeyCandidates: candidates,
        downloadFilename: candidates[0]?.split('/').pop(),
        expiresInSeconds: 900,
      });
      downloads.push({name: titleMap.get(vNumber) ?? `Clip ${position}`, url});
    } catch (err) {
      if (!(err instanceof R2ObjectNotFoundError)) throw err;
    }
  }

  if (!downloads.length) return new Response('No downloadable files found', {status: 404});

  const downloadsJson = JSON.stringify(downloads);
  const total = downloads.length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Starting downloads…</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#020b1f;color:#fff;font-family:system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
    h1{font-size:1.6rem;margin-bottom:.75rem}
    .sub{color:#9cb3d2;font-size:1rem;margin-bottom:1.5rem}
    .status{font-size:1rem;color:#22b8ff;min-height:1.5em}
    .bar-wrap{width:100%;max-width:380px;height:6px;background:#0d2046;border-radius:3px;margin:1rem auto 0}
    .bar{height:6px;border-radius:3px;background:#22b8ff;width:0%;transition:width .4s}
  </style>
</head>
<body>
  <div>
    <h1>Starting Downloads</h1>
    <p class="sub">Your ${total} clips are downloading.<br>Keep this page open until all downloads have started.</p>
    <p class="status" id="status">Preparing&hellip;</p>
    <div class="bar-wrap"><div class="bar" id="bar"></div></div>
  </div>
  <script>
    var items = ${downloadsJson};
    var i = 0;
    function next() {
      if (i >= items.length) {
        document.getElementById('status').textContent = 'All ${total} downloads started!';
        document.getElementById('bar').style.width = '100%';
        return;
      }
      document.getElementById('status').textContent = 'Downloading ' + (i + 1) + ' of ${total}: ' + items[i].name;
      document.getElementById('bar').style.width = Math.round(((i + 1) / ${total}) * 100) + '%';
      var a = document.createElement('a');
      a.href = items[i].url;
      a.style.cssText = 'position:absolute;left:-9999px;visibility:hidden;';
      document.body.appendChild(a);
      a.click();
      setTimeout(function(){a.remove();},2000);
      i++;
      setTimeout(next, 1500);
    }
    setTimeout(next, 600);
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, private',
    },
  });
}

export async function action() {
  return new Response(null, {status: 405});
}
