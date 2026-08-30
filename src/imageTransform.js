/**
 * Query-param image variants for the jcrt-files Worker.
 *
 * /images/<path>.<raster ext>?w=&h=&q=&f=  ->  Cloudflare cf.image transform.
 * Everything here degrades to null, which means "serve the original from R2".
 */
import { applyCors } from './http-meta.js';

// images/ only, raster only. SVG and .webmanifest are deliberately excluded.
const TRANSFORMABLE_IMAGE_RE = /^images\/.+\.(?:png|jpe?g|webp|gif)$/i;
const FORMATS = new Set(['webp', 'avif', 'auto']);
const DEFAULT_QUALITY = 85;
const MAX_DIMENSION = 4000;

/** One-year immutable: every distinct query string is a distinct variant. */
export const IMAGE_VARIANT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export function isTransformableImageKey(key) {
  return TRANSFORMABLE_IMAGE_RE.test(key);
}

/**
 * Recursion guard. Cloudflare stamps `via: 1.1 image-resizing` on the
 * subrequest it issues for a cf.image fetch; that request must be served
 * as a plain R2 read or the worker calls itself forever.
 */
export function isResizingSubrequest(request) {
  return /image-resizing/i.test(request.headers.get('via') ?? '');
}

function parseDimension(raw) {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number.parseInt(raw, 10);
  return value >= 1 && value <= MAX_DIMENSION ? value : null;
}

function parseQuality(raw) {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number.parseInt(raw, 10);
  return value >= 1 && value <= 100 ? value : null;
}

function parseFormat(raw) {
  if (!raw) return null;
  const value = raw.toLowerCase();
  return FORMATS.has(value) ? value : null;
}

/**
 * Builds cf.image options from the query string, or null when no valid
 * transform was requested (no params, or every supplied param invalid) —
 * null means the caller serves the original, untouched.
 *
 * @param {URLSearchParams} searchParams
 * @returns {{fit: 'scale-down', quality: number, width?: number, height?: number, format?: string}|null}
 */
export function parseImageTransform(searchParams) {
  const width = parseDimension(searchParams.get('w'));
  const height = parseDimension(searchParams.get('h'));
  const quality = parseQuality(searchParams.get('q'));
  const format = parseFormat(searchParams.get('f'));

  if (width === null && height === null && quality === null && format === null) return null;

  const options = { fit: 'scale-down', quality: quality ?? DEFAULT_QUALITY };
  if (width !== null) options.width = width;
  if (height !== null) options.height = height;
  if (format !== null) options.format = format;
  return options;
}

/**
 * Fetches the untransformed URL back through the zone with cf.image options.
 *
 * Returns null — never throws — whenever the variant cannot be produced
 * (subrequest threw, or answered non-2xx). The caller then serves the
 * original from R2, which is also what happens on a zone where Image
 * Transformations are not enabled: cf.image is ignored there and the
 * subrequest simply returns the original bytes.
 *
 * @param {Request} request  the inbound request
 * @param {URL} url          the inbound URL (query string included)
 * @param {object} transform cf.image options from parseImageTransform()
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<Response|null>}
 */
export async function serveTransformedImage(request, url, transform, fetchImpl = fetch) {
  const originUrl = new URL(url);
  originUrl.search = '';

  let upstream;
  try {
    upstream = await fetchImpl(originUrl.toString(), {
      method: 'GET',
      headers: { accept: request.headers.get('accept') ?? 'image/*' },
      cf: { image: transform },
    });
  } catch {
    return null;
  }

  if (!upstream || !upstream.ok) return null;

  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const resized = upstream.headers.get('cf-resized');
  if (resized) headers.set('cf-resized', resized);
  headers.set('cache-control', IMAGE_VARIANT_CACHE_CONTROL);
  applyCors(headers, request);
  // f=auto negotiates on Accept, so the variant must vary on it.
  // append, not set: applyCors may already have set Vary: Origin.
  if (transform.format === 'auto') headers.append('vary', 'Accept');

  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  return new Response(upstream.body, { status: 200, headers });
}
