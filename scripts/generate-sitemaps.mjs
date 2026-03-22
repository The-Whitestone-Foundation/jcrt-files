#!/usr/bin/env node
/**
 * Generate DOAJ article metadata, OAI-PMH Dublin Core, and citation
 * sitemaps from JCRT archive markdown frontmatter.
 *
 * Usage:
 *   node scripts/generate-sitemaps.mjs [path/to/jcrt-v2]
 *
 * Outputs (relative to repo root):
 *   metadata/doaj-archives.xml
 *   metadata/oai_dc.xml
 *   metadata/ris-sitemap.xml
 *   metadata/csl-json-sitemap.xml
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

// ── Paths ──────────────────────────────────────────────────────────
const REPO_ROOT = path.resolve(
	import.meta.dirname || path.dirname(new URL(import.meta.url).pathname),
	"..",
);
const JCRT_V2_ROOT = process.argv[2]
	? path.resolve(process.argv[2])
	: path.resolve(REPO_ROOT, "..", "jcrt-v2");

const ARCHIVES_DIR = path.join(JCRT_V2_ROOT, "content", "archives");
const CITATIONS_DIR = path.join(REPO_ROOT, "citations");
const OUT_DIR = path.join(REPO_ROOT, "metadata");

// ── Constants ──────────────────────────────────────────────────────
const BASE_URL = "https://jcrt.org";
const FILES_URL = "https://files.jcrt.org";
const ISSN_PLAIN = "15305228";
const ISSN_DASH = "1530-5228";
const PUBLISHER_DOAJ = "Whitestone Publications";
const PUBLISHER_OAI = "Whitestone Foundation";
const JOURNAL_TITLE_DOAJ = "The Journal for Cultural and Religious Theory";
const JOURNAL_TITLE_OAI = "Journal for Cultural &amp; Religious Theory";
const DOAJ_SKIP_SLUGS = new Set(["index", "author-bios", "table-of-contents", "abstracts"]);
const RIGHTS_TEXT =
	"Copyright held by the author(s). Articles are licensed under a Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License.";

// ── Helpers ────────────────────────────────────────────────────────
function parseFrontMatter(content) {
	if (!content.startsWith("---")) return null;
	const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
	if (!match) return null;
	try {
		return yaml.load(match[1]) || {};
	} catch {
		return {};
	}
}

function escXml(str) {
	return String(str || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function walkMd(dir) {
	const results = [];
	if (!fs.existsSync(dir)) return results;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
		if (entry.isFile() && entry.name.endsWith(".md")) {
			results.push(path.join(entry.parentPath || entry.path, entry.name));
		}
	}
	return results;
}

function normalizeNum(v) {
	const raw = String(v || "").trim();
	if (!raw) return "";
	const n = parseInt(raw, 10);
	return isNaN(n) ? raw : String(n);
}

function parsePages(pages) {
	const raw = String(pages || "").trim();
	if (!raw) return { sp: "", ep: "" };
	const norm = raw.replace(/\s+/g, "").replace(/[–—]/g, "-");
	const [sp = "", ep = ""] = norm.split("-", 2);
	return { sp, ep };
}

function splitAuthors(value) {
	if (!value) return [];
	if (Array.isArray(value)) return value.flatMap(splitAuthors);
	let s = String(value).trim();
	if (!s) return [];
	if (s.includes(";")) return s.split(";").map((p) => p.trim()).filter(Boolean);
	if (/,\s*/.test(s) && !s.match(/^[^,]+,\s*[A-Z][a-z]*\.?$/)) {
		// Comma-separated list (but not "Last, First" format)
		const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
		if (parts.length > 1) return parts;
	}
	if (/\s+and\s+/i.test(s)) return s.split(/\s+and\s+/i).map((p) => p.trim()).filter(Boolean);
	return [s];
}

function splitKeywords(value) {
	if (!value) return [];
	if (Array.isArray(value)) return value.map((k) => String(k).trim()).filter(Boolean);
	return String(value).split(",").map((k) => k.trim()).filter(Boolean);
}

function toISODate(dateVal) {
	if (!dateVal) return "";
	if (dateVal instanceof Date) {
		if (isNaN(dateVal.getTime())) return "";
		return dateVal.toISOString().slice(0, 10);
	}
	const d = new Date(dateVal);
	if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
	return "";
}

function issueSort(a, b) {
	const [av, ai] = a.issue.split(".").map(Number);
	const [bv, bi] = b.issue.split(".").map(Number);
	if (av !== bv) return av - bv;
	if (ai !== bi) return ai - bi;
	return a.slug.localeCompare(b.slug);
}

// ── Read all archive entries ───────────────────────────────────────
function readArchiveEntries() {
	if (!fs.existsSync(ARCHIVES_DIR)) {
		console.error("[sitemaps] Archives dir not found:", ARCHIVES_DIR);
		return [];
	}

	const issueMetaCache = new Map();
	function getIssueMeta(issueSlug) {
		if (issueMetaCache.has(issueSlug)) return issueMetaCache.get(issueSlug);
		const indexPath = path.join(ARCHIVES_DIR, issueSlug, "index.njk");
		let meta = {};
		try {
			meta = parseFrontMatter(fs.readFileSync(indexPath, "utf8")) || {};
		} catch {
			meta = {};
		}
		issueMetaCache.set(issueSlug, meta);
		return meta;
	}

	const entries = [];
	const files = walkMd(ARCHIVES_DIR);

	for (const filePath of files) {
		const rel = path.relative(ARCHIVES_DIR, filePath);
		const parts = rel.split(path.sep);
		if (parts.length < 2) continue;
		const issueSlug = parts[0];
		if (!issueSlug.includes(".")) continue;
		const fileSlug = path.basename(parts[parts.length - 1], ".md");

		let content;
		try {
			content = fs.readFileSync(filePath, "utf8");
		} catch {
			continue;
		}
		const data = parseFrontMatter(content);
		if (!data) continue;

		const issueMeta = getIssueMeta(issueSlug);
		const [dirVol, dirIss] = issueSlug.split(".");
		const volume = normalizeNum(data.volume || issueMeta.volume || dirVol);
		const issue = normalizeNum(data.issue || issueMeta.issue || dirIss);
		const { sp, ep } = parsePages(data.pages);
		const authors = splitAuthors(data.author);
		const keywords = splitKeywords(data.keywords);
		const description = String(data.description || data.abstract || "").trim();
		const title = String(data.title || "").trim();
		const pdfFile = String(data.pdf || "").trim();
		const sitemapIgnore = !!data.sitemapIgnore;

		// Resolve date
		let dateStr = toISODate(data.date);
		if (!dateStr && issueMeta.year) {
			dateStr = `${issueMeta.year}-01-01`;
		}
		if (!dateStr && data.year) {
			dateStr = `${data.year}-01-01`;
		}

		const canonicalUrl = `${BASE_URL}/archives/${issueSlug}/${fileSlug}/`;
		const pdfUrl = pdfFile
			? `${BASE_URL}/archives/${issueSlug}/${pdfFile}`
			: "";

		const published = data.published !== false;

		entries.push({
			issue: issueSlug,
			slug: fileSlug,
			title,
			authors,
			keywords,
			description,
			volume,
			issueNum: issue,
			sp,
			ep,
			dateStr,
			pdfFile,
			pdfUrl,
			canonicalUrl,
			sitemapIgnore,
			published,
		});
	}

	entries.sort(issueSort);
	return entries;
}

// ── DOAJ XML ───────────────────────────────────────────────────────
function generateDOAJ(entries) {
	const filtered = entries.filter((e) => {
		if (!e.published) return false;
		if (DOAJ_SKIP_SLUGS.has(e.slug.toLowerCase())) return false;
		if (!e.title) return false;
		return true;
	});

	const lines = [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<records xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
		`         xsi:noNamespaceSchemaLocation="https://jcrt.org/sitemaps/doajArticles.xsd">`,
	];

	for (const e of filtered) {
		lines.push(`  <record>`);
		lines.push(`    <language>eng</language>`);
		lines.push(`    <publisher>${escXml(PUBLISHER_DOAJ)}</publisher>`);
		lines.push(`    <journalTitle>${escXml(JOURNAL_TITLE_DOAJ)}</journalTitle>`);
		lines.push(`    <issn>${ISSN_PLAIN}</issn>`);
		lines.push(`    <publicationDate>${escXml(e.dateStr)}</publicationDate>`);
		lines.push(`    <volume>${escXml(e.volume)}</volume>`);
		lines.push(`    <issue>${escXml(e.issueNum)}</issue>`);
		lines.push(`    <startPage>${escXml(e.sp)}</startPage>`);
		lines.push(`    <endPage>${escXml(e.ep)}</endPage>`);
		lines.push(`    <publisherRecordId>${escXml(e.slug)}</publisherRecordId>`);
		lines.push(`    <documentType>article</documentType>`);
		lines.push(`    <title language="eng">${escXml(e.title)}</title>`);

		if (e.authors.length) {
			lines.push(`    <authors>`);
			for (const a of e.authors) {
				lines.push(`      <author><name>${escXml(a)}</name></author>`);
			}
			lines.push(`    </authors>`);
		}

		if (e.description) {
			lines.push(`    <abstract language="eng">${escXml(e.description)}</abstract>`);
		}

		lines.push(`    <fullTextUrl format="html">${escXml(e.canonicalUrl)}</fullTextUrl>`);

		if (e.keywords.length) {
			lines.push(`    <keywords language="eng">`);
			for (const kw of e.keywords) {
				lines.push(`      <keyword>${escXml(kw)}</keyword>`);
			}
			lines.push(`    </keywords>`);
		}

		lines.push(`  </record>`);
	}

	lines.push(`</records>`);
	return { xml: lines.join("\n") + "\n", count: filtered.length };
}

// ── OAI-PMH Dublin Core XML ───────────────────────────────────────
function generateOAI(entries) {
	const now = new Date().toISOString();
	const filtered = entries.filter((e) => {
		if (!e.published) return false;
		if (e.sitemapIgnore) return false;
		return true;
	});

	const lines = [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"`,
		`         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
		`         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">`,
		`  <responseDate>${escXml(now)}</responseDate>`,
		`  <request verb="ListRecords" metadataPrefix="oai_dc">https://jcrt.org/sitemaps/oai_dc.xml</request>`,
		`  <ListRecords>`,
	];

	for (const e of filtered) {
		const oaiId = `oai:jcrt.org:archives:${e.issue}:${e.slug}`;
		const datestamp = e.dateStr || now.slice(0, 10);

		lines.push(`    <record>`);
		lines.push(`      <header>`);
		lines.push(`        <identifier>${escXml(oaiId)}</identifier>`);
		lines.push(`        <datestamp>${escXml(datestamp)}</datestamp>`);
		lines.push(`      </header>`);
		lines.push(`      <metadata>`);
		lines.push(`        <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"`);
		lines.push(`                   xmlns:dc="http://purl.org/dc/elements/1.1/"`);
		lines.push(`                   xmlns:dcterms="http://purl.org/dc/terms/"`);
		lines.push(`                   xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">`);

		if (e.title) {
			lines.push(`          <dc:title>${escXml(e.title)}</dc:title>`);
		}
		for (const a of e.authors) {
			lines.push(`          <dc:creator>${escXml(a)}</dc:creator>`);
		}
		lines.push(`          <dc:publisher>${escXml(PUBLISHER_OAI)}</dc:publisher>`);
		if (datestamp) {
			lines.push(`          <dc:date>${escXml(datestamp)}</dc:date>`);
		}
		lines.push(`          <dc:type>article</dc:type>`);
		lines.push(`          <dc:format>text/html</dc:format>`);
		lines.push(`          <dc:language>en</dc:language>`);
		lines.push(`          <dc:identifier>${ISSN_DASH}</dc:identifier>`);
		lines.push(`          <dc:identifier>${escXml(e.canonicalUrl)}</dc:identifier>`);
		// Link to canonical page (with trailing slash)
		lines.push(`          <dc:identifier.uri>${escXml(e.canonicalUrl)}</dc:identifier.uri>`);
		if (e.pdfUrl) {
			lines.push(`          <dc:relation>${escXml(e.pdfUrl)}</dc:relation>`);
		}
		if (e.description) {
			lines.push(`          <dc:description>${escXml(e.description)}</dc:description>`);
		}
		for (const kw of e.keywords) {
			lines.push(`          <dc:subject>${escXml(kw)}</dc:subject>`);
		}
		lines.push(`          <dc:rights>${escXml(RIGHTS_TEXT)}</dc:rights>`);
		lines.push(`          <dc:source>${JOURNAL_TITLE_OAI}, ISSN ${ISSN_DASH}</dc:source>`);
		// Volume / issue / pages
		if (e.volume) {
			lines.push(`          <dcterms:bibliographicCitation>Vol. ${escXml(e.volume)}${e.issueNum ? ", No. " + escXml(e.issueNum) : ""}${e.sp ? ", pp. " + escXml(e.sp) + (e.ep ? "-" + escXml(e.ep) : "") : ""}</dcterms:bibliographicCitation>`);
		}

		lines.push(`        </oai_dc:dc>`);
		lines.push(`      </metadata>`);
		lines.push(`    </record>`);
	}

	lines.push(`  </ListRecords>`);
	lines.push(`</OAI-PMH>`);
	return { xml: lines.join("\n") + "\n", count: filtered.length };
}

// ── Citation sitemaps ──────────────────────────────────────────────
function walkCitationFiles(baseDir, ext) {
	const results = [];
	if (!fs.existsSync(baseDir)) return results;
	for (const entry of fs.readdirSync(baseDir, { withFileTypes: true, recursive: true })) {
		if (entry.isFile() && entry.name.endsWith(ext)) {
			const full = path.join(entry.parentPath || entry.path, entry.name);
			results.push(path.relative(baseDir, full));
		}
	}
	results.sort();
	return results;
}

function generateCitationSitemap(ext) {
	const files = walkCitationFiles(CITATIONS_DIR, ext);
	const lines = [
		`<?xml version="1.0" encoding="utf-8"?>`,
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
	];
	for (const rel of files) {
		const url = `${FILES_URL}/citations/${rel.replace(/\\/g, "/")}`;
		lines.push(`  <url><loc>${escXml(url)}</loc></url>`);
	}
	lines.push(`</urlset>`);
	return { xml: lines.join("\n") + "\n", count: files.length };
}

// ── Main ───────────────────────────────────────────────────────────
console.log(`[sitemaps] Reading archives from: ${ARCHIVES_DIR}`);
console.log(`[sitemaps] Reading citations from: ${CITATIONS_DIR}`);
console.log(`[sitemaps] Writing output to:      ${OUT_DIR}`);

fs.mkdirSync(OUT_DIR, { recursive: true });

const entries = readArchiveEntries();
console.log(`[sitemaps] Found ${entries.length} archive entries`);

const doaj = generateDOAJ(entries);
fs.writeFileSync(path.join(OUT_DIR, "doaj-archives.xml"), doaj.xml, "utf8");
console.log(`[sitemaps] ✅ doaj-archives.xml — ${doaj.count} records`);

const oai = generateOAI(entries);
fs.writeFileSync(path.join(OUT_DIR, "oai_dc.xml"), oai.xml, "utf8");
console.log(`[sitemaps] ✅ oai_dc.xml — ${oai.count} records`);

const ris = generateCitationSitemap(".ris");
fs.writeFileSync(path.join(OUT_DIR, "ris-sitemap.xml"), ris.xml, "utf8");
console.log(`[sitemaps] ✅ ris-sitemap.xml — ${ris.count} URLs`);

const csl = generateCitationSitemap(".csl.json");
fs.writeFileSync(path.join(OUT_DIR, "csl-json-sitemap.xml"), csl.xml, "utf8");
console.log(`[sitemaps] ✅ csl-json-sitemap.xml — ${csl.count} URLs`);

console.log(`[sitemaps] Done.`);
