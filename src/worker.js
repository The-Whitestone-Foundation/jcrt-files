const FILES_BASE_URL = 'https://files.jcrt.org';

const LEGACY_CITATION_STEMS = new Map([
  ['prewitt-davis', 'prewitt_davis'],
  ['keller', 'keller_raschke'],
  ['degaetano', 'gaetano'],
  ['westin', 'westin_sedmak'],
  ['hagedorn-and-staudigl', 'hagedorn_staudigl'],
  ['featherstone', 'featherston'],
  ['cook1', 'cook'],
]);

function contentTypeFor(key) {
  const lower = key.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.ris')) return 'application/x-research-info-systems; charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.webmanifest')) return 'application/manifest+json; charset=utf-8';
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

function isImageAsset(key) {
  return /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i.test(key);
}

function normalizeKey(pathname) {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }

  const key = decoded
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, '&')
    .replace(/^\/+/, '');
  if (key.includes('..')) return null;
  return key;
}

function redirectToCanonical(url, key) {
  const target = new URL(FILES_BASE_URL);
  target.pathname = `/${key}`;
  return Response.redirect(target, 301);
}

function archivePdfCanonicalLink(key) {
  if (!/^archives\/[^/]+\/[^/]+\.pdf$/i.test(key)) return null;
  const target = new URL(FILES_BASE_URL);
  target.pathname = `/${key}`;
  return `<${target.toString()}>; rel="canonical"`;
}

function legacyCitationAlias(key) {
  const match = key.match(/^(citations\/archives\/[^/]+\/)(.+?)(\.(?:ris|csl\.json))$/i);
  if (!match) return null;

  const [, prefix, stem, ext] = match;
  const canonicalStem = LEGACY_CITATION_STEMS.get(stem.toLowerCase());
  if (!canonicalStem || canonicalStem === stem) return null;

  return `${prefix}${canonicalStem}${ext.toLowerCase()}`;
}

async function findCaseInsensitiveKey(bucket, key) {
  const slashIndex = key.lastIndexOf('/');
  const prefix = slashIndex === -1 ? '' : key.slice(0, slashIndex + 1);
  const basename = slashIndex === -1 ? key : key.slice(slashIndex + 1);
  const expectedLower = basename.toLowerCase();
  let cursor;
  const matches = [];

  do {
    const listed = await bucket.list({ prefix, cursor });
    for (const object of listed.objects || []) {
      const candidate = object.key.slice(prefix.length);
      if (candidate.includes('/')) continue;
      if (candidate.toLowerCase() === expectedLower) matches.push(object.key);
      if (matches.length > 1) return null;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  return matches.length === 1 ? matches[0] : null;
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

function preconditionStatus(request) {
  if (request.headers.has('if-none-match') || request.headers.has('if-modified-since')) {
    return 304;
  }
  return 412;
}

function applyRangeHeaders(object, headers) {
  headers.set('accept-ranges', 'bytes');

  const range = object.range;
  if (!range || typeof range.offset !== 'number' || typeof range.length !== 'number') {
    return false;
  }

  const end = range.offset + range.length - 1;
  headers.set('content-length', String(range.length));
  headers.set('content-range', `bytes ${range.offset}-${end}/${object.size}`);
  return true;
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
    if (key === '') {
      return new Response('Gone', {
        status: 410,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-robots-tag': 'noindex',
        },
      });
    }

    if (key === null) {
      return new Response('Not Found', { status: 404 });
    }

    const aliasKey = legacyCitationAlias(key);
    if (aliasKey && aliasKey !== key) {
      return redirectToCanonical(url, aliasKey);
    }

    const object = await env.JCRT_FILES.get(key, {
      range: request.headers,
      onlyIf: request.headers,
    });

    if (object === null) {
      const canonicalKey = await findCaseInsensitiveKey(env.JCRT_FILES, key);
      if (canonicalKey && canonicalKey !== key) {
        return redirectToCanonical(url, canonicalKey);
      }

      return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    const detectedContentType = contentTypeFor(key);
    const storedContentType = headers.get('content-type');
    const storedMime = (storedContentType || '').split(';', 1)[0].trim().toLowerCase();
    if (!storedContentType || storedMime === 'application/octet-stream' || key.toLowerCase().endsWith('.webmanifest')) {
      headers.set('content-type', detectedContentType);
    }
    if (isImageAsset(key)) {
      headers.set('x-robots-tag', 'noindex');
    }
    headers.set('cache-control', cacheControlFor(key));
    const canonicalLink = archivePdfCanonicalLink(key);
    if (canonicalLink) headers.append('link', canonicalLink);
    applyCors(headers, request);
    headers.set('accept-ranges', 'bytes');

    const hasBody = 'body' in object && object.body !== undefined;
    const isPartial = hasBody && request.headers.has('range') && applyRangeHeaders(object, headers);
    let status = 200;

    if (!hasBody) {
      status = preconditionStatus(request);
    } else if (isPartial) {
      status = 206;
    } else if (!headers.has('content-length') && typeof object.size === 'number') {
      headers.set('content-length', String(object.size));
    }

    if (request.method === 'HEAD') {
      return new Response(null, { status, headers });
    }

    return new Response(hasBody ? object.body : null, { status, headers });
  },
};
