import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';

type AsideDebugPayload = {
  event?: unknown;
  details?: unknown;
  route?: unknown;
  activeType?: unknown;
  source?: unknown;
  ts?: unknown;
};

const MOBILE_USER_AGENT_REGEX =
  /android|iphone|ipad|ipod|mobile|windows phone|webos|blackberry/i;

const KNOWN_SAFE_MOBILE_CART_OPEN_SOURCES = new Set([
  'header-cart-click',
  'header-cart-hover',
  'product-form-add-to-cart',
  'eproducts-grid-add-to-cart-primary',
  'eproducts-grid-add-to-cart-compact',
  'eproducts-list-add-to-cart-compact',
  'eproducts-list-add-to-cart-expanded',
]);

function normalizePayload(payload: AsideDebugPayload) {
  const detailsObject =
    payload.details && typeof payload.details === 'object'
      ? payload.details
      : {};
  const detailsSource =
    typeof (detailsObject as Record<string, unknown>)?.source === 'string'
      ? ((detailsObject as Record<string, unknown>).source as string)
      : '';

  return {
    event: typeof payload.event === 'string' ? payload.event : 'unknown',
    details: detailsObject,
    route: typeof payload.route === 'string' ? payload.route : '',
    activeType: typeof payload.activeType === 'string' ? payload.activeType : '',
    source:
      typeof payload.source === 'string' && payload.source.trim().length
        ? payload.source
        : detailsSource,
    ts:
      typeof payload.ts === 'string' && payload.ts.trim().length
        ? payload.ts
        : new Date().toISOString(),
  };
}

function isLikelyMobileUserAgent(userAgent: string) {
  return MOBILE_USER_AGENT_REGEX.test(userAgent);
}

function getUrgency({
  payload,
  userAgent,
}: {
  payload: ReturnType<typeof normalizePayload>;
  userAgent: string;
}) {
  const isMobile = isLikelyMobileUserAgent(userAgent);
  if (!isMobile) return 'none' as const;

  const details = payload.details as Record<string, unknown>;
  const isCartOpenEvent = payload.event === 'open' && details?.mode === 'cart';
  if (!isCartOpenEvent) return 'none' as const;

  const source = payload.source ?? '';
  if (KNOWN_SAFE_MOBILE_CART_OPEN_SOURCES.has(source)) {
    return 'none' as const;
  }

  return 'FLAGGED' as const;
}

export async function action({request}: ActionFunctionArgs) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    let incoming: AsideDebugPayload = {};

    if (contentType.includes('application/json')) {
      incoming = (await request.json()) as AsideDebugPayload;
    } else {
      const raw = await request.text();
      if (raw.trim().length) {
        incoming = JSON.parse(raw) as AsideDebugPayload;
      }
    }

    const payload = normalizePayload(incoming);
    const userAgent = request.headers.get('user-agent') ?? '';
    const Urgency = getUrgency({
      payload,
      userAgent,
    });

    console.warn('[aside-debug:server]', {
      ...payload,
      Urgency,
      userAgent,
      referer: request.headers.get('referer') ?? '',
    });

    return json({ok: true});
  } catch (error) {
    console.error('[aside-debug:server] ingestion failed', error);
    // keep this best-effort and non-failing for client flows
    return json({ok: false});
  }
}

export async function loader() {
  return new Response(null, {status: 405});
}
