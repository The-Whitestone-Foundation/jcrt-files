#!/usr/bin/env node
/**
 * Generate RIS and CSL-JSON citation files for all JCRT archive and
 * Religious Theory articles.  Reads markdown frontmatter from a local
 * jcrt-v2 checkout and writes citation files into citations/ in this repo.
 *
 * Usage:
 *   node scripts/generate-citations.mjs [path/to/jcrt-v2]
 *
 * If no path is given, defaults to ../jcrt-v2 (sibling directory).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ── Constants ──────────────────────────────────────────────────────
const JOURNAL_TITLE = "Journal for Cultural & Religious Theory";
const JOURNAL_ABBR = "JCRT";
const PUBLISHER = "Whitestone Foundation";
const ISSN = "1530-5228";
const RT_TITLE = "Religious theory by JCRT";
const BASE_URL = "https://jcrt.org";

const REPO_ROOT = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname));
const FILES_ROOT = path.resolve(REPO_ROOT, "..");
const JCRT_V2_ROOT = process.argv[2]
	? path.resolve(process.argv[2])
	: path.resolve(FILES_ROOT, "..", "jcrt-v2");

const ARCHIVES_DIR = path.join(JCRT_V2_ROOT, "content", "archives");
const THEORY_POSTS_DIR = path.join(JCRT_V2_ROOT, "content", "religioustheory", "posts");
const OUT_ARCHIVES = path.join(FILES_ROOT, "citations", "archives");
const OUT_THEORY = path.join(FILES_ROOT, "citations", "religioustheory");
const LEGACY_DATE_PATH = path.join(JCRT_V2_ROOT, "_data", "legacy-ris-dates.json");

// ── Helpers ────────────────────────────────────────────────────────
function sha256(input) {
	return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function parseFrontMatter(content) {
	if (!content.startsWith("---")) return {};
	const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
	if (!match) return {};
	// Simple YAML parser for frontmatter (avoids js-yaml dependency)
	const obj = {};
	let currentKey = null;
	let currentArray = null;
	for (const line of match[1].split("\n")) {
		const arrayItem = line.match(/^\s+-\s+(.*)/);
		if (arrayItem && currentKey) {
			if (!currentArray) {
				currentArray = [];
				obj[currentKey] = currentArray;
			}
			currentArray.push(arrayItem[1].replace(/^["']|["']$/g, "").trim());
			continue;
		}
		const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)/);
		if (kv) {
			currentKey = kv[1];
			currentArray = null;
			let val = kv[2].trim();
			val = val.replace(/^["']|["']$/g, "");
			obj[currentKey] = val;
		}
	}
	return obj;
}

function splitAuthors(value) {
	if (!value) return [];
	if (Array.isArray(value)) return value.flatMap(splitAuthors);
	let s = String(value);
	if (s.includes(";")) return s.split(";").map((p) => p.trim()).filter(Boolean);
	if (/\s+and\s+/i.test(s)) return s.split(/\s+and\s+/i).map((p) => p.trim()).filter(Boolean);
	return [s.trim()].filter(Boolean);
}

function parseYear(data) {
	if (data?.year) { const m = String(data.year).match(/\d{4}/); if (m) return m[0]; }
	if (data?.date) { const d = new Date(data.date); if (!isNaN(d.getTime())) return String(d.getUTCFullYear()); }
	return "";
}

function parseSeason(data) { return String(data?.season || "").trim().toLowerCase(); }

function parsePages(pages) {
	const raw = String(pages || "").trim();
	if (!raw) return { sp: "", ep: "" };
	const norm = raw.replace(/\s+/g, "").replace(/[–—]/g, "-");
	const [sp = "", ep = ""] = norm.split("-", 2);
	return { sp, ep };
}

function normalizeNumStr(v) {
	const raw = String(v || "").trim();
	if (!raw) return "";
	const n = parseInt(raw, 10);
	return isNaN(n) ? raw : String(n);
}

function escRIS(v) { return String(v || "").replace(/\r?\n/g, " ").trim(); }

function parseAuthorName(author) {
	const raw = String(author || "").trim();
	if (!raw) return null;
	if (raw.includes(",")) {
		const [family, ...rest] = raw.split(",");
		return { family: family.trim(), given: rest.join(",").trim() };
	}
	const parts = raw.split(/\s+/);
	if (parts.length === 1) return { literal: raw };
	const family = parts.pop();
	return { family, given: parts.join(" ") };
}

function normalizeTitle(v) {
	return String(v || "").toLowerCase().normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
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

// ── RIS / CSL-JSON builders ────────────────────────────────────────
function makeArchiveRIS(e) {
	return [
		"TY  - JOUR", `TI  - ${escRIS(e.title)}`,
		...(e.authors.length ? e.authors.map((a) => `AU  - ${escRIS(a)}`) : ["AU  - "]),
		`T2  - ${JOURNAL_TITLE}`,
		`DA  - ${e.py ? `${e.py}/${e.season || "unknown"}//` : ""}`,
		`PY  - ${e.py || e.year}`, `VL  - ${escRIS(e.volume)}`, `IS  - ${escRIS(e.issue)}`,
		`C6  - ${escRIS(e.season)}`, `SP  - ${escRIS(e.sp)}`, `EP  - ${escRIS(e.ep)}`,
		`J2  - ${JOURNAL_ABBR}`, `PB  - ${PUBLISHER}`, `SN  - ${ISSN}`,
		`UR  - ${escRIS(e.url)}`, "ER  -",
	].join("\n") + "\n";
}

function makeArchiveCSL(e, id) {
	const obj = {
		id, type: "article-journal", title: e.title || id,
		"container-title": JOURNAL_TITLE, "short-container-title": JOURNAL_ABBR,
		publisher: PUBLISHER, ISSN, URL: e.url,
	};
	const al = e.authors.map(parseAuthorName).filter(Boolean);
	if (al.length) obj.author = al;
	if (e.py) obj.issued = { "date-parts": [[Number(e.py)]] };
	if (e.season) obj.season = e.season;
	if (e.volume) obj.volume = e.volume;
	if (e.issue) obj.issue = e.issue;
	if (e.sp && e.ep) obj.page = `${e.sp}-${e.ep}`;
	else if (e.sp) obj.page = e.sp;
	return JSON.stringify([obj], null, 2) + "\n";
}

function makeTheoryRIS(e) {
	return [
		"TY  - JOUR", `TI  - ${escRIS(e.title)}`,
		...(e.authors.length ? e.authors.map((a) => `AU  - ${escRIS(a)}`) : ["AU  - "]),
		`T2  - ${RT_TITLE}`,
		`DA  - ${e.year ? `${e.year}///` : ""}`,
		`PY  - ${e.year}`, "VL  - ", "IS  - ", "SP  - ", "EP  - ",
		`J2  - ${RT_TITLE}`, "PB  - ", "SN  - ",
		`UR  - ${escRIS(e.url)}`, "ER  -",
	].join("\n") + "\n";
}

function makeTheoryCSL(e, id) {
	const obj = {
		id, type: "article-journal", title: e.title || id,
		"container-title": RT_TITLE, URL: e.url,
	};
	const al = e.authors.map(parseAuthorName).filter(Boolean);
	if (al.length) obj.author = al;
	if (e.year) obj.issued = { "date-parts": [[Number(e.year)]] };
	return JSON.stringify([obj], null, 2) + "\n";
}

// ── Legacy date lookup (for archive RIS dates) ────────────────────
function loadLegacyDates() {
	try { return JSON.parse(fs.readFileSync(LEGACY_DATE_PATH, "utf8")); }
	catch { return null; }
}

function resolveLegacyDate(entry, lookup) {
	if (!lookup) return { py: "", da: "" };
	const key = [entry.volume || "", entry.issue || "", entry.sp || "", entry.ep || ""].join("|");
	const exact = lookup?.byVolIsSpEp?.[key];
	if (Array.isArray(exact) && exact.length > 0) {
		return { py: String(exact[0].py || "").trim(), da: String(exact[0].da || "").trim() };
	}
	const byTitle = lookup?.byTitle?.[normalizeTitle(entry.title)];
	if (!Array.isArray(byTitle) || byTitle.length === 0) return { py: "", da: "" };
	const scoped = byTitle.find((r) => String(r.vl || "") === String(entry.volume || "") && String(r.is || "") === String(entry.issue || ""));
	const hit = scoped || byTitle[0];
	return { py: String(hit.py || "").trim(), da: String(hit.da || "").trim() };
}

// ── Main ───────────────────────────────────────────────────────────
function generateArchiveCitations() {
	if (!fs.existsSync(ARCHIVES_DIR)) {
		console.log("[citations] Archives dir not found:", ARCHIVES_DIR);
		return { total: 0, generated: 0, skipped: 0 };
	}

	fs.mkdirSync(OUT_ARCHIVES, { recursive: true });
	const files = walkMd(ARCHIVES_DIR);
	const legacyLookup = loadLegacyDates();
	const issueMetaCache = new Map();
	let generated = 0, skipped = 0;

	function getIssueMeta(issueSlug) {
		if (issueMetaCache.has(issueSlug)) return issueMetaCache.get(issueSlug);
		const indexPath = path.join(ARCHIVES_DIR, issueSlug, "index.njk");
		let meta = {};
		try { meta = parseFrontMatter(fs.readFileSync(indexPath, "utf8")) || {}; }
		catch { meta = {}; }
		issueMetaCache.set(issueSlug, meta);
		return meta;
	}

	for (const filePath of files) {
		const rel = path.relative(ARCHIVES_DIR, filePath);
		const parts = rel.split(path.sep);
		if (parts.length < 2) continue;
		const issueSlug = parts[0];
		const fileSlug = path.basename(parts[parts.length - 1], ".md");
		if (!issueSlug.includes(".")) continue;
		if (fileSlug.toLowerCase() === "index") continue;

		const content = fs.readFileSync(filePath, "utf8");
		if (!content.startsWith("---")) continue;

		const data = parseFrontMatter(content);
		const issueMeta = getIssueMeta(issueSlug);

		const volume = normalizeNumStr(data.volume || issueMeta.volume || issueSlug.split(".")[0] || "");
		const issue = normalizeNumStr(data.issue || issueMeta.issue || issueSlug.split(".")[1] || "");
		const { sp, ep } = parsePages(data.pages);
		const year = parseYear(data) || parseYear(issueMeta);
		const season = parseSeason(data) || parseSeason(issueMeta);

		const pdfRaw = String(data.pdf || "").trim();
		let pdfUrl = "";
		if (pdfRaw) {
			pdfUrl = /^https?:\/\//i.test(pdfRaw) ? pdfRaw
				: pdfRaw.startsWith("/") ? `${BASE_URL}${pdfRaw}`
				: `${BASE_URL}/archives/${issueSlug}/${pdfRaw}`;
		}
		const pageUrl = `${BASE_URL}/archives/${issueSlug}/${fileSlug}/`;
		const url = pdfUrl || pageUrl;

		const entry = {
			title: String(data.title || fileSlug).trim(),
			authors: splitAuthors(data.author),
			year, volume, issue, season, sp, ep, url,
		};
		const legacyDate = resolveLegacyDate(entry, legacyLookup);
		entry.season = entry.season || "unknown";
		entry.py = year || legacyDate.py || String(new Date().getUTCFullYear());

		const issueOutDir = path.join(OUT_ARCHIVES, issueSlug);
		const risPath = path.join(issueOutDir, `${fileSlug}.ris`);
		const cslPath = path.join(issueOutDir, `${fileSlug}.csl.json`);

		// Check if output is already current (content hash)
		const sig = sha256(`${content}|${JSON.stringify(issueMeta)}`);
		if (fs.existsSync(risPath) && fs.existsSync(cslPath)) {
			const markerPath = path.join(issueOutDir, `.${fileSlug}.sig`);
			try {
				if (fs.readFileSync(markerPath, "utf8").trim() === sig) {
					skipped++;
					continue;
				}
			} catch { /* regenerate */ }
		}

		fs.mkdirSync(issueOutDir, { recursive: true });
		const citId = `archives-${issueSlug}-${fileSlug}`.replace(/[^a-zA-Z0-9_.-]/g, "-");
		fs.writeFileSync(risPath, makeArchiveRIS(entry), "utf8");
		fs.writeFileSync(cslPath, makeArchiveCSL(entry, citId), "utf8");
		// Write signature marker for incremental builds
		fs.writeFileSync(path.join(issueOutDir, `.${fileSlug}.sig`), sig, "utf8");
		generated++;
	}

	const total = generated + skipped;
	return { total, generated, skipped };
}

function generateTheoryCitations() {
	if (!fs.existsSync(THEORY_POSTS_DIR)) {
		console.log("[citations] Theory posts dir not found:", THEORY_POSTS_DIR);
		return { total: 0, generated: 0, skipped: 0 };
	}

	fs.mkdirSync(OUT_THEORY, { recursive: true });
	const files = fs.readdirSync(THEORY_POSTS_DIR, { withFileTypes: true })
		.filter((e) => e.isFile() && e.name.endsWith(".md"))
		.map((e) => path.join(THEORY_POSTS_DIR, e.name));

	let generated = 0, skipped = 0;

	for (const filePath of files) {
		const fileSlug = path.basename(filePath, ".md");
		const content = fs.readFileSync(filePath, "utf8");
		const data = parseFrontMatter(content);

		const risPath = path.join(OUT_THEORY, `${fileSlug}.ris`);
		const cslPath = path.join(OUT_THEORY, `${fileSlug}.csl.json`);

		const sig = sha256(content);
		if (fs.existsSync(risPath) && fs.existsSync(cslPath)) {
			const markerPath = path.join(OUT_THEORY, `.${fileSlug}.sig`);
			try {
				if (fs.readFileSync(markerPath, "utf8").trim() === sig) {
					skipped++;
					continue;
				}
			} catch { /* regenerate */ }
		}

		const entry = {
			title: String(data.title || fileSlug).trim(),
			authors: splitAuthors(data.author),
			year: parseYear(data),
			url: `${BASE_URL}/religioustheory/posts/${fileSlug}/`,
		};

		const citId = `religioustheory-${fileSlug}`.replace(/[^a-zA-Z0-9_.-]/g, "-");
		fs.writeFileSync(risPath, makeTheoryRIS(entry), "utf8");
		fs.writeFileSync(cslPath, makeTheoryCSL(entry, citId), "utf8");
		fs.writeFileSync(path.join(OUT_THEORY, `.${fileSlug}.sig`), sig, "utf8");
		generated++;
	}

	const total = generated + skipped;
	return { total, generated, skipped };
}

// ── Run ────────────────────────────────────────────────────────────
console.log(`[citations] Reading content from: ${JCRT_V2_ROOT}`);
console.log(`[citations] Writing citations to: ${path.join(FILES_ROOT, "citations")}`);

const archives = generateArchiveCitations();
console.log(`[citations] Archives: total=${archives.total}, generated=${archives.generated}, skipped=${archives.skipped}`);

const theory = generateTheoryCitations();
console.log(`[citations] Theory: total=${theory.total}, generated=${theory.generated}, skipped=${theory.skipped}`);

const totalGen = archives.generated + theory.generated;
if (totalGen > 0) {
	console.log(`[citations] ✅ Generated ${totalGen} new/updated citation files`);
} else {
	console.log("[citations] ✅ All citations up to date");
}
