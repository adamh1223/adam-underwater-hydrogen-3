import {
  servicesImages1,
  servicesImages2,
  servicesImages11,
  servicesImages12,
  servicesImages13,
  servicesImages21,
  servicesImages22,
  servicesImages23,
} from '~/utils/constants';

type CorePageAsset =
  | {
      kind: 'image';
      src: string;
    }
  | {
      kind: 'iframe';
      src: string;
    };

const HERO_BACKGROUND_IFRAME_SRC =
  'https://player.vimeo.com/video/1018553050?autoplay=1&loop=1&muted=1&background=1';
const WORK_IFRAME_SRCS = [
  'https://player.vimeo.com/video/814128392?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479',
  'https://player.vimeo.com/video/795362432?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479',
] as const;

const SERVICES_PHOTO_IMAGES = Array.from(
  new Set([
    ...servicesImages1,
    ...servicesImages2,
    ...servicesImages11,
    ...servicesImages12,
    ...servicesImages13,
    ...servicesImages21,
    ...servicesImages22,
    ...servicesImages23,
  ]),
);

function imageAsset(src: string): CorePageAsset {
  return {kind: 'image', src};
}

function iframeAsset(src: string): CorePageAsset {
  return {kind: 'iframe', src};
}

const CORE_PAGE_CRITICAL_ASSETS = {
  '/': [
    imageAsset('https://downloads.adamunderwater.com/store-1-au/public/vp3.png'),
    imageAsset('https://downloads.adamunderwater.com/store-1-au/public/print1.jpg'),
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/featured6.png',
    ),
    iframeAsset(HERO_BACKGROUND_IFRAME_SRC),
  ],
  '/pages/work': [
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/icon.png',
    ),
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/work.png',
    ),
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/featured6.png',
    ),
    ...WORK_IFRAME_SRCS.map((src) => iframeAsset(src)),
  ],
  '/pages/about': [
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/icon.png',
    ),
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/about.png',
    ),
    imageAsset('https://downloads.adamunderwater.com/store-1-au/public/headshot3.png'),
  ],
  '/pages/services': [
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/icon.png',
    ),
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/services.png',
    ),
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/featured6.png',
    ),
    imageAsset('https://downloads.adamunderwater.com/store-1-au/public/print3.jpg'),
    imageAsset('https://downloads.adamunderwater.com/store-1-au/public/dji-inspire-3.jpg'),
    imageAsset('https://downloads.adamunderwater.com/store-1-au/public/fpv-red.jpg'),
    imageAsset('https://downloads.adamunderwater.com/store-1-au/public/services-drone.JPG'),
    ...SERVICES_PHOTO_IMAGES.map((src) => imageAsset(src)),
    iframeAsset(HERO_BACKGROUND_IFRAME_SRC),
  ],
  '/prints': [
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/icon.png',
    ),
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/prints.png',
    ),
    imageAsset('https://downloads.adamunderwater.com/store-1-au/public/print1.jpg'),
    iframeAsset(HERO_BACKGROUND_IFRAME_SRC),
  ],
  '/stock': [
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/icon.png',
    ),
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/stock.png',
    ),
  ],
  '/pages/contact': [
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/icon.png',
    ),
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/contact.png',
    ),
    imageAsset(
      'https://downloads.adamunderwater.com/store-1-au/public/featured6.png',
    ),
  ],
} as const;

export const CORE_PAGE_PREFETCH_PATHS = [
  '/',
  '/pages/work',
  '/pages/about',
  '/pages/services',
  '/prints',
  '/stock',
  '/pages/contact',
] as const;

type CorePagePath = keyof typeof CORE_PAGE_CRITICAL_ASSETS;

let hasCompletedInitialDocumentSkeleton = false;

const warmedCorePages = new Set<CorePagePath>();
const assetWarmPromises = new Map<string, Promise<void>>();
const pageWarmPromises = new Map<CorePagePath, Promise<void>>();
let iframePreloadRoot: HTMLDivElement | null = null;

function trimTrailingSlash(pathname: string) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

export function normalizeCorePagePath(pathname: string): CorePagePath | null {
  const normalizedPath = trimTrailingSlash(pathname);

  if (normalizedPath === '/') return '/';
  if (normalizedPath === '/pages/work') return '/pages/work';
  if (normalizedPath === '/pages/about') return '/pages/about';
  if (normalizedPath === '/pages/services') return '/pages/services';
  if (normalizedPath === '/pages/contact') return '/pages/contact';
  if (
    normalizedPath === '/prints' ||
    normalizedPath.startsWith('/prints/') ||
    normalizedPath === '/collections/prints' ||
    normalizedPath.startsWith('/collections/prints/')
  ) {
    return '/prints';
  }
  if (
    normalizedPath === '/stock' ||
    normalizedPath.startsWith('/stock/') ||
    normalizedPath === '/collections/stock' ||
    normalizedPath.startsWith('/collections/stock/')
  ) {
    return '/stock';
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

function getAssetCacheKey(asset: CorePageAsset) {
  return `${asset.kind}:${asset.src}`;
}

function preloadImageAsset(src: string): Promise<void> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve();
  }

  const existingPromise = assetWarmPromises.get(getAssetCacheKey({kind: 'image', src}));
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

  assetWarmPromises.set(getAssetCacheKey({kind: 'image', src}), preloadPromise);
  return preloadPromise;
}

function getIframePreloadRoot() {
  if (typeof document === 'undefined') return null;
  if (iframePreloadRoot) return iframePreloadRoot;

  const root = document.createElement('div');
  root.setAttribute('aria-hidden', 'true');
  root.style.position = 'fixed';
  root.style.left = '-9999px';
  root.style.top = '-9999px';
  root.style.width = '1px';
  root.style.height = '1px';
  root.style.overflow = 'hidden';
  root.style.pointerEvents = 'none';
  root.style.opacity = '0';
  root.style.zIndex = '-1';
  document.body.appendChild(root);
  iframePreloadRoot = root;

  return iframePreloadRoot;
}

function preloadIframeAsset(src: string): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }

  const existingPromise = assetWarmPromises.get(getAssetCacheKey({kind: 'iframe', src}));
  if (existingPromise) return existingPromise;

  const preloadPromise = new Promise<void>((resolve) => {
    const root = getIframePreloadRoot();
    if (!root) {
      resolve();
      return;
    }

    const iframe = document.createElement('iframe');
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    iframe.src = src;
    iframe.tabIndex = -1;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('loading', 'eager');
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = '0';
    iframe.style.pointerEvents = 'none';
    iframe.addEventListener('load', finish, {once: true});
    iframe.addEventListener('error', finish, {once: true});
    root.appendChild(iframe);
  });

  assetWarmPromises.set(getAssetCacheKey({kind: 'iframe', src}), preloadPromise);
  return preloadPromise;
}

function preloadCorePageAsset(asset: CorePageAsset) {
  if (asset.kind === 'iframe') {
    return preloadIframeAsset(asset.src);
  }

  return preloadImageAsset(asset.src);
}

export function warmCorePageAssets(pathname: string): Promise<void> {
  const normalizedPath = normalizeCorePagePath(pathname);
  if (!normalizedPath) return Promise.resolve();

  const existingPromise = pageWarmPromises.get(normalizedPath);
  if (existingPromise) return existingPromise;

  const warmPromise = Promise.all(
    CORE_PAGE_CRITICAL_ASSETS[normalizedPath].map((asset) =>
      preloadCorePageAsset(asset),
    ),
  ).then(() => {
    warmedCorePages.add(normalizedPath);
  });

  pageWarmPromises.set(normalizedPath, warmPromise);
  return warmPromise;
}
