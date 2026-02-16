import {AwsClient} from 'aws4fetch';

const DEFAULT_R2_REGION = 'auto';
const DEFAULT_REVIEWS_PREFIX = 'store-1-au/reviews';
const DEFAULT_CONTACT_SUBMISSIONS_PREFIX = 'store-1-au/contact-submissions';
const DEFAULT_PUBLIC_BASE_URL = 'https://downloads.adamunderwater.com';

function requireEnvValue(value: string | undefined, name: string) {
  if (!value || !value.trim()) {
    throw new Error(`${name} environment variable is required`);
  }
  return value.trim();
}

function trimSlashes(value: string) {
  return value.replace(/^\/+/, '').replace(/\/+$/, '');
}

function sanitizeFilename(filename: string) {
  const trimmed = filename.trim() || 'upload';
  return trimmed
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function encodeObjectKey(objectKey: string) {
  return objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function getEndpointBase(env: Env) {
  if (env.R2_ENDPOINT?.trim()) {
    return env.R2_ENDPOINT.trim();
  }

  if (env.R2_ACCOUNT_ID?.trim()) {
    return `https://${env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`;
  }

  throw new Error(
    'R2 endpoint is not configured. Set R2_ENDPOINT or R2_ACCOUNT_ID.',
  );
}

function buildS3ObjectUrl(env: Env, objectKey: string): URL {
  const bucket = requireEnvValue(env.R2_BUCKET, 'R2_BUCKET');
  const endpoint = new URL(getEndpointBase(env));
  const encodedKey = encodeObjectKey(trimSlashes(objectKey));
  const normalizedPath = endpoint.pathname.replace(/\/+$/, '');
  const endpointPathParts = normalizedPath.split('/').filter(Boolean);

  if (endpointPathParts.length === 0) {
    endpoint.pathname = `/${bucket}/${encodedKey}`;
    return endpoint;
  }

  if (endpointPathParts.length === 1 && endpointPathParts[0] === bucket) {
    endpoint.pathname = `/${bucket}/${encodedKey}`;
    return endpoint;
  }

  endpoint.pathname = `${normalizedPath}/${encodedKey}`;
  return endpoint;
}

function getPublicBaseUrl(env: Env) {
  const explicitBase = env.R2_PUBLIC_BASE_URL?.trim();
  return (explicitBase || DEFAULT_PUBLIC_BASE_URL).replace(/\/+$/, '');
}

function buildPublicObjectUrl(env: Env, objectKey: string) {
  const base = new URL(getPublicBaseUrl(env));
  const key = encodeObjectKey(trimSlashes(objectKey));
  const normalizedPath = base.pathname.replace(/\/+$/, '');
  base.pathname = normalizedPath ? `${normalizedPath}/${key}` : `/${key}`;
  return base.toString();
}

function getReviewsPrefix(env: Env) {
  const prefix = env.R2_REVIEWS_PREFIX?.trim() || DEFAULT_REVIEWS_PREFIX;
  return trimSlashes(prefix);
}

function getContactSubmissionsPrefix(env: Env) {
  const prefix =
    env.R2_CONTACT_SUBMISSIONS_PREFIX?.trim() ||
    DEFAULT_CONTACT_SUBMISSIONS_PREFIX;
  return trimSlashes(prefix);
}

function buildObjectKey(prefix: string, filename: string) {
  const safeFilename = sanitizeFilename(filename || 'upload');
  return `${prefix}/${Date.now()}-${crypto.randomUUID()}-${safeFilename}`;
}

function createAwsClient(env: Env) {
  return new AwsClient({
    accessKeyId: requireEnvValue(env.R2_ACCESS_KEY_ID, 'R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnvValue(
      env.R2_SECRET_ACCESS_KEY,
      'R2_SECRET_ACCESS_KEY',
    ),
    region: env.R2_REGION?.trim() || DEFAULT_R2_REGION,
    service: 's3',
  });
}

function extractObjectKeyFromUrl(env: Env, value: string): string | null {
  try {
    const url = new URL(value);
    const bucket = requireEnvValue(env.R2_BUCKET, 'R2_BUCKET');
    const publicBaseHost = new URL(getPublicBaseUrl(env)).host;
    const endpointHost = new URL(getEndpointBase(env)).host;
    const allowedHosts = new Set([publicBaseHost, endpointHost]);

    if (!allowedHosts.has(url.host)) {
      return null;
    }

    const segments = url.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));

    if (!segments.length) return null;

    if (segments[0] === bucket) {
      segments.shift();
    }

    const key = trimSlashes(segments.join('/'));
    return key || null;
  } catch {
    return null;
  }
}

export async function uploadReviewMedia(env: Env, file: File) {
  const objectKey = buildObjectKey(getReviewsPrefix(env), file.name);
  const url = buildS3ObjectUrl(env, objectKey);
  const headers = new Headers();
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  if (file.type) {
    headers.set('Content-Type', file.type);
  }

  const awsClient = createAwsClient(env);
  const response = await awsClient.fetch(url.toString(), {
    method: 'PUT',
    headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed with status ${response.status}`);
  }

  return buildPublicObjectUrl(env, objectKey);
}

export async function uploadContactSubmissionMedia(env: Env, file: File) {
  const objectKey = buildObjectKey(getContactSubmissionsPrefix(env), file.name);
  const url = buildS3ObjectUrl(env, objectKey);
  const headers = new Headers();
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  if (file.type) {
    headers.set('Content-Type', file.type);
  }

  const awsClient = createAwsClient(env);
  const response = await awsClient.fetch(url.toString(), {
    method: 'PUT',
    headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed with status ${response.status}`);
  }

  return buildPublicObjectUrl(env, objectKey);
}

export async function deleteReviewMedia(env: Env, mediaUrl: string) {
  const objectKey = extractObjectKeyFromUrl(env, mediaUrl);
  if (!objectKey) {
    return;
  }
  const reviewsPrefix = getReviewsPrefix(env);
  if (!objectKey.startsWith(`${reviewsPrefix}/`)) {
    return;
  }

  const awsClient = createAwsClient(env);
  const url = buildS3ObjectUrl(env, objectKey);
  const response = await awsClient.fetch(url.toString(), {method: 'DELETE'});

  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 delete failed with status ${response.status}`);
  }
}
