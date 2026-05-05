import type {EntryContext, AppLoadContext} from '@shopify/remix-oxygen';
import {RemixServer} from '@remix-run/react';
import {isbot} from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {createContentSecurityPolicy} from '@shopify/hydrogen';

function toOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  context: AppLoadContext,
) {
  const r2PublicOrigin =
    toOrigin(context.env.R2_PUBLIC_BASE_URL) ??
    'https://downloads.adamunderwater.com';

  const additionalMediaOrigins = [r2PublicOrigin, 'https://i.vimeocdn.com'];

  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    shop: {
      checkoutDomain: context.env.PUBLIC_CHECKOUT_DOMAIN,
      storeDomain: context.env.PUBLIC_STORE_DOMAIN,
    },
    mediaSrc: [
      "'self'",
      'blob:',
      'data:',
      ...additionalMediaOrigins,
    ],
    connectSrc: [
      "'self'",
      'wss://patient-mite-notably.ngrok-free.app:3000',
      'https://cdn.shopify.com',
      r2PublicOrigin,
      'https://nominatim.openstreetmap.org',
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://cdn.shopify.com',
      'http://localhost:*',
      'https://fonts.googleapis.com',
    ],
    imgSrc: [
      "'self'",
      'data:',
      'blob:',
      'https://cdn.shopify.com',
      'https://img.youtube.com',
      ...additionalMediaOrigins,
    ],
    fontSrc: [
      "'self'",
      'data:',
      'https://cdn.shopify.com',
      'https://fonts.gstatic.com',
    ],
    frameSrc: [
      'https://player.vimeo.com/',
      'https://vimeo.com/',
      'https://www.youtube.com/',
      'https://www.youtube-nocookie.com/',
    ],
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <RemixServer context={remixContext} url={request.url} nonce={nonce} />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);
  // Allow Oxygen's CDN to cache successful HTML responses for 60 s at the edge
  // while always revalidating in the browser. This dramatically reduces TTFB on
  // repeat visits without serving stale personalised content.
  if (responseStatusCode === 200) {
    responseHeaders.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=30');
  }

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
