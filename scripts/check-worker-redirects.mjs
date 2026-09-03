import worker from "../src/worker.js";

const TRACKED_KEYS = new Set([
  "citations/archives/19.2/mcavan.csl.json",
  "citations/archives/23.1/prewitt_davis.ris",
  "citations/archives/22.2/keller_raschke.ris",
  "citations/archives/22.1/gaetano.csl.json",
  "citations/archives/22.1/westin_sedmak.ris",
  "citations/archives/17.2/hagedorn_staudigl.ris",
  "citations/archives/14.1/featherston.csl.json",
  "citations/archives/18.1/cook.ris",
  "citations/archives/09.2/d'amato.csl.json",
  "archives/03.1/anderson.pdf",
  "metadata/archives/24.2/introduction/metadata.json",
  "images/logos/site.webmanifest",
  "citations/archives/08.3/keller.ris",
  "sitemaps/index.xml",
  "sitemaps/style.xsl",
  "images/2016/01/adam.webp",
  "archives/10.2/scan1.jpg",
]);

const listCalls = [];
const env = {
  JCRT_FILES: {
    async get(key) {
      if (!TRACKED_KEYS.has(key)) return null;
      return {
        body: "ok",
        httpEtag: `"${key}"`,
        size: 2,
        writeHttpMetadata(headers) {
          headers.set("content-type", "application/octet-stream");
        },
      };
    },
    async list({ prefix = "", delimiter } = {}) {
      listCalls.push({ prefix, delimiter });
      if (delimiter !== "/") throw new Error("R2 fallback list must be directory-bounded");
      return {
        objects: [...TRACKED_KEYS]
          .filter((key) => key.startsWith(prefix))
          .filter((key) => !key.slice(prefix.length).includes(delimiter))
          .map((key) => ({ key })),
        truncated: false,
      };
    },
  },
};

// The worker's image-variant path calls fetch() back through the zone with
// cf.image options. Stub it: record the subrequest, and let each case choose
// how the edge responds (ok / non-2xx / throw = zone without transformations).
const subrequests = [];
let subrequestMode = "ok";
globalThis.fetch = async (input, init = {}) => {
  subrequests.push({ url: String(input), cf: init.cf, method: init.method });
  if (subrequestMode === "throw") throw new Error("image resizing unavailable");
  if (subrequestMode === "fail") return new Response("upstream error", { status: 503 });
  return new Response("transformed-bytes", {
    status: 200,
    headers: { "content-type": "image/webp", "cf-resized": "internal=ok/m" },
  });
};

const cases = [
  {
    // A real file whose stem collides with a legacy alias from another issue must be
    // served, not redirected into the alias target that only exists in 22.2.
    name: "real keller.ris is not shadowed by the legacy alias",
    path: "/citations/archives/08.3/keller.ris",
    status: 200,
    listCalls: 0,
  },
  {
    name: "root sitemap.xml serves the sitemap index",
    path: "/sitemap.xml",
    status: 200,
    contentType: "application/xml; charset=utf-8",
  },
  {
    name: "sitemap stylesheet content type",
    path: "/sitemaps/style.xsl",
    status: 200,
    contentType: "text/xsl; charset=utf-8",
  },
  {
    name: "robots.txt advertises the root sitemap",
    path: "/robots.txt",
    status: 200,
    bodyIncludes: "Sitemap: https://files.jcrt.org/sitemap.xml",
  },
  {
    name: "citation case mismatch",
    path: "/citations/archives/19.2/McAvan.csl.json",
    status: 301,
    location: "https://files.jcrt.org/citations/archives/19.2/mcavan.csl.json",
    listCalls: 1,
  },
  {
    name: "legacy Prewitt-Davis citation",
    path: "/citations/archives/23.1/Prewitt-Davis.ris",
    status: 301,
    location: "https://files.jcrt.org/citations/archives/23.1/prewitt_davis.ris",
  },
  {
    name: "legacy Keller citation",
    path: "/citations/archives/22.2/Keller.ris",
    status: 301,
    location: "https://files.jcrt.org/citations/archives/22.2/keller_raschke.ris",
  },
  {
    name: "legacy Degaetano citation",
    path: "/citations/archives/22.1/Degaetano.csl.json",
    status: 301,
    location: "https://files.jcrt.org/citations/archives/22.1/gaetano.csl.json",
  },
  {
    name: "legacy Westin citation",
    path: "/citations/archives/22.1/Westin.ris",
    status: 301,
    location: "https://files.jcrt.org/citations/archives/22.1/westin_sedmak.ris",
  },
  {
    name: "legacy Hagedorn-and-Staudigl citation",
    path: "/citations/archives/17.2/Hagedorn-and-Staudigl.ris",
    status: 301,
    location: "https://files.jcrt.org/citations/archives/17.2/hagedorn_staudigl.ris",
  },
  {
    name: "legacy featherstone citation",
    path: "/citations/archives/14.1/featherstone.csl.json",
    status: 301,
    location: "https://files.jcrt.org/citations/archives/14.1/featherston.csl.json",
  },
  {
    name: "legacy Cook1 citation",
    path: "/citations/archives/18.1/Cook1.ris",
    status: 301,
    location: "https://files.jcrt.org/citations/archives/18.1/cook.ris",
  },
  {
    name: "HTML entity apostrophe citation",
    path: "/citations/archives/09.2/d&apos;amato.csl.json",
    status: 200,
  },
  {
    name: "PDF case mismatch",
    path: "/archives/03.1/Anderson.pdf",
    status: 301,
    location: "https://files.jcrt.org/archives/03.1/anderson.pdf",
    listCalls: 1,
  },
  {
    name: "PDF canonical link header",
    path: "/archives/03.1/anderson.pdf",
    status: 200,
    link: '<https://files.jcrt.org/archives/03.1/anderson.pdf>; rel="canonical"',
  },
  {
    name: "metadata JSON-LD content type",
    path: "/metadata/archives/24.2/introduction/metadata.json",
    status: 200,
    contentType: "application/ld+json; charset=utf-8",
  },
  {
    name: "manifest allows deploy-preview CORS",
    path: "/images/logos/site.webmanifest",
    origin: "https://6a4f26f9215a240008997215--jcrt.netlify.app",
    status: 200,
    contentType: "application/manifest+json; charset=utf-8",
    cors: "*",
  },
  {
    name: "missing metadata returns JSON 404",
    path: "/metadata/archives/99.9/not-real/metadata.json",
    status: 404,
    contentType: "application/json; charset=utf-8",
  },
  {
    name: "true missing file",
    path: "/citations/archives/99.9/not-real.ris",
    status: 404,
    listCalls: 1,
  },
  {
    name: "root-level miss does not scan the bucket",
    path: "/favicon.ico",
    status: 404,
    listCalls: 1,
  },
  {
    name: "indexing bot gets only the synchronous allow marker",
    path: "/archives/03.1/anderson.pdf",
    requestHeaders: { "User-Agent": "Googlebot" },
    status: 200,
    botAllowed: true,
  },
  {
    name: "bare files host",
    path: "/",
    status: 410,
  },
  {
    name: "image transform issues a scale-down cf.image subrequest",
    path: "/images/2016/01/adam.webp?w=800&h=600&f=webp&q=70",
    status: 200,
    contentType: "image/webp",
    cacheControl: "public, max-age=31536000, immutable",
    subrequestUrl: "https://files.jcrt.org/images/2016/01/adam.webp",
    subrequestCf: { fit: "scale-down", quality: 70, width: 800, height: 600, format: "webp" },
  },
  {
    name: "image transform defaults quality to 85",
    path: "/images/2016/01/adam.webp?w=400",
    status: 200,
    subrequestCf: { fit: "scale-down", quality: 85, width: 400 },
  },
  {
    name: "f=auto varies on Accept",
    path: "/images/2016/01/adam.webp?f=auto",
    status: 200,
    vary: "Accept",
    subrequestCf: { fit: "scale-down", quality: 85, format: "auto" },
  },
  {
    name: "non-image path ignores transform params",
    path: "/archives/03.1/anderson.pdf?w=800&f=webp",
    status: 200,
    contentType: "application/pdf",
    cacheControl: "public, max-age=3600, s-maxage=86400",
    link: '<https://files.jcrt.org/archives/03.1/anderson.pdf>; rel="canonical"',
    noSubrequest: true,
  },
  {
    // Raster, but outside images/ — archives/10.2/scan1.jpg is a real key.
    // Transforms are scoped to the images/ prefix; everything else serves untouched.
    name: "raster outside images/ ignores transform params",
    path: "/archives/10.2/scan1.jpg?w=800&f=webp",
    status: 200,
    contentType: "image/jpeg",
    noSubrequest: true,
  },
  {
    name: "non-raster image path ignores transform params",
    path: "/images/logos/site.webmanifest?w=800",
    status: 200,
    contentType: "application/manifest+json; charset=utf-8",
    noSubrequest: true,
  },
  {
    name: "image with no params is served straight from R2",
    path: "/images/2016/01/adam.webp",
    status: 200,
    contentType: "image/webp",
    noSubrequest: true,
  },
  {
    name: "invalid transform params are ignored",
    path: "/images/2016/01/adam.webp?w=abc&q=999&f=tiff",
    status: 200,
    contentType: "image/webp",
    noSubrequest: true,
  },
  {
    name: "resizing subrequest bypasses the transform path",
    path: "/images/2016/01/adam.webp?w=800",
    requestHeaders: { via: "1.1 image-resizing" },
    status: 200,
    contentType: "image/webp",
    noSubrequest: true,
  },
  {
    name: "transform failure degrades to the original",
    path: "/images/2016/01/adam.webp?w=800",
    subrequestMode: "throw",
    status: 200,
    contentType: "image/webp",
  },
  {
    name: "non-2xx transform degrades to the original",
    path: "/images/2016/01/adam.webp?w=800",
    subrequestMode: "fail",
    status: 200,
    contentType: "image/webp",
  },
];

const failures = [];

for (const testCase of cases) {
  subrequests.length = 0;
  listCalls.length = 0;
  subrequestMode = testCase.subrequestMode ?? "ok";

  const request = new Request(`https://files.jcrt.org${testCase.path}`, {
    method: "GET",
    headers: { ...(testCase.origin ? { Origin: testCase.origin } : {}), ...(testCase.requestHeaders ?? {}) },
  });
  const response = await worker.fetch(request, env);

  if (response.status !== testCase.status) {
    failures.push(`${testCase.name}: expected ${testCase.status}, got ${response.status}`);
    continue;
  }

  if (testCase.location) {
    const actual = response.headers.get("location");
    if (actual !== testCase.location) {
      failures.push(`${testCase.name}: expected ${testCase.location}, got ${actual || "<none>"}`);
    }
  }

  if (testCase.link) {
    const actual = response.headers.get("link");
    if (actual !== testCase.link) {
      failures.push(`${testCase.name}: expected Link ${testCase.link}, got ${actual || "<none>"}`);
    }
  }

  if (testCase.contentType) {
    const actual = response.headers.get("content-type");
    if (actual !== testCase.contentType) {
      failures.push(`${testCase.name}: expected Content-Type ${testCase.contentType}, got ${actual || "<none>"}`);
    }
  }

  if (testCase.bodyIncludes) {
    const body = await response.text();
    if (!body.includes(testCase.bodyIncludes)) {
      failures.push(`${testCase.name}: body missing ${JSON.stringify(testCase.bodyIncludes)}`);
    }
  }

  if (testCase.cors) {
    const actual = response.headers.get("access-control-allow-origin");
    if (actual !== testCase.cors) {
      failures.push(`${testCase.name}: expected CORS ${testCase.cors}, got ${actual || "<none>"}`);
    }
  }

  if (testCase.listCalls !== undefined && listCalls.length !== testCase.listCalls) {
    failures.push(`${testCase.name}: expected ${testCase.listCalls} R2 list call(s), got ${listCalls.length}`);
  }

  if (testCase.botAllowed) {
    if (response.headers.get("x-bot-allowed") !== "true") {
      failures.push(`${testCase.name}: expected x-bot-allowed: true`);
    }
    for (const removed of ["x-bot-name", "x-bot-verified"]) {
      if (response.headers.has(removed)) failures.push(`${testCase.name}: unexpected ${removed} header`);
    }
  }

  if (testCase.cacheControl) {
    const actual = response.headers.get("cache-control");
    if (actual !== testCase.cacheControl) {
      failures.push(`${testCase.name}: expected Cache-Control ${testCase.cacheControl}, got ${actual || "<none>"}`);
    }
  }

  if (testCase.vary) {
    const actual = response.headers.get("vary") ?? "";
    if (!actual.includes(testCase.vary)) {
      failures.push(`${testCase.name}: expected Vary to include ${testCase.vary}, got ${actual || "<none>"}`);
    }
  }

  if (testCase.noSubrequest) {
    if (subrequests.length !== 0) {
      failures.push(`${testCase.name}: expected no subrequest, got ${subrequests[0]?.url}`);
    }
  }

  if (testCase.subrequestCf) {
    if (subrequests.length !== 1) {
      failures.push(`${testCase.name}: expected 1 subrequest, got ${subrequests.length}`);
    } else if (JSON.stringify(subrequests[0].cf?.image) !== JSON.stringify(testCase.subrequestCf)) {
      failures.push(
        `${testCase.name}: expected cf.image ${JSON.stringify(testCase.subrequestCf)}, got ${JSON.stringify(subrequests[0].cf?.image)}`,
      );
    }
  }

  if (testCase.subrequestUrl) {
    const actual = subrequests[0]?.url;
    if (actual !== testCase.subrequestUrl) {
      failures.push(`${testCase.name}: expected subrequest URL ${testCase.subrequestUrl}, got ${actual || "<none>"}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Worker redirect validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Verified ${cases.length} worker redirect and fallback scenarios.`);
