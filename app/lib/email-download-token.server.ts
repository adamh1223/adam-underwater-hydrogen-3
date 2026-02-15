type EmailDownloadTokenPayload = {
  v: 1;
  orderId: string;
  lineItemId: string;
  iat: number;
};

const TOKEN_VERSION = 1 as const;

function requireTokenSecret(env: Env): string {
  const secret = env.DOWNLOAD_EMAIL_LINK_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'DOWNLOAD_EMAIL_LINK_SECRET is required to sign email download links.',
    );
  }
  return secret;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4 || 4)) % 4);
  return fromBase64(base64 + padding);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256Base64Url(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function toPayloadString(payload: EmailDownloadTokenPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return toBase64Url(bytes);
}

function parsePayloadString(encodedPayload: string): EmailDownloadTokenPayload | null {
  try {
    const decoded = new TextDecoder().decode(fromBase64Url(encodedPayload));
    const parsed = JSON.parse(decoded) as Partial<EmailDownloadTokenPayload>;
    if (parsed?.v !== TOKEN_VERSION) return null;
    if (typeof parsed.orderId !== 'string' || !parsed.orderId.length) return null;
    if (typeof parsed.lineItemId !== 'string' || !parsed.lineItemId.length) return null;
    if (typeof parsed.iat !== 'number' || !Number.isFinite(parsed.iat)) return null;

    return {
      v: TOKEN_VERSION,
      orderId: parsed.orderId,
      lineItemId: parsed.lineItemId,
      iat: parsed.iat,
    };
  } catch {
    return null;
  }
}

export async function createEmailDownloadToken({
  env,
  orderId,
  lineItemId,
}: {
  env: Env;
  orderId: string;
  lineItemId: string;
}): Promise<string> {
  if (!orderId.trim() || !lineItemId.trim()) {
    throw new Error('orderId and lineItemId are required for email download token.');
  }

  const payload: EmailDownloadTokenPayload = {
    v: TOKEN_VERSION,
    orderId: orderId.trim(),
    lineItemId: lineItemId.trim(),
    iat: Date.now(),
  };

  const encodedPayload = toPayloadString(payload);
  const signature = await hmacSha256Base64Url(
    requireTokenSecret(env),
    encodedPayload,
  );
  return `${encodedPayload}.${signature}`;
}

export async function verifyEmailDownloadToken({
  env,
  token,
}: {
  env: Env;
  token: string;
}): Promise<EmailDownloadTokenPayload | null> {
  if (!token.trim()) return null;
  const [encodedPayload, providedSignature] = token.split('.');
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = await hmacSha256Base64Url(
    requireTokenSecret(env),
    encodedPayload,
  );
  if (!timingSafeEqual(providedSignature, expectedSignature)) return null;

  return parsePayloadString(encodedPayload);
}
