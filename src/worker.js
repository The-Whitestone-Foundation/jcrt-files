function contentTypeFor(key) {
  const lower = key.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.ris')) return 'application/x-research-info-systems; charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.xml')) return 'application/xml; charset=utf-8';
  if (lower.endsWith('.txt')) return 'text/plain; charset=utf-8';
  if (lower.endsWith('.html')) return 'text/html; charset=utf-8';
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  if (lower.endsWith('.woff')) return 'font/woff';
  return 'application/octet-stream';
}

function cacheControlFor(key) {
  const lower = key.toLowerCase();
  if (lower.endsWith('.pdf')) return 'public, max-age=3600, s-maxage=86400';
  return 'public, max-age=31536000, immutable';
}

function normalizeKey(pathname) {
  const key = pathname.replace(/^\/+/, '');
  if (!key || key.includes('..')) return null;
  return key;
}

function applyCors(headers, request) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = new Set([
    'https://jcrt.org',
    'https://files.jcrt.org',
  ]);

  if (origin && allowedOrigins.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }

  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Range');
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, ETag');
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      const headers = new Headers();
      applyCors(headers, request);
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const key = normalizeKey(url.pathname);
    if (!key) {
      return new Response('Not Found', { status: 404 });
    }

    const object = await env.JCRT_FILES.get(key, {
      range: request.headers,
      onlyIf: request.headers,
    });

    if (object === null) {
      return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('content-type', headers.get('content-type') || contentTypeFor(key));
    headers.set('cache-control', cacheControlFor(key));
    applyCors(headers, request);

    if (request.method === 'HEAD') {
      return new Response(null, { status: 200, headers });
    }

    return new Response(object.body, { status: 200, headers });
  },
};
