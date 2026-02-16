import {AwsClient} from 'aws4fetch';
import {sanitizeDownloadFilename} from '~/lib/downloads';

const DEFAULT_R2_REGION = 'auto';

type CreateR2SignedDownloadUrlInput = {
  objectKey: string;
  downloadFilename?: string;
  expiresInSeconds?: number;
};

export class R2ObjectNotFoundError extends Error {
  attemptedKeys: string[];

  constructor(attemptedKeys: string[]) {
    super('R2 object not found for the provided key.');
    this.name = 'R2ObjectNotFoundError';
    this.attemptedKeys = attemptedKeys;
  }
}

function requireEnvValue(value: string | undefined, name: string) {
  if (!value || !value.trim()) {
    throw new Error(`${name} environment variable is required`);
  }
  return value.trim();
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

function buildObjectUrl(env: Env, objectKey: string): URL {
  const bucket = requireEnvValue(env.R2_BUCKET, 'R2_BUCKET');
  const endpoint = new URL(getEndpointBase(env));
  const encodedKey = encodeObjectKey(objectKey.trim());
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

function buildObjectKeyCandidates(objectKey: string): string[] {
  const normalized = objectKey.trim();
  if (!normalized) return [];

  const candidates = [normalized];
  const extensionMatch = normalized.match(/^(.*?)(\.[^./]+)$/);
  if (!extensionMatch) return candidates;

  const base = extensionMatch[1] ?? normalized;
  const extension = extensionMatch[2] ?? '';
  const lowerExtension = extension.toLowerCase();
  const upperExtension = extension.toUpperCase();

  if (lowerExtension && lowerExtension !== extension) {
    candidates.push(`${base}${lowerExtension}`);
  }
  if (upperExtension && upperExtension !== extension) {
    candidates.push(`${base}${upperExtension}`);
  }

  return Array.from(new Set(candidates));
}

async function objectExistsInR2(
  env: Env,
  awsClient: AwsClient,
  objectKey: string,
): Promise<boolean> {
  const url = buildObjectUrl(env, objectKey);
  const signedRequest = await awsClient.sign(url.toString(), {
    method: 'HEAD',
    aws: {signQuery: true},
  });
  const response = await fetch(signedRequest.url, {method: 'HEAD'});
  return response.ok;
}

export async function createR2SignedDownloadUrl(
  env: Env,
  {objectKey, downloadFilename, expiresInSeconds = 60 * 60}: CreateR2SignedDownloadUrlInput,
) {
  if (!objectKey.trim()) {
    throw new Error('Object key is required for download signing.');
  }

  const accessKeyId = requireEnvValue(env.R2_ACCESS_KEY_ID, 'R2_ACCESS_KEY_ID');
  const secretAccessKey = requireEnvValue(
    env.R2_SECRET_ACCESS_KEY,
    'R2_SECRET_ACCESS_KEY',
  );
  const region = env.R2_REGION?.trim() || DEFAULT_R2_REGION;
  const awsClient = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region,
  });

  const objectKeyCandidates = buildObjectKeyCandidates(objectKey);
  let resolvedObjectKey: string | null = null;
  for (const candidate of objectKeyCandidates) {
    if (await objectExistsInR2(env, awsClient, candidate)) {
      resolvedObjectKey = candidate;
      break;
    }
  }

  if (!resolvedObjectKey) {
    throw new R2ObjectNotFoundError(objectKeyCandidates);
  }

  const url = buildObjectUrl(env, resolvedObjectKey);
  url.searchParams.set(
    'response-content-disposition',
    `attachment; filename="${sanitizeDownloadFilename(downloadFilename ?? 'download')}"`,
  );
  url.searchParams.set('X-Amz-Expires', String(expiresInSeconds));

  const signedRequest = await awsClient.sign(url.toString(), {
    method: 'GET',
    aws: {signQuery: true},
  });

  return signedRequest.url;
}
