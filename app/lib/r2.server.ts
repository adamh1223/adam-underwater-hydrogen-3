import {AwsClient} from 'aws4fetch';
import {sanitizeDownloadFilename} from '~/lib/downloads';

const DEFAULT_R2_REGION = 'auto';

type CreateR2SignedDownloadUrlInput = {
  objectKey: string;
  downloadFilename?: string;
  expiresInSeconds?: number;
};

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
  const url = buildObjectUrl(env, objectKey);

  url.searchParams.set(
    'response-content-disposition',
    `attachment; filename="${sanitizeDownloadFilename(downloadFilename ?? 'download')}"`,
  );
  url.searchParams.set('X-Amz-Expires', String(expiresInSeconds));

  const awsClient = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region,
  });
  const signedRequest = await awsClient.sign(url.toString(), {
    method: 'GET',
    aws: {signQuery: true},
  });

  return signedRequest.url;
}
