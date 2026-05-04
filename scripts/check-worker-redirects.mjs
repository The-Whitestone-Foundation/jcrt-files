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
]);

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
    async list({ prefix = "" } = {}) {
      return {
        objects: [...TRACKED_KEYS]
          .filter((key) => key.startsWith(prefix))
          .map((key) => ({ key })),
        truncated: false,
      };
    },
  },
};

const cases = [
  {
    name: "citation case mismatch",
    path: "/citations/archives/19.2/McAvan.csl.json",
    status: 301,
    location: "https://files.jcrt.org/citations/archives/19.2/mcavan.csl.json",
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
  },
  {
    name: "PDF canonical link header",
    path: "/archives/03.1/anderson.pdf",
    status: 200,
    link: '<https://files.jcrt.org/archives/03.1/anderson.pdf>; rel="canonical"',
  },
  {
    name: "true missing file",
    path: "/citations/archives/99.9/not-real.ris",
    status: 404,
  },
  {
    name: "bare files host",
    path: "/",
    status: 410,
  },
];

const failures = [];

for (const testCase of cases) {
  const request = new Request(`https://files.jcrt.org${testCase.path}`, { method: "GET" });
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
}

if (failures.length > 0) {
  console.error("Worker redirect validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Verified ${cases.length} worker redirect and fallback scenarios.`);
