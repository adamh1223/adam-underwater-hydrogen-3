import {useEffect, useMemo, useState} from 'react';

export const EPRODUCT_SEARCH_HINT_WORDS = [
  'Sea Lion',
  'Fish',
  'Penguin',
  'Manta Ray',
  'Kelp',
  'Shark',
] as const;

export const PRINT_SEARCH_HINT_WORDS = [
  'Fish',
  'Coral',
  'Wave',
  'River',
  'Reef',
  'Shark',
  'Penguin',
  'Sea Lion',
  'Beach',
  'Lake',
] as const;

export const COMBINED_SEARCH_HINT_WORDS = Array.from(
  new Set([...PRINT_SEARCH_HINT_WORDS, ...EPRODUCT_SEARCH_HINT_WORDS]),
) as readonly string[];

type HintPair = [string, string];

function getRandomPair(words: readonly string[]): HintPair {
  const shuffled = [...words];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return [shuffled[0], shuffled[1]];
}

function parseStoredPair(value: string | null): HintPair | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string'
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    return null;
  }

  return null;
}

function getNextHintPair(
  words: readonly string[],
  previousPair: HintPair | null,
): HintPair {
  if (!previousPair) return getRandomPair(words);

  const previousWordSet = new Set(previousPair);
  const disjointWords = words.filter((word) => !previousWordSet.has(word));

  if (disjointWords.length >= 2) {
    return getRandomPair(disjointWords);
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const nextPair = getRandomPair(words);
    if (!nextPair.some((word) => previousWordSet.has(word))) {
      return nextPair;
    }
  }

  return getRandomPair(words);
}

export function RandomizedSearchHint({
  words,
  storageKey,
  className,
}: {
  words: readonly string[];
  storageKey: string;
  className?: string;
}) {
  const uniqueWords = useMemo(
    () =>
      Array.from(
        new Set(words.map((word) => word.trim()).filter((word) => word.length)),
      ),
    [words],
  );

  const fallbackPair = useMemo<HintPair | null>(() => {
    if (uniqueWords.length < 2) return null;
    return [uniqueWords[0], uniqueWords[1]];
  }, [uniqueWords]);

  const [hintPair, setHintPair] = useState<HintPair | null>(fallbackPair);

  useEffect(() => {
    if (typeof window === 'undefined' || uniqueWords.length < 2) return;

    let previousPair: HintPair | null = null;
    try {
      previousPair = parseStoredPair(window.localStorage.getItem(storageKey));
    } catch {
      previousPair = null;
    }

    const nextPair = getNextHintPair(uniqueWords, previousPair);
    setHintPair(nextPair);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextPair));
    } catch {
      // Ignore storage write issues; the hint can still render.
    }
  }, [storageKey, uniqueWords]);

  if (!hintPair) return null;

  return (
    <p className={className}>
      Try &ldquo;{hintPair[0]}&rdquo; or &ldquo;{hintPair[1]}&rdquo;
    </p>
  );
}
