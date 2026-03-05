export type AsideDebugPayload = {
  event: string;
  details?: Record<string, unknown>;
  route?: string;
  activeType?: string;
  source?: string;
  ts?: string;
};

const ASIDE_DEBUG_ENDPOINT = '/api/aside-debug';

function isAsideDebugEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    return import.meta.env.DEV || window.localStorage.getItem('au-debug-aside') === '1';
  } catch {
    return import.meta.env.DEV;
  }
}

export function emitAsideDebug(payload: AsideDebugPayload) {
  if (typeof window === 'undefined') return;
  if (!isAsideDebugEnabled()) return;

  const enrichedPayload: AsideDebugPayload = {
    ...payload,
    route: payload.route ?? window.location.pathname,
    ts: payload.ts ?? new Date().toISOString(),
  };

  console.warn(`[aside-debug] ${enrichedPayload.event}`, enrichedPayload);

  const body = JSON.stringify(enrichedPayload);

  try {
    if ('sendBeacon' in navigator) {
      const sent = navigator.sendBeacon(
        ASIDE_DEBUG_ENDPOINT,
        new Blob([body], {type: 'application/json'}),
      );
      if (sent) return;
    }
  } catch {
    // fall through to fetch
  }

  void fetch(ASIDE_DEBUG_ENDPOINT, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
    keepalive: true,
  }).catch(() => {
    // best-effort debug transport; ignore failures
  });
}
