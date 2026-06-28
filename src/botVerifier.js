/**
 * Bot IP verification for the jcrt-files Cloudflare Worker.
 *
 * Strategy:
 *   1. Match User-Agent against known bot patterns (fast, zero I/O)
 *   2. For providers that publish IP ranges, verify the connecting IP against
 *      fresh ranges fetched from the provider and cached in Workers Cache API
 *      for 24 hours.  Falls back to static ranges if the fetch fails.
 *   3. Requests are always allowed when UA matches; X-Bot-Verified: true/false
 *      indicates whether the IP was also confirmed against published ranges.
 *   4. Providers without published ranges (Anthropic, Perplexity) are marked
 *      uaOnly: true — X-Bot-Verified will be "false" for those.
 */

// ─── CIDR helpers ─────────────────────────────────────────────────────────────

function ip4ToInt(ip) {
  return ip.split('.').reduce((n, o) => n * 256 + parseInt(o, 10), 0) >>> 0;
}

function cidr4Contains(cidr, ip) {
  const [net, bits] = cidr.split('/');
  const mask = bits ? (~0 << (32 - +bits)) >>> 0 : 0xffffffff;
  return (ip4ToInt(ip) & mask) === (ip4ToInt(net) & mask);
}

function ip6Expand(ip) {
  if (!ip.includes('::')) return ip;
  const [left, right] = ip.split('::');
  const l = left ? left.split(':') : [];
  const r = right ? right.split(':') : [];
  return [...l, ...Array(8 - l.length - r.length).fill('0'), ...r].join(':');
}

function ip6ToBigInt(ip) {
  return ip6Expand(ip)
    .split(':')
    .reduce((n, g) => (n << 16n) | BigInt(parseInt(g || '0', 16)), 0n);
}

function cidr6Contains(cidr, ip) {
  const [net, bits] = cidr.split('/');
  const len  = BigInt(bits ?? 128);
  const mask = len === 0n ? 0n : (~0n << (128n - len)) & ((1n << 128n) - 1n);
  return (ip6ToBigInt(ip) & mask) === (ip6ToBigInt(net) & mask);
}

function cidrContains(cidr, ip) {
  try {
    return cidr.includes(':') ? cidr6Contains(cidr, ip) : cidr4Contains(cidr, ip);
  } catch {
    return false;
  }
}

// ─── Static fallback ranges ───────────────────────────────────────────────────
// Used when the live fetch from a provider fails.  Keep these updated
// periodically from each provider's official documentation.

const STATIC_RANGES = {
  // https://developers.google.com/static/search/apis/ipranges/googlebot.json
  google:      ['66.249.64.0/19', '66.249.80.0/20', '2001:4860::/32'],
  // https://learn.microsoft.com/en-us/bingbot/bingbot-ranges.txt
  bing:        ['157.55.39.0/24', '207.46.12.0/23', '40.77.167.0/24',
                '13.66.139.0/24', '13.67.10.16/28',  '52.167.144.0/24',
                '40.77.188.0/22', '40.77.202.0/24'],
  // https://openai.com/gptbot-ranges.txt
  openai:      ['20.171.207.16/28', '52.230.152.0/22',
                '40.83.2.64/28',    '13.65.240.240/28'],
  apple:       ['17.0.0.0/8'],
  baidu:       ['180.76.15.0/24', '119.63.196.0/22', '106.12.185.0/24'],
  duckduckgo:  ['72.94.249.32/27'],
  bytedance:   ['121.14.0.0/16', '163.177.0.0/16'],
  commoncrawl: ['66.249.64.0/19'],  // CCBot runs on Google infrastructure
  anthropic:   [],                  // No published ranges yet
  perplexity:  [],                  // No published ranges yet
};

// ─── Dynamic range sources ────────────────────────────────────────────────────

const RANGE_SOURCES = [
  {
    key:   'google',
    url:   'https://developers.google.com/static/search/apis/ipranges/googlebot.json',
    parse: (text) =>
      JSON.parse(text).prefixes
        .map(p => p.ipv4Prefix || p.ipv6Prefix)
        .filter(Boolean),
  },
  {
    key:   'openai',
    url:   'https://openai.com/gptbot-ranges.txt',
    parse: (text) =>
      text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')),
  },
];

const CACHE_TTL = 86400;                         // 24 hours
const CACHE_NS  = 'https://jcrt-bot-ip-ranges.internal/';

async function fetchRanges(source) {
  const cache    = await caches.open('bot-ip-ranges');
  const cacheKey = new Request(CACHE_NS + source.key);

  const hit = await cache.match(cacheKey);
  if (hit) return JSON.parse(await hit.text());

  try {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ranges = source.parse(await res.text());
    await cache.put(
      cacheKey,
      new Response(JSON.stringify(ranges), {
        headers: { 'Cache-Control': `public, max-age=${CACHE_TTL}` },
      }),
    );
    return ranges;
  } catch {
    return null;
  }
}

async function buildRangeMap() {
  const map = structuredClone(STATIC_RANGES);
  await Promise.all(
    RANGE_SOURCES.map(async (src) => {
      const ranges = await fetchRanges(src);
      if (ranges?.length) map[src.key] = ranges;
    }),
  );
  return map;
}

// ─── Bot registry ─────────────────────────────────────────────────────────────

const BOT_CONFIGS = [
  { name: 'Googlebot',        uaPattern: /googlebot|google-extended|adsbot-google|googleother/i, rangeKeys: ['google']      },
  { name: 'Claude-SearchBot', uaPattern: /claudebot|claude-searchbot|anthropic-ai/i,             rangeKeys: ['anthropic'],  uaOnly: true },
  { name: 'ChatGPT-User',     uaPattern: /chatgpt-user|oai-searchbot|gptbot/i,                   rangeKeys: ['openai']      },
  { name: 'BingBot',          uaPattern: /bingbot|msnbot/i,                                      rangeKeys: ['bing']        },
  { name: 'Applebot',         uaPattern: /applebot/i,                                            rangeKeys: ['apple']       },
  { name: 'Baiduspider',      uaPattern: /baiduspider/i,                                         rangeKeys: ['baidu']       },
  { name: 'DuckAssistBot',    uaPattern: /duckassistbot|duckduckbot/i,                           rangeKeys: ['duckduckgo']  },
  { name: 'Bytespider',       uaPattern: /bytespider/i,                                          rangeKeys: ['bytedance']   },
  { name: 'PerplexityBot',    uaPattern: /perplexitybot/i,                                       rangeKeys: ['perplexity'], uaOnly: true },
  { name: 'CCBot',            uaPattern: /ccbot/i,                                               rangeKeys: ['commoncrawl'] },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @typedef {{ allowed: boolean, botName: string|null, verified: boolean, uaOnly: boolean }} BotResult
 */

/**
 * Returns bot verification result for the given Worker request.
 * Always resolves — never throws.
 *
 * @param {Request} request
 * @returns {Promise<BotResult>}
 */
export async function verifyBot(request) {
  const ua  = request.headers.get('User-Agent') ?? '';
  const ip  = request.headers.get('CF-Connecting-IP') ?? '';
  const bot = BOT_CONFIGS.find(b => b.uaPattern.test(ua));

  if (!bot) return { allowed: false, botName: null, verified: false, uaOnly: false };

  if (bot.uaOnly || !ip) {
    return { allowed: true, botName: bot.name, verified: false, uaOnly: true };
  }

  try {
    const rangeMap = await buildRangeMap();
    const ranges   = bot.rangeKeys.flatMap(k => rangeMap[k] ?? []);

    if (!ranges.length) {
      return { allowed: true, botName: bot.name, verified: false, uaOnly: true };
    }

    const verified = ranges.some(cidr => cidrContains(cidr, ip));
    return { allowed: true, botName: bot.name, verified, uaOnly: false };
  } catch {
    // Never let verification failure block a legitimate crawl
    return { allowed: true, botName: bot.name, verified: false, uaOnly: true };
  }
}
