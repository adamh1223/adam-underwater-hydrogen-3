const VIDEO_IDENTIFIER_TAG_REGEXES = [/^v\d+$/i, /^vid[-_]?\d+$/i];

const VIDEO_TAG_REGEXES = [
  ...VIDEO_IDENTIFIER_TAG_REGEXES,
  /^bundle[-_]?\d+$/i,
  /^video$/i,
  /^eproduct$/i,
];

function toNormalizedTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function hasVideoTag(tags: unknown): boolean {
  return toNormalizedTags(tags).some((tag) =>
    VIDEO_TAG_REGEXES.some((regex) => regex.test(tag)),
  );
}

export function hasVideoIdentifierTag(tags: unknown): boolean {
  return toNormalizedTags(tags).some((tag) =>
    VIDEO_IDENTIFIER_TAG_REGEXES.some((regex) => regex.test(tag)),
  );
}

export function isPrintProductFromTags(tags: unknown): boolean {
  const normalizedTags = toNormalizedTags(tags);
  return normalizedTags.includes('Prints') && !hasVideoTag(normalizedTags);
}
