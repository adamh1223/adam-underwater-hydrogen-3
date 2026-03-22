const PRINTS_HANDLE = 'prints';
const STOCK_HANDLE = 'stock';

export const PRINTS_PATH = '/prints';
export const STOCK_PATH = '/stock';

function normalizePathname(pathname: string): string {
  if (!pathname) return '/';
  const trimmed = pathname.trim();
  if (!trimmed) return '/';
  return trimmed.replace(/\/+$/, '') || '/';
}

function normalizeHandle(handle: string | null | undefined): string {
  return (handle ?? '').trim().toLowerCase();
}

export function getCollectionPathByHandle(
  handle: string | null | undefined,
): string {
  const normalizedHandle = normalizeHandle(handle);

  if (!normalizedHandle) return '/collections';
  if (normalizedHandle === PRINTS_HANDLE) return PRINTS_PATH;
  if (normalizedHandle === STOCK_HANDLE) return STOCK_PATH;

  return `/collections/${normalizedHandle}`;
}

export function isPrintsCollectionPath(pathname: string): boolean {
  const normalizedPathname = normalizePathname(pathname).toLowerCase();
  return (
    normalizedPathname === PRINTS_PATH ||
    normalizedPathname.startsWith(`${PRINTS_PATH}/`) ||
    normalizedPathname === '/collections/prints' ||
    normalizedPathname.startsWith('/collections/prints/')
  );
}

export function isStockCollectionPath(pathname: string): boolean {
  const normalizedPathname = normalizePathname(pathname).toLowerCase();
  return (
    normalizedPathname === STOCK_PATH ||
    normalizedPathname.startsWith(`${STOCK_PATH}/`) ||
    normalizedPathname === '/collections/stock' ||
    normalizedPathname.startsWith('/collections/stock/')
  );
}

export function getHandleFromCollectionPath(
  pathname: string,
): string | undefined {
  if (isPrintsCollectionPath(pathname)) return PRINTS_HANDLE;
  if (isStockCollectionPath(pathname)) return STOCK_HANDLE;
  return undefined;
}

export function getRedirectPathFromLegacyCollectionPath(
  pathname: string,
): string | null {
  const normalizedPathname = normalizePathname(pathname).toLowerCase();
  if (
    normalizedPathname === '/collections/prints' ||
    normalizedPathname.startsWith('/collections/prints/')
  ) {
    return PRINTS_PATH;
  }
  if (
    normalizedPathname === '/collections/stock' ||
    normalizedPathname.startsWith('/collections/stock/')
  ) {
    return STOCK_PATH;
  }
  return null;
}
