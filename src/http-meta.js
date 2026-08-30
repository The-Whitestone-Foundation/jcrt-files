/**
 * Static HTTP metadata rules for the jcrt-files Worker.
 * Pure, stateless, zero R2 I/O — safe to import anywhere.
 */
import { isTrustedOrigin } from './waf.js';

/** Canonical public origin. Single source of truth; imported by keys.js and worker.js. */
export const FILES_BASE_URL = 'https://files.jcrt.org';

export function contentTypeFor(key) {
  const lower = key.toLowerCase();
  if (lower.startsWith('metadata/') && lower.endsWith('.json')) return 'application/ld+json; charset=utf-8';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.ris')) return 'application/x-research-info-systems; charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.webmanifest')) return 'application/manifest+json; charset=utf-8';
  if (lower.endsWith('.xsl')) return 'text/xsl; charset=utf-8';
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

export function cacheControlFor(key) {
  const lower = key.toLowerCase();
  if (lower.startsWith('metadata/') && lower.endsWith('.json')) return 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
  if (lower.endsWith('.pdf')) return 'public, max-age=3600, s-maxage=86400';
  if (lower.startsWith('sitemaps/')) return 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
  return 'public, max-age=31536000, immutable';
}

export function applyCors(headers, request) {
  const origin = request.headers.get('Origin');

  if (isTrustedOrigin(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  } else {
    headers.set('Access-Control-Allow-Origin', '*');
  }

  // R2 file-serving headers (byte-range, ETag) — kept separate from API CORS
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Range');
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, ETag');
}

export function preconditionStatus(request) {
  if (request.headers.has('if-none-match') || request.headers.has('if-modified-since')) {
    return 304;
  }
  return 412;
}

export function applyRangeHeaders(object, headers) {
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
