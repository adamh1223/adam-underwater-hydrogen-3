const CORE_PAGE_CRITICAL_ASSETS = {
  '/': [
    'https://downloads.adamunderwater.com/store-1-au/public/vp3.png',
    'https://downloads.adamunderwater.com/store-1-au/public/print1.jpg',
    'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/featured6.png',
  ],
  '/pages/work': [
    'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/icon.png',
    'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/work.png',
    'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/featured6.png',
  ],
  '/pages/about': [
    'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/icon.png',
    'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/about.png',
    'https://downloads.adamunderwater.com/store-1-au/public/headshot3.png',
  ],
  '/collections/prints': [
    'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/icon.png',
    'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/prints.png',
  ],
  '/collections/stock': [
    'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/icon.png',
    'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/stock.png',
  ],
  '/pages/contact': [
    'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/icon.png',
    'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/headers/contact.png',
    'https://fpoxvfuxgtlyphowqdgf.supabase.co/storage/v1/object/public/main-bucket/featured6.png',
  ],
} as const;

export const CORE_PAGE_PREFETCH_PATHS = [
  '/',
  '/pages/work',
  '/pages/about',
  '/collections/prints',
  '/collections/stock',
  '/collections/stock/Video+Bundle',
  '/pages/contact',
] as const;

type CorePagePath = keyof typeof CORE_PAGE_CRITICAL_ASSETS;

let hasCompletedInitialDocumentSkeleton = false;

const warmedCorePages = new Set<CorePagePath>();
const assetWarmPromises = new Map<string, Promise<void>>();
const pageWarmPromises = new Map<CorePagePath, Promise<void>>();

function trimTrailingSlash(pathname: string) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

export function normalizeCorePagePath(pathname: string): CorePagePath | null {
  const normalizedPath = trimTrailingSlash(pathname);

  if (normalizedPath === '/') return '/';
  if (normalizedPath === '/pages/work') return '/pages/work';
  if (normalizedPath === '/pages/about') return '/pages/about';
  if (normalizedPath === '/pages/contact') return '/pages/contact';
  if (
    normalizedPath === '/collections/prints' ||
    normalizedPath.startsWith('/collections/prints/')
  ) {
    return '/collections/prints';
  }
  if (
    normalizedPath === '/collections/stock' ||
    normalizedPath.startsWith('/collections/stock/')
  ) {
    return '/collections/stock';
  }

  return null;
}

export function hasCompletedDocumentEntranceSkeleton() {
  return hasCompletedInitialDocumentSkeleton;
}

export function markDocumentEntranceReady() {
  hasCompletedInitialDocumentSkeleton = true;
}

export function markCorePageWarm(pathname: string) {
  const normalizedPath = normalizeCorePagePath(pathname);
  if (!normalizedPath) return;
  warmedCorePages.add(normalizedPath);
}

export function isCorePageWarm(pathname: string) {
  const normalizedPath = normalizeCorePagePath(pathname);
  if (!normalizedPath) return false;
  return warmedCorePages.has(normalizedPath);
}

export function getCorePagePrefetchPaths(currentPathname: string) {
  const currentCorePath = normalizeCorePagePath(currentPathname);

  return CORE_PAGE_PREFETCH_PATHS.filter((path) => {
    return normalizeCorePagePath(path) !== currentCorePath;
  });
}

function preloadImageAsset(src: string): Promise<void> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve();
  }

  const existingPromise = assetWarmPromises.get(src);
  if (existingPromise) return existingPromise;

  const preloadPromise = new Promise<void>((resolve) => {
    const image = new Image();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
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
    image.src = src;

    if (image.complete) {
      if (typeof image.decode === 'function') {
        void image.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    }
  });

  assetWarmPromises.set(src, preloadPromise);
  return preloadPromise;
}

export function warmCorePageAssets(pathname: string): Promise<void> {
  const normalizedPath = normalizeCorePagePath(pathname);
  if (!normalizedPath) return Promise.resolve();

  const existingPromise = pageWarmPromises.get(normalizedPath);
  if (existingPromise) return existingPromise;

  const warmPromise = Promise.all(
    CORE_PAGE_CRITICAL_ASSETS[normalizedPath].map((src) =>
      preloadImageAsset(src),
    ),
  ).then(() => {
    warmedCorePages.add(normalizedPath);
  });

  pageWarmPromises.set(normalizedPath, warmPromise);
  return warmPromise;
}
