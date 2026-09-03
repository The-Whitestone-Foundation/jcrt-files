/**
 * Key / path resolution for the jcrt-files Worker.
 * Pure except findCaseInsensitiveKey(), which performs R2 `list` I/O
 * (paginated) and is therefore async — see its doc comment.
 */
import { FILES_BASE_URL } from './http-meta.js';

export const LEGACY_CITATION_STEMS = new Map([
  ['prewitt-davis', 'prewitt_davis'],
  ['keller', 'keller_raschke'],
  ['degaetano', 'gaetano'],
  ['westin', 'westin_sedmak'],
  ['hagedorn-and-staudigl', 'hagedorn_staudigl'],
  ['featherstone', 'featherston'],
  ['cook1', 'cook'],
]);

export function normalizeKey(pathname) {
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

export function redirectToCanonical(key) {
  const target = new URL(FILES_BASE_URL);
  target.pathname = `/${key}`;
  return Response.redirect(target, 301);
}

export function archivePdfCanonicalLink(key) {
  if (!/^archives\/[^/]+\/[^/]+\.pdf$/i.test(key)) return null;
  const target = new URL(FILES_BASE_URL);
  target.pathname = `/${key}`;
  return `<${target.toString()}>; rel="canonical"`;
}

export function legacyCitationAlias(key) {
  const match = key.match(/^(citations\/archives\/[^/]+\/)(.+?)(\.(?:ris|csl\.json))$/i);
  if (!match) return null;

  const [, prefix, stem, ext] = match;
  const canonicalStem = LEGACY_CITATION_STEMS.get(stem.toLowerCase());
  if (!canonicalStem || canonicalStem === stem) return null;

  return `${prefix}${canonicalStem}${ext.toLowerCase()}`;
}

export async function findCaseInsensitiveKey(bucket, key) {
  const slashIndex = key.lastIndexOf('/');
  const prefix = slashIndex === -1 ? '' : key.slice(0, slashIndex + 1);
  const basename = slashIndex === -1 ? key : key.slice(slashIndex + 1);
  const expectedLower = basename.toLowerCase();
  let cursor;
  const matches = [];

  do {
    const listed = await bucket.list({ prefix, cursor, delimiter: '/' });
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
