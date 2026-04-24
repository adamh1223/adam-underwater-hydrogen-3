const LEGACY_DURATION_PREFIX = 'duration-';
const SHORTHAND_DURATION_REGEX = /^d(\d+)$/i;
const PLAIN_SECONDS_DURATION_REGEX = /^(\d+)$/;

export function parseDurationSecondsValue(rawValue: string): number | null {
  const trimmedValue = rawValue.trim();
  if (!trimmedValue) return null;

  const colonParts = trimmedValue.split(':').map((part) => part.trim());
  if (
    colonParts.length > 1 &&
    colonParts.every((part) => /^\d+(?:\.\d+)?$/.test(part))
  ) {
    const totalSeconds = colonParts.reduce((accumulator, part) => {
      return accumulator * 60 + Number(part);
    }, 0);
    return Number.isFinite(totalSeconds) ? totalSeconds : null;
  }

  const normalizedValue = trimmedValue
    .replace(/\b(seconds?|secs?)\b/gi, '')
    .replace(/s$/i, '')
    .trim();

  if (!/^\d+(?:\.\d+)?$/.test(normalizedValue)) return null;

  const parsed = Number(normalizedValue);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatDurationFromSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function parseShorthandDurationSeconds(tag: string): number | null {
  const match = tag.trim().match(SHORTHAND_DURATION_REGEX);
  if (!match?.[1]) return null;

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return parsed;
}

function parsePlainSecondsDuration(tag: string): number | null {
  const match = tag.trim().match(PLAIN_SECONDS_DURATION_REGEX);
  if (!match?.[1]) return null;

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return parsed;
}

function extractLegacyDurationRawValue(tag: string): string | null {
  if (!tag.startsWith(LEGACY_DURATION_PREFIX)) return null;

  const rawValue = tag.slice(LEGACY_DURATION_PREFIX.length).trim();
  return rawValue.length ? rawValue : null;
}

export function parseDurationSecondsFromTags(tags: string[]): number | null {
  const shorthandTag = tags.find((tag) => SHORTHAND_DURATION_REGEX.test(tag.trim()));
  if (shorthandTag) {
    const shorthandSeconds = parseShorthandDurationSeconds(shorthandTag);
    if (shorthandSeconds !== null) return shorthandSeconds;
  }

  const legacyTag = tags.find((tag) => tag.startsWith(LEGACY_DURATION_PREFIX));
  if (legacyTag) {
    const rawLegacyValue = extractLegacyDurationRawValue(legacyTag);
    if (rawLegacyValue) {
      const legacySeconds = parseDurationSecondsValue(rawLegacyValue);
      if (legacySeconds !== null) return legacySeconds;
    }
  }

  const plainSecondsTag = tags.find((tag) =>
    PLAIN_SECONDS_DURATION_REGEX.test(tag.trim()),
  );
  if (!plainSecondsTag) return null;

  return parsePlainSecondsDuration(plainSecondsTag);
}

export function parseDisplayDurationFromTags(tags: string[]): string | undefined {
  const shorthandTag = tags.find((tag) => SHORTHAND_DURATION_REGEX.test(tag.trim()));
  if (shorthandTag) {
    const shorthandSeconds = parseShorthandDurationSeconds(shorthandTag);
    if (shorthandSeconds !== null) {
      return formatDurationFromSeconds(shorthandSeconds);
    }
  }

  const legacyTag = tags.find((tag) => tag.startsWith(LEGACY_DURATION_PREFIX));
  if (legacyTag) {
    const rawLegacyValue = extractLegacyDurationRawValue(legacyTag);
    return rawLegacyValue ?? undefined;
  }

  const plainSecondsTag = tags.find((tag) =>
    PLAIN_SECONDS_DURATION_REGEX.test(tag.trim()),
  );
  if (!plainSecondsTag) return undefined;

  const plainSeconds = parsePlainSecondsDuration(plainSecondsTag);
  if (plainSeconds === null) return undefined;

  return formatDurationFromSeconds(plainSeconds);
}
