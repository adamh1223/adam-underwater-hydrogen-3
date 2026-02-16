const DOWNLOAD_TAG_PREFIXES = ['r2:', 'r2key:', 'r2-key:', 'r2/'] as const;
const LEGACY_DOWNLOAD_TAG_PREFIXES = ['umclips/'] as const;

type VariantSelectionOption = {
  name?: unknown;
  value?: unknown;
};

type VariantSelectionInput = {
  selectedOptions?: VariantSelectionOption[] | null;
  variantTitle?: unknown;
};

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

function parseResolutionValue(value: string): number | null {
  const match = value.match(/(\d+)\s*k/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function getResolutionFromObjectKey(objectKey: string): number | null {
  const filename = objectKey.split('/').pop() ?? '';
  const segments = filename.split('__').map((segment) => segment.trim());

  // Supports filenames like:
  // - 5K__penguins.mov
  // - 22UM__5K__penguins.mov (resolution in second prefix)
  for (const segment of segments) {
    const parsed = parseResolutionValue(segment);
    if (parsed !== null) return parsed;
  }

  return null;
}

function getResolutionFromVariantSelection(
  selection: VariantSelectionInput | null | undefined,
): number | null {
  const selectedOptions = Array.isArray(selection?.selectedOptions)
    ? selection.selectedOptions
    : [];

  for (const selectedOption of selectedOptions) {
    const rawName = typeof selectedOption?.name === 'string' ? selectedOption.name : '';
    if (rawName.trim().toLowerCase() !== 'resolution') continue;

    const rawValue =
      typeof selectedOption?.value === 'string' ? selectedOption.value : '';
    const parsed = parseResolutionValue(rawValue);
    if (parsed !== null) return parsed;
  }

  const variantTitle =
    typeof selection?.variantTitle === 'string' ? selection.variantTitle : '';
  return parseResolutionValue(variantTitle);
}

function collectR2ObjectKeysFromTags(tags: unknown[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const pushKey = (candidate: string | null) => {
    if (!candidate || seen.has(candidate)) return;
    seen.add(candidate);
    keys.push(candidate);
  };

  for (const rawTag of tags) {
    const tag = normalizeTag(rawTag);
    if (!tag) continue;
    const lowerTag = tag.toLowerCase();

    let matched = false;
    for (const prefix of DOWNLOAD_TAG_PREFIXES) {
      if (!lowerTag.startsWith(prefix)) continue;
      const key = stripPrefix(tag, prefix);
      pushKey(normalizeObjectKey(key));
      matched = true;
      break;
    }
    if (matched) continue;

    for (const prefix of LEGACY_DOWNLOAD_TAG_PREFIXES) {
      if (!lowerTag.startsWith(prefix)) continue;
      pushKey(normalizeObjectKey(tag));
      matched = true;
      break;
    }
    if (matched) continue;

    if (lowerTag.startsWith('r2://')) {
      const pathAfterProtocol = stripPrefix(tag, 'r2://');
      const firstSlash = pathAfterProtocol.indexOf('/');
      if (firstSlash > 0) {
        const key = pathAfterProtocol.slice(firstSlash + 1).trim();
        pushKey(normalizeObjectKey(key));
      }
      continue;
    }

    if (lowerTag.startsWith('https://') || lowerTag.startsWith('http://')) {
      const keyFromUrl = extractSharedObjectKeyFromHttpUrl(tag);
      pushKey(keyFromUrl);
    }
  }

  return keys;
}

export function getR2ObjectKeyFromTags(tags: unknown[]): string | null {
  return collectR2ObjectKeysFromTags(tags)[0] ?? null;
}

export function getR2ObjectKeyFromTagsForVariant({
  tags,
  selectedOptions,
  variantTitle,
}: {
  tags: unknown[];
  selectedOptions?: VariantSelectionOption[] | null;
  variantTitle?: unknown;
}): string | null {
  const objectKeys = collectR2ObjectKeysFromTags(tags);
  if (!objectKeys.length) return null;

  const desiredResolution = getResolutionFromVariantSelection({
    selectedOptions,
    variantTitle,
  });

  if (desiredResolution !== null) {
    const matchingObjectKey = objectKeys.find(
      (objectKey) => getResolutionFromObjectKey(objectKey) === desiredResolution,
    );
    if (matchingObjectKey) return matchingObjectKey;
  }

  return objectKeys[0] ?? null;
}

export function getHighestResolutionLabelFromTags(tags: unknown[]): string | null {
  const objectKeys = collectR2ObjectKeysFromTags(tags);
  const resolutions = objectKeys
    .map((objectKey) => getResolutionFromObjectKey(objectKey))
    .filter((value): value is number => value !== null);

  if (!resolutions.length) return null;
  const maxResolution = Math.max(...resolutions);
  return `${maxResolution}K`;
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
