#!/usr/bin/env node
/**
 * Generate JSON-LD metadata.json files for all JCRT archive and Religious
 * Theory articles. Reads markdown frontmatter from a local jcrt-v2 checkout
 * (via js-yaml, since the nested `subjects:` list-of-maps can't be parsed
 * by the simple frontmatter parser in scripts/lib/content-entries.mjs) and
 * writes metadata/<section>/<slug>/metadata.json files into this repo.
 *
 * Usage:
 *   node scripts/generate-metadata.mjs [path/to/jcrt-v2] [--archives-only|--theory-only] [--force] [--dry-run]
 *
 * If no path is given, defaults to ../jcrt-v2 (sibling directory).
 *
 * SAFETY: by default this script writes metadata.json ONLY where one does
 * not already exist -- existing files may carry manual curation and must
 * never be clobbered by a routine run. Pass --force to regenerate
 * everything anyway (local-only escape hatch; never used in CI). Pass
 * --dry-run to list what would be written without touching disk.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { archiveEntries, theoryEntries, splitAuthors } from "./lib/content-entries.mjs";

// ── Constants ──────────────────────────────────────────────────────
const OG_IMAGE = "https://files.jcrt.org/images/jcrt-open-graph.webp";
const FAST_SET = "https://id.worldcat.org/fast/";
const PUBLISHER = { "@type": "Organization", "name": "Whitestone Publications", "url": "https://thewhitestonefoundation.org/" };
const PERIODICAL = { "@type": "Periodical", "name": "The Journal for Cultural and Religious Theory", "url": "https://jcrt.org", "issn": "1530-5228" };
const BLOG = { "@type": "Blog", "@id": "https://jcrt.org/religioustheory/", "name": "Religious Theory", "url": "https://jcrt.org/religioustheory/" };
const RIGHTS = "Copyright held by the author(s). Published in the Journal for Cultural and Religious Theory.";
const RIGHTS_URL = "https://jcrt.org/copyright/";

const CLI_ARGS = process.argv.slice(2);
const FLAG_ARGS = new Set(CLI_ARGS.filter((arg) => arg.startsWith("--")));
const PATH_ARG = CLI_ARGS.find((arg) => !arg.startsWith("--"));

const REPO_ROOT = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname));
const FILES_ROOT = path.resolve(REPO_ROOT, "..");
const JCRT_V2_ROOT = PATH_ARG
	? path.resolve(PATH_ARG)
	: path.resolve(FILES_ROOT, "..", "jcrt-v2");
const RUN_ARCHIVES = !FLAG_ARGS.has("--theory-only");
const RUN_THEORY = !FLAG_ARGS.has("--archives-only");
const FORCE = FLAG_ARGS.has("--force");
const DRY_RUN = FLAG_ARGS.has("--dry-run");

// ── Helpers ────────────────────────────────────────────────────────

// Full YAML parse of a file's frontmatter block (handles nested maps, e.g.
// `subjects:`, which scripts/lib/content-entries.mjs's simple parser can't).
function parseYaml(content) {
	if (!content.startsWith("---")) return {};
	const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
	if (!match) return {};
	return yaml.load(match[1]) || {};
}

function nameKey(value) {
	return String(value || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const authorIdentifiers = new Map();
for (const name of fs.readdirSync(path.join(JCRT_V2_ROOT, "content", "authors")).filter((name) => name.endsWith(".md"))) {
	const data = parseYaml(fs.readFileSync(path.join(JCRT_V2_ROOT, "content", "authors", name), "utf8"));
	const identifiers = [];
	const orcid = String(data.orcid || "").match(/(?:orcid\.org\/)?(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i)?.[1];
	if (orcid) identifiers.push({ "@type": "PropertyValue", propertyID: "ORCID", value: orcid, url: `https://orcid.org/${orcid}` });
	for (const value of Array.isArray(data.sameAs) ? data.sameAs : []) {
		const isni = String(value).match(/isni\.org\/isni\/([\dX]+)/i)?.[1];
		if (isni) identifiers.push({ "@type": "PropertyValue", propertyID: "ISNI", value: isni, url: `https://isni.org/isni/${isni}` });
	}
	if (identifiers.length && data.name) authorIdentifiers.set(nameKey(data.name), identifiers);
}

function parseYear(data) {
	if (data?.year) { const m = String(data.year).match(/\d{4}/); if (m) return m[0]; }
	if (data?.date) { const d = new Date(data.date); if (!isNaN(d.getTime())) return String(d.getUTCFullYear()); }
	return "";
}

function parseDateParts(data) {
	if (data?.date) {
		const d = new Date(data.date);
		if (!isNaN(d.getTime())) return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
	}
	const year = parseYear(data);
	return year ? [Number(year)] : [];
}

function pad2(n) { return String(n).padStart(2, "0"); }

// YYYY-MM-DD from front-matter `date`; falls back to the issue index.njk
// front matter (archives only), then to `${year}-01-01`, exactly the
// fallback chain generate-citations.mjs uses for its RIS/CSL dates.
function resolveDateStr(data, issueMeta) {
	const own = parseDateParts(data);
	if (own.length === 3) return `${own[0]}-${pad2(own[1])}-${pad2(own[2])}`;
	const fromIssue = parseDateParts(issueMeta);
	if (fromIssue.length === 3) return `${fromIssue[0]}-${pad2(fromIssue[1])}-${pad2(fromIssue[2])}`;
	const year = parseYear(data) || parseYear(issueMeta);
	return year ? `${year}-01-01` : "";
}

function authorsOf(data) {
	return splitAuthors(data.author).map((name) => {
		const identifiers = authorIdentifiers.get(nameKey(name));
		return {
			"@type": "Person",
			"name": name,
			...(identifiers ? { identifier: identifiers, sameAs: identifiers.map(({ url }) => url) } : {}),
		};
	});
}

// DefinedTerm array from front-matter `subjects:`; undefined when absent
// (the `about` key is omitted entirely rather than emitted empty).
function aboutOf(data) {
	const subjects = Array.isArray(data.subjects) ? data.subjects : [];
	if (!subjects.length) return undefined;
	return subjects.map((s) => ({
		"@type": "DefinedTerm",
		"name": s.label,
		"termCode": s.identifier,
		"url": s.uri,
		"inDefinedTermSet": FAST_SET,
		"additionalProperty": { "@type": "PropertyValue", "name": "authority category", "value": s.category },
	}));
}

function strOrEmpty(v) { return String(v ?? "").trim(); }

// Front matter sometimes sets `pdf: false` (YAML boolean, not a filename)
// to explicitly mark "no PDF" -- mirrors jcrt-v2's own pdfUrl computed
// field (posts.11tydata.js), which only trusts a string value.
function pdfFilename(v) { return typeof v === "string" && v.trim() ? v.trim() : ""; }

// ── JSON-LD builders ───────────────────────────────────────────────

function buildArchiveMetadata(entry, data) {
	const dateStr = resolveDateStr(data, entry.issueMeta);
	const title = strOrEmpty(data.title) || entry.fileSlug;
	const description = strOrEmpty(data.description);
	const nanoid = strOrEmpty(data.nanoid);
	const pdf = pdfFilename(data.pdf);
	const about = aboutOf(data);
	const volume = data.volume ?? entry.issueMeta?.volume ?? entry.issueSlug.split(".")[0] ?? "";
	const issue = data.issue ?? entry.issueMeta?.issue ?? entry.issueSlug.split(".")[1] ?? "";

	return {
		"@context": "https://schema.org",
		"@type": "ScholarlyArticle",
		"@id": `${entry.pageUrl}#article`,
		"name": title,
		"headline": title,
		"description": description,
		"url": entry.pageUrl,
		"inLanguage": "en",
		"datePublished": dateStr,
		"dateModified": dateStr,
		"copyrightNotice": RIGHTS,
		"license": RIGHTS_URL,
		"image": OG_IMAGE,
		"author": authorsOf(data),
		"publisher": PUBLISHER,
		"mainEntityOfPage": { "@type": "WebPage", "@id": entry.pageUrl },
		"abstract": strOrEmpty(data.abstract) || description,
		"isPartOf": PERIODICAL,
		...(nanoid ? { identifier: nanoid } : {}),
		"volumeNumber": String(volume),
		"issueNumber": String(issue),
		"pagination": strOrEmpty(data.pages),
		...(pdf
			? { encoding: { "@type": "MediaObject", "encodingFormat": "application/pdf", "contentUrl": `https://files.jcrt.org/archives/${entry.issueSlug}/${pdf}` } }
			: {}),
		...(about ? { about } : {}),
	};
}

function buildTheoryMetadata(entry, data) {
	const dateStr = resolveDateStr(data, null);
	const title = strOrEmpty(data.title) || entry.fileSlug;
	const description = strOrEmpty(data.description);
	const nanoid = strOrEmpty(data.nanoid);
	const image = data.image ? `https://jcrt.org${data.image}` : OG_IMAGE;
	const about = aboutOf(data);

	return {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		"@id": `${entry.pageUrl}#article`,
		"name": title,
		"headline": title,
		"description": description,
		"url": entry.pageUrl,
		"inLanguage": "en",
		"datePublished": dateStr,
		"dateModified": dateStr,
		"image": image,
		"author": authorsOf(data),
		"publisher": PUBLISHER,
		"mainEntityOfPage": { "@type": "WebPage", "@id": entry.pageUrl },
		"isPartOf": BLOG,
		...(nanoid ? { identifier: nanoid } : {}),
		...(about ? { about } : {}),
	};
}

// ── Main ───────────────────────────────────────────────────────────

function processSection(entries, buildFn) {
	let written = 0, skippedExisting = 0;
	const plannedWrites = [];

	for (const entry of entries) {
		const outDir = path.join(FILES_ROOT, entry.metadataDir);
		const outPath = path.join(outDir, "metadata.json");
		const exists = fs.existsSync(outPath);
		if (exists && !FORCE) { skippedExisting++; continue; }

		const data = parseYaml(entry.content);
		const obj = buildFn(entry, data);
		const json = JSON.stringify(obj, null, 2) + "\n";

		if (DRY_RUN) {
			console.log(`[metadata] would write: ${path.relative(FILES_ROOT, outPath)}`);
			plannedWrites.push(outPath);
			continue;
		}

		fs.mkdirSync(outDir, { recursive: true });
		fs.writeFileSync(outPath, json, "utf8");
		written++;
	}

	const total = DRY_RUN ? plannedWrites.length + skippedExisting : written + skippedExisting;
	return { total, written: DRY_RUN ? plannedWrites.length : written, skippedExisting };
}

console.log(`[metadata] Reading content from: ${JCRT_V2_ROOT}`);
console.log(`[metadata] Writing metadata to: ${path.join(FILES_ROOT, "metadata")}`);
if (DRY_RUN) console.log("[metadata] --dry-run: no files will be written");
if (FORCE) console.log("[metadata] --force: existing metadata.json files WILL be overwritten");

const archives = RUN_ARCHIVES ? processSection(archiveEntries(JCRT_V2_ROOT), buildArchiveMetadata) : { total: 0, written: 0, skippedExisting: 0 };
if (RUN_ARCHIVES) {
	console.log(`[metadata] Archives: total=${archives.total}, written=${archives.written}, skipped(existing)=${archives.skippedExisting}`);
}

const theory = RUN_THEORY ? processSection(theoryEntries(JCRT_V2_ROOT), buildTheoryMetadata) : { total: 0, written: 0, skippedExisting: 0 };
if (RUN_THEORY) {
	console.log(`[metadata] Theory: total=${theory.total}, written=${theory.written}, skipped(existing)=${theory.skippedExisting}`);
}

const totalWritten = archives.written + theory.written;
if (DRY_RUN) {
	console.log(`[metadata] ✅ Dry run: ${totalWritten} file(s) would be written`);
} else if (totalWritten > 0) {
	console.log(`[metadata] ✅ Wrote ${totalWritten} new metadata.json file(s)`);
} else {
	console.log("[metadata] ✅ All metadata.json files already present (nothing to do; use --force to regenerate)");
}
