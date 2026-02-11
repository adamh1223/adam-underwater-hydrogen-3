export type ContactSubmissionInput = {
  name: string;
  email: string;
  message: string;
  website?: string | null;
  formStartMs?: string | null;
  userAgentIsBot?: boolean;
  nowMs?: number;
};

export type ContactSubmissionValidationResult =
  | {ok: true; value: {name: string; email: string; message: string}}
  | {
      ok: false;
      code: 'INVALID_INPUT' | 'SPAM_DETECTED';
      error: string;
      spamScore?: number;
      spamFlags?: string[];
    };

const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 5000;

let letterRegexGlobal: RegExp | null = null;
function getLetterRegexGlobal() {
  if (letterRegexGlobal) return letterRegexGlobal;
  try {
    letterRegexGlobal = new RegExp('\\p{L}', 'gu');
  } catch {
    letterRegexGlobal = /[A-Za-z]/g;
  }
  return letterRegexGlobal;
}

function countLetters(value: string) {
  const regex = getLetterRegexGlobal();
  regex.lastIndex = 0;
  return (value.match(regex) ?? []).length;
}

function countDigits(value: string) {
  return (value.match(/\d/g) ?? []).length;
}

function normalizeText(value: string) {
  return value.normalize('NFKC');
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeName(value: string) {
  return collapseWhitespace(normalizeText(value));
}

function normalizeEmail(value: string) {
  return collapseWhitespace(normalizeText(value));
}

function normalizeMessage(value: string) {
  const normalized = normalizeText(value).replace(/\r\n?/g, '\n').trim();
  return normalized;
}

function isValidEmail(email: string) {
  if (email.length < 3 || email.length > MAX_EMAIL_LENGTH) return false;
  // Pragmatic check (similar to HTML5 "email" input), not RFC-perfect.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function countMatches(value: string, pattern: RegExp) {
  const matches = value.match(pattern);
  return matches ? matches.length : 0;
}

function getAsciiLetters(value: string) {
  return (value.match(/[A-Za-z]/g) ?? []).join('');
}

function vowelRatio(asciiLettersLower: string) {
  if (asciiLettersLower.length === 0) return 0;
  const vowels = countMatches(asciiLettersLower, /[aeiouy]/g);
  return vowels / asciiLettersLower.length;
}

function longestConsonantRun(asciiLettersLower: string) {
  let current = 0;
  let longest = 0;
  for (const ch of asciiLettersLower) {
    const isVowel = /[aeiouy]/.test(ch);
    if (!isVowel) {
      current += 1;
      if (current > longest) longest = current;
      continue;
    }
    current = 0;
  }
  return longest;
}

function uniqueCharRatio(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 0;
  return new Set(Array.from(trimmed)).size / trimmed.length;
}

function longestSameCharRun(value: string) {
  const trimmed = value.trim();
  let longest = 0;
  let current = 0;
  let prev: string | null = null;
  let total = 0;

  for (const rawCh of trimmed) {
    total += 1;
    const ch = rawCh.toLowerCase();
    if (prev === ch) {
      current += 1;
    } else {
      prev = ch;
      current = 1;
    }
    if (current > longest) longest = current;
  }

  return {longest, total};
}

function caseTransitions(value: string) {
  let transitions = 0;
  let lastCase: 'upper' | 'lower' | null = null;

  for (const ch of value) {
    if (!/[A-Za-z]/.test(ch)) continue;
    const nextCase: 'upper' | 'lower' =
      ch === ch.toUpperCase() ? 'upper' : 'lower';
    if (lastCase && nextCase !== lastCase) transitions += 1;
    lastCase = nextCase;
  }

  return transitions;
}

function looksLikeRandomToken(value: string) {
  const token = value.trim();
  if (token.length < 12 || token.length > 32) return false;
  if (!/^[A-Za-z]+$/.test(token)) return false;

  const lettersLower = token.toLowerCase();
  const vr = vowelRatio(lettersLower);
  const consonants = longestConsonantRun(lettersLower);
  const transitions = caseTransitions(token);

  return vr < 0.2 || consonants >= 8 || transitions >= 8;
}

let letterRegexSingle: RegExp | null = null;
function getLetterRegexSingle() {
  if (letterRegexSingle) return letterRegexSingle;
  try {
    letterRegexSingle = new RegExp('\\p{L}', 'u');
  } catch {
    letterRegexSingle = /[A-Za-z]/;
  }
  return letterRegexSingle;
}

function isLetterChar(ch: string) {
  return getLetterRegexSingle().test(ch);
}

function foldForVowelCheck(ch: string) {
  return ch
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isVowelChar(ch: string) {
  const folded = foldForVowelCheck(ch);
  return /[aeiou]/.test(folded);
}

let upperRegexGlobal: RegExp | null = null;
let lowerRegexGlobal: RegExp | null = null;
function getUpperRegexGlobal() {
  if (upperRegexGlobal) return upperRegexGlobal;
  try {
    upperRegexGlobal = new RegExp('\\p{Lu}', 'gu');
  } catch {
    upperRegexGlobal = /[A-Z]/g;
  }
  return upperRegexGlobal;
}

function getLowerRegexGlobal() {
  if (lowerRegexGlobal) return lowerRegexGlobal;
  try {
    lowerRegexGlobal = new RegExp('\\p{Ll}', 'gu');
  } catch {
    lowerRegexGlobal = /[a-z]/g;
  }
  return lowerRegexGlobal;
}

function hasWordWithTwoUpperAndTwoLower(value: string) {
  const tokens = value.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const uppers = (token.match(getUpperRegexGlobal()) ?? []).length;
    const lowers = (token.match(getLowerRegexGlobal()) ?? []).length;
    if (uppers >= 2 && lowers >= 2) return true;
  }
  return false;
}

function wordCountWithLetters(value: string) {
  const tokens = value.split(/\s+/).filter(Boolean);
  let count = 0;
  for (const token of tokens) {
    if (getLetterRegexSingle().test(token)) count += 1;
  }
  return count;
}

function hasConsecutiveConsonantOrDigitRun(value: string, minRun: number) {
  let run = 0;

  for (const ch of value) {
    if (/[0-9]/.test(ch)) {
      run += 1;
    } else if (isLetterChar(ch)) {
      if (isVowelChar(ch)) {
        run = 0;
        continue;
      }
      run += 1;
    } else {
      run = 0;
    }

    if (run >= minRun) return true;
  }

  return false;
}

function countUrls(value: string) {
  // Simple, tolerant URL detector.
  return countMatches(value, /(https?:\/\/\S+|\bwww\.\S+)/gi);
}

function spamScoreName(name: string) {
  let score = 0;
  const flags: string[] = [];

  const nameCompact = name.replace(/\s+/g, '');
  const letters = countLetters(nameCompact);
  const digits = countDigits(nameCompact);

  if (letters === 0) {
    score += 10;
    flags.push('name_no_letters');
  }

  if (digits > 0) {
    const digitRatio = nameCompact.length > 0 ? digits / nameCompact.length : 0;
    if (nameCompact.length >= 6 && digitRatio > 0.5) {
      score += 6;
      flags.push('name_mostly_digits');
    } else if (nameCompact.length >= 6 && digitRatio > 0.3) {
      score += 4;
      flags.push('name_many_digits');
    } else {
      score += 1;
      flags.push('name_has_digits');
    }
  }

  if (countUrls(name) > 0) {
    score += 6;
    flags.push('name_has_url');
  }

  const asciiLetters = getAsciiLetters(name);
  const asciiLen = asciiLetters.length;
  const lower = asciiLetters.toLowerCase();

  if (asciiLen >= 16 && !/\s/.test(name) && !/[-'.]/.test(name)) {
    score += 2;
    flags.push('name_long_single_token');
  }

  if (asciiLen >= 10) {
    const vr = vowelRatio(lower);
    if (vr < 0.2) {
      score += 3;
      flags.push('name_low_vowel_ratio');
    }

    const consRun = longestConsonantRun(lower);
    if (consRun >= 6) {
      score += 2;
      flags.push('name_long_consonant_run');
    }
  }

  const transitions = caseTransitions(name);
  if (name.length >= 12 && transitions >= 8) {
    score += 2;
    flags.push('name_many_case_transitions');
  }

  if (asciiLen >= 14 && uniqueCharRatio(name) > 0.85 && !/\s/.test(name)) {
    score += 1;
    flags.push('name_high_unique_ratio');
  }

  const run = longestSameCharRun(nameCompact);
  if (
    run.total >= 10 &&
    run.longest >= 8 &&
    run.total > 0 &&
    run.longest / run.total > 0.6
  ) {
    score += 6;
    flags.push('name_repeated_char_run');
  }

  if (looksLikeRandomToken(name)) {
    score += 3;
    flags.push('name_random_token');
  }

  return {score, flags};
}

function spamScoreMessage(message: string) {
  let score = 0;
  const flags: string[] = [];

  const messageCompact = message.replace(/\s+/g, '');
  const letters = countLetters(messageCompact);
  const digits = countDigits(messageCompact);

  if (letters === 0) {
    score += 8;
    flags.push('message_no_letters');
  }

  if (messageCompact.length >= 10) {
    const digitRatio =
      messageCompact.length > 0 ? digits / messageCompact.length : 0;
    if (digitRatio > 0.8) {
      score += 6;
      flags.push('message_mostly_digits');
    }
  }

  const run = longestSameCharRun(messageCompact);
  if (
    run.total >= 10 &&
    run.longest >= 8 &&
    run.total > 0 &&
    run.longest / run.total > 0.6
  ) {
    score += 6;
    flags.push('message_repeated_char_run');
  }

  if (messageCompact.length >= 10 && uniqueCharRatio(messageCompact) < 0.2) {
    score += 4;
    flags.push('message_low_unique_ratio');
  }

  const urls = countUrls(message);
  if (urls >= 2) {
    score += 5;
    flags.push('message_many_urls');
  } else if (urls === 1 && message.length < 60) {
    score += 2;
    flags.push('message_url_short');
  }

  const hasWhitespace = /\s/.test(message);
  const asciiLetters = getAsciiLetters(message);
  const asciiLen = asciiLetters.length;
  const lower = asciiLetters.toLowerCase();

  if (!hasWhitespace && message.length >= 14) {
    const vr = vowelRatio(lower);
    if (asciiLen >= 12 && vr < 0.2) {
      score += 5;
      flags.push('message_single_token_low_vowel_ratio');
    } else if (/^[A-Za-z0-9]+$/.test(message) && message.length >= 18) {
      score += 3;
      flags.push('message_single_token_alnum');
    } else {
      score += 1;
      flags.push('message_no_whitespace');
    }
  }

  if (asciiLen >= 40) {
    const vr = vowelRatio(lower);
    if (vr < 0.2) {
      score += 3;
      flags.push('message_low_vowel_ratio_long');
    }

    const consRun = longestConsonantRun(lower);
    if (consRun >= 10) {
      score += 2;
      flags.push('message_long_consonant_run');
    }
  }

  if (message.length >= 20 && !hasWhitespace && uniqueCharRatio(message) > 0.88) {
    score += 1;
    flags.push('message_high_unique_ratio');
  }

  if (!hasWhitespace && looksLikeRandomToken(message)) {
    score += 3;
    flags.push('message_random_token');
  }

  return {score, flags};
}

function spamScoreTiming(formStartMs: string | null | undefined, nowMs: number) {
  if (!formStartMs) return {score: 0, flags: [] as string[]};

  const start = Number(formStartMs);
  if (!Number.isFinite(start) || start <= 0) {
    return {score: 0, flags: [] as string[]};
  }

  const elapsedMs = nowMs - start;
  if (elapsedMs < 0) return {score: 0, flags: [] as string[]};

  if (elapsedMs < 500) return {score: 4, flags: ['submitted_too_fast']};
  if (elapsedMs < 1500) return {score: 2, flags: ['submitted_fast']};
  return {score: 0, flags: [] as string[]};
}

export function validateContactSubmission(
  input: ContactSubmissionInput,
): ContactSubmissionValidationResult {
  const name = normalizeName(input.name ?? '');
  const email = normalizeEmail(input.email ?? '');
  const message = normalizeMessage(input.message ?? '');

  if (!name || name.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: 'Please enter your name.',
    };
  }

  if (/\d/.test(name)) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: 'Please enter a name without numbers.',
    };
  }

  if (!email || !isValidEmail(email)) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: 'Please enter a valid email address.',
    };
  }

  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: 'Please enter a message.',
    };
  }

  if (hasWordWithTwoUpperAndTwoLower(name)) {
    return {
      ok: false,
      code: 'SPAM_DETECTED',
      error:
        'Your message looks like automated spam. Please write a short message (a few words) and try again.',
      spamScore: 999,
      spamFlags: ['name_mixed_case_word'],
    };
  }

  if (hasWordWithTwoUpperAndTwoLower(message)) {
    return {
      ok: false,
      code: 'SPAM_DETECTED',
      error:
        'Your message looks like automated spam. Please write a short message (a few words) and try again.',
      spamScore: 999,
      spamFlags: ['message_mixed_case_word'],
    };
  }

  if (wordCountWithLetters(message) < 3) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: 'Please enter a message with at least 3 words.',
    };
  }

  const vowelRunFlags: string[] = [];
  if (hasConsecutiveConsonantOrDigitRun(name, 5)) {
    vowelRunFlags.push('name_consecutive_consonant_or_digit_run');
  }
  if (hasConsecutiveConsonantOrDigitRun(message, 5)) {
    vowelRunFlags.push('message_consecutive_consonant_or_digit_run');
  }
  if (vowelRunFlags.length > 0) {
    return {
      ok: false,
      code: 'SPAM_DETECTED',
      error:
        'Your message looks like automated spam. Please write a short message (a few words) and try again.',
      spamScore: 999,
      spamFlags: vowelRunFlags,
    };
  }

  let spamScore = 0;
  const spamFlags: string[] = [];

  const website = (input.website ?? '').toString().trim();
  if (website.length > 0) {
    spamScore += 10;
    spamFlags.push('honeypot_filled');
  }

  if (input.userAgentIsBot) {
    spamScore += 4;
    spamFlags.push('user_agent_bot');
  }

  const nameSpam = spamScoreName(name);
  spamScore += nameSpam.score;
  spamFlags.push(...nameSpam.flags);

  const messageSpam = spamScoreMessage(message);
  spamScore += messageSpam.score;
  spamFlags.push(...messageSpam.flags);

  const nowMs = input.nowMs ?? Date.now();
  const timingSpam = spamScoreTiming(input.formStartMs, nowMs);
  spamScore += timingSpam.score;
  spamFlags.push(...timingSpam.flags);

  const shouldBlock = spamScore >= 8;
  if (shouldBlock) {
    return {
      ok: false,
      code: 'SPAM_DETECTED',
      error:
        'Your message looks like automated spam. Please write a short message (a few words) and try again.',
      spamScore,
      spamFlags,
    };
  }

  return {ok: true, value: {name, email, message}};
}
