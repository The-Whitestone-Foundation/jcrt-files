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

// Duplicate archive PDFs retired 2026-09-22: same article text under two keys/DOIs.
// The objects stay in R2; requests for the duplicate 301 to the primary. Keys are
// exact (case-sensitive) R2 keys, so match the on-disk filename.
export const DUPLICATE_PDF_KEYS = new Map([
  ['archives/08.1/mejido.pdf', 'archives/08.1/costoya.pdf'],
  ['archives/12.2/crockett_2.pdf', 'archives/12.2/crockett.pdf'],
  ['archives/12.2/montel_hurlin.pdf', 'archives/12.2/hurlin.pdf'],
  ['archives/13.1/v_squez.pdf', 'archives/13.1/vasquez.pdf'],
  ['archives/16.1/stowe_sousanis.pdf', 'archives/16.1/InterviewSousanis.pdf'],
  ['archives/16.1/clay_robinson.pdf', 'archives/16.1/InterviewGaia.pdf'],
  ['archives/16.1/InterviewUlmer.pdf', 'archives/16.1/figueiredo_2.pdf'],
  ['archives/18.1/komkov.pdf', 'archives/18.1/Komkov2.pdf'],
  ['archives/18.1/burke.pdf', 'archives/18.1/Burke2.pdf'],
  ['archives/18.1/ramos.pdf', 'archives/18.1/Ramos1.pdf'],
  ['archives/18.1/l_land.pdf', 'archives/18.1/Loland1.pdf'],
  ['archives/18.1/sharma.pdf', 'archives/18.1/Sharma2.pdf'],
  ['archives/18.1/spickard.pdf', 'archives/18.1/Spickard2.pdf'],
  ['archives/19.3/lebovic.pdf', 'archives/19.3/5-Leibovic.pdf'],
  ['archives/21.3/bradley_2.pdf', 'archives/21.3/Bradley2.pdf'],
  ['archives/21.3/Bradley3.pdf', 'archives/21.3/gildea.pdf'],
  ['archives/21.3/Bradley5.pdf', 'archives/21.3/bielik_robson.pdf'],
  ['archives/21.3/Bradley7.pdf', 'archives/21.3/nedoh.pdf'],
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
  const match = key.match(/^(citations\/archives\/[^/]+\/)(.+?)(\.(?:ris|csl\.json|bib))$/i);
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
