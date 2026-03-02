const warmedImageUrls = new Set<string>();
const imageWarmPromises = new Map<string, Promise<void>>();
const DEFAULT_MAX_CONCURRENT_WARMS = 2;

export function getOptimizedImageUrl(url: string, width: number) {
  if (!url || !Number.isFinite(width) || width <= 0) return url;

  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes('shopify.com')) {
      return url;
    }

    parsedUrl.searchParams.set('width', String(Math.round(width)));
    return parsedUrl.toString();
  } catch {
    return url;
  }
}

export function hasWarmedImageUrl(url: string) {
  return warmedImageUrls.has(url);
}

export function markWarmedImageUrl(url: string) {
  if (!url) return;
  warmedImageUrls.add(url);
}

export function warmImageUrl(url: string): Promise<void> {
  if (!url) return Promise.resolve();
  if (warmedImageUrls.has(url)) return Promise.resolve();

  const existingPromise = imageWarmPromises.get(url);
  if (existingPromise) return existingPromise;

  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    warmedImageUrls.add(url);
    return Promise.resolve();
  }

  const warmPromise = new Promise<void>((resolve) => {
    const image = new Image();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      warmedImageUrls.add(url);
      resolve();
    };

    image.onload = () => {
      if (typeof image.decode === 'function') {
        void image.decode().then(finish).catch(finish);
        return;
      }
      finish();
    };
    image.onerror = finish;
    image.decoding = 'async';
    image.src = url;

    if (image.complete) {
      if (typeof image.decode === 'function') {
        void image.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    }
  });

  imageWarmPromises.set(url, warmPromise);
  return warmPromise;
}

export function warmImageUrls(
  urls: string[],
  options?: {maxConcurrent?: number},
) {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  const maxConcurrent = Math.max(
    1,
    Math.floor(options?.maxConcurrent ?? DEFAULT_MAX_CONCURRENT_WARMS),
  );

  let currentIndex = 0;

  async function warmNextBatch(): Promise<void> {
    if (currentIndex >= uniqueUrls.length) return;

    const batch = uniqueUrls.slice(currentIndex, currentIndex + maxConcurrent);
    currentIndex += maxConcurrent;

    await Promise.all(batch.map((url) => warmImageUrl(url)));
    await warmNextBatch();
  }

  return warmNextBatch();
}
