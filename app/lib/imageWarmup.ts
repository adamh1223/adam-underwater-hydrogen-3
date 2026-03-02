const warmedImageUrls = new Set<string>();
const imageWarmPromises = new Map<string, Promise<void>>();

export function hasWarmedImageUrl(url: string) {
  return warmedImageUrls.has(url);
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

export function warmImageUrls(urls: string[]) {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  return Promise.all(uniqueUrls.map((url) => warmImageUrl(url))).then(
    () => undefined,
  );
}
