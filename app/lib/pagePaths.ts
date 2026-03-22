const PAGE_PATH_BY_HANDLE = {
  about: '/about',
  services: '/services',
  work: '/work',
  contact: '/contact',
  faq: '/faq',
} as const;

function normalizePathname(pathname: string): string {
  if (!pathname) return '/';
  const trimmed = pathname.trim();
  if (!trimmed) return '/';
  return trimmed.replace(/\/+$/, '') || '/';
}

function normalizeHandle(handle: string | null | undefined): string {
  return (handle ?? '').trim().toLowerCase();
}

export function getPagePathByHandle(handle: string | null | undefined): string {
  const normalizedHandle = normalizeHandle(handle);
  if (!normalizedHandle) return '/pages';

  const mappedPath =
    PAGE_PATH_BY_HANDLE[normalizedHandle as keyof typeof PAGE_PATH_BY_HANDLE];
  if (mappedPath) return mappedPath;

  return `/pages/${normalizedHandle}`;
}

export function getRedirectPathFromLegacyPagePath(
  pathname: string,
): string | null {
  const normalizedPathname = normalizePathname(pathname).toLowerCase();
  const match = normalizedPathname.match(/^\/pages\/([^/]+)$/);
  if (!match?.[1]) return null;

  const redirectPath = getPagePathByHandle(match[1]);
  return redirectPath === normalizedPathname ? null : redirectPath;
}

