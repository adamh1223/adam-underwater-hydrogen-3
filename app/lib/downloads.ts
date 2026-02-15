const DOWNLOAD_TAG_PREFIXES = ['r2:', 'r2key:', 'r2-key:', 'r2/'] as const;
const LEGACY_DOWNLOAD_TAG_PREFIXES = ['umclips/'] as const;

function normalizeTag(tag: unknown): string {
  return typeof tag === 'string' ? tag.trim() : '';
}

function stripPrefix(value: string, prefix: string): string {
  return value.slice(prefix.length).trim();
}

function normalizeObjectKey(value: string): string | null {
  const normalized = value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return normalized.length ? normalized : null;
}

function extractSharedObjectKeyFromHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const pathname = url.pathname;
    const sharedPrefix = '/shared/';
    const sharedIndex = pathname.toLowerCase().indexOf(sharedPrefix);
    if (sharedIndex === -1) return null;

    const key = pathname.slice(sharedIndex + 1);
    return normalizeObjectKey(key);
  } catch {
    return null;
  }
}

export function getR2ObjectKeyFromTags(tags: unknown[]): string | null {
  for (const rawTag of tags) {
    const tag = normalizeTag(rawTag);
    if (!tag) continue;
    const lowerTag = tag.toLowerCase();

    for (const prefix of DOWNLOAD_TAG_PREFIXES) {
      if (!lowerTag.startsWith(prefix)) continue;
      const key = stripPrefix(tag, prefix);
      return normalizeObjectKey(key);
    }

    for (const prefix of LEGACY_DOWNLOAD_TAG_PREFIXES) {
      if (lowerTag.startsWith(prefix)) {
        return normalizeObjectKey(tag);
      }
    }

    if (lowerTag.startsWith('r2://')) {
      const pathAfterProtocol = stripPrefix(tag, 'r2://');
      const firstSlash = pathAfterProtocol.indexOf('/');
      if (firstSlash > 0) {
        const key = pathAfterProtocol.slice(firstSlash + 1).trim();
        const normalizedKey = normalizeObjectKey(key);
        if (normalizedKey) return normalizedKey;
      }
    }

    if (lowerTag.startsWith('https://') || lowerTag.startsWith('http://')) {
      const keyFromUrl = extractSharedObjectKeyFromHttpUrl(tag);
      if (keyFromUrl) return keyFromUrl;
    }
  }

  return null;
}

export function getDownloadFilenameFromObjectKey(objectKey: string): string {
  const normalizedKey = objectKey.trim();
  const keyWithoutTrailingSlash = normalizedKey.replace(/\/+$/, '');
  const fallback = 'download';
  const lastSegment = keyWithoutTrailingSlash.split('/').pop() ?? fallback;
  return sanitizeDownloadFilename(lastSegment || fallback);
}

export function sanitizeDownloadFilename(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) return 'download';
  return trimmed.replace(/[\r\n"]/g, '_');
}
