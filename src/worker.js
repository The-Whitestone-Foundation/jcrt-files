import { wafInspect, blockResponse, INDEXING_BOT_RE } from './waf.js';
import {
  FILES_BASE_URL, contentTypeFor, cacheControlFor,
  applyCors, preconditionStatus, applyRangeHeaders,
} from './http-meta.js';
import {
  normalizeKey, redirectToCanonical, archivePdfCanonicalLink,
  legacyCitationAlias, findCaseInsensitiveKey,
} from './keys.js';
import { isResizingSubrequest, isTransformableImageKey, parseImageTransform, serveTransformedImage } from './imageTransform.js';

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

    const ua = request.headers.get('User-Agent') ?? '';
    const isIndexingBot = INDEXING_BOT_RE.test(ua);

    // Known indexing bots bypass WAF entirely so crawlers are never blocked.
    if (!isIndexingBot) {
      const waf = wafInspect(request);
      if (waf.blocked) return blockResponse(waf.status, waf.reason);
    }

    const url = new URL(request.url);
    let key = normalizeKey(url.pathname);

    if (key === 'robots.txt') {
      const body = [
        'User-agent: *',
        'Allow: /archives/',
        'Allow: /citations/',
        'Allow: /docs/',
        'Allow: /images/',
        'Allow: /metadata/',
        'Allow: /religioustheory/',
        'Allow: /sitemaps/',
        '',
        `Sitemap: ${FILES_BASE_URL}/sitemap.xml`,
      ].join('\n');
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' },
      });
    }

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

    // Crawlers look for /sitemap.xml at the origin root. The generator writes the index
    // to sitemaps/index.xml next to the per-folder sitemaps; serve it here as a rewrite
    // rather than a redirect so the advertised URL is the one that actually responds.
    if (key === 'sitemap.xml') key = 'sitemaps/index.xml';

    // Query-param image variants (w/h/q/f). Falls through to the untouched R2 path
    // when the key is not a raster image, no valid params were given, or the
    // transform subrequest is unavailable (zone without Image Transformations).
    if (!isResizingSubrequest(request) && isTransformableImageKey(key)) {
      const transform = parseImageTransform(url.searchParams);
      if (transform) {
        const transformed = await serveTransformedImage(request, url, transform);
        if (transformed) return transformed;
      }
    }

    const object = await env.JCRT_FILES.get(key, {
      range: request.headers,
      onlyIf: request.headers,
    });

    if (object === null) {
      // Legacy stem aliases are a FALLBACK, not an override. They used to run before the
      // lookup, so a real file whose name happened to match a renamed stem in a different
      // issue was shadowed: /citations/archives/08.3/keller.ris exists, but the alias
      // redirected it to keller_raschke.ris (which only exists in 22.2) and 404'd.
      const aliasKey = legacyCitationAlias(key);
      if (aliasKey && aliasKey !== key) {
        return redirectToCanonical(aliasKey);
      }

      const canonicalKey = await findCaseInsensitiveKey(env.JCRT_FILES, key);
      if (canonicalKey && canonicalKey !== key) {
        return redirectToCanonical(canonicalKey);
      }

      if (key.startsWith('metadata/') && key.endsWith('.json')) {
        return new Response(JSON.stringify({ error: 'Not Found', key }), {
          status: 404,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=300',
          },
        });
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
    headers.set('cache-control', cacheControlFor(key));
    const canonicalLink = archivePdfCanonicalLink(key);
    if (canonicalLink) headers.append('link', canonicalLink);
    applyCors(headers, request);
    headers.set('accept-ranges', 'bytes');

    if (isIndexingBot) headers.set('x-bot-allowed', 'true');

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
