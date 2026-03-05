export async function proxyCloudflareAsset(
  request: Request,
  sourceUrl: string,
  contentType?: string,
) {
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(sourceUrl);

  upstreamUrl.search = requestUrl.search;

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: contentType ?? '*/*',
    },
  });

  if (!upstreamResponse.ok) {
    return new Response(null, {status: upstreamResponse.status});
  }

  const buffer = await upstreamResponse.arrayBuffer();

  const resolvedContentType =
    contentType ||
    upstreamResponse.headers.get('content-type') ||
    'application/octet-stream';

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': resolvedContentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
