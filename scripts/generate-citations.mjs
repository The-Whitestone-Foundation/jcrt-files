#!/usr/bin/env node
/**
 * Generate RIS, BibTeX and CSL-JSON citation files for all JCRT archive and
 * Religious Theory articles.  Reads markdown frontmatter from a local
 * jcrt-v2 checkout and writes citation files into citations/ in this repo.
 *
 * Usage:
 *   node scripts/generate-citations.mjs [path/to/jcrt-v2] [--archives-only|--theory-only]
 *
 * If no path is given, defaults to ../jcrt-v2 (sibling directory).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseFrontMatter, splitAuthors, isExplicitFalse, archiveEntries, theoryEntries } from "./lib/content-entries.mjs";

// ── Constants ──────────────────────────────────────────────────────
const JOURNAL_TITLE = "Journal for Cultural & Religious Theory";
const JOURNAL_ABBR = "JCRT";
const PUBLISHER = "Whitestone Foundation";
const ISSN = "1530-5228";
const LANGUAGE = "en";
const RIGHTS = "Copyright held by the author(s). Published in the Journal for Cultural and Religious Theory. https://jcrt.org/copyright/";
const RT_TITLE = "Religious theory by JCRT";
// Religious Theory posts are blog posts, not journal articles. The container
// name and website type below match the values jcrt.org emits in its
// dc:source / zotero:itemType meta tags.
const RT_BLOG_TITLE = "JCRT - Religious Theory Blog";
const RT_WEBSITE_TYPE = "Editor Reviewed Magazine";

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

const OUT_ARCHIVES = path.join(FILES_ROOT, "citations", "archives");
const OUT_THEORY = path.join(FILES_ROOT, "citations", "religioustheory");
const LEGACY_DATE_PATH = path.join(JCRT_V2_ROOT, "_data", "legacy-ris-dates.json");
const AUTHORS_PATH = path.join(JCRT_V2_ROOT, "content", "authors");

// ── Helpers ────────────────────────────────────────────────────────
function sha256(input) {
	return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function parseYear(data) {
	if (data?.year) { const m = String(data.year).match(/\d{4}/); if (m) return m[0]; }
	if (data?.date) { const d = new Date(data.date); if (!isNaN(d.getTime())) return String(d.getUTCFullYear()); }
	return "";
}

function parseSeason(data) { return String(data?.season || "").trim().toLowerCase(); }

// [year, month, day] from a full `date:` timestamp; [year] when only a year is known.
function parseDateParts(data) {
	if (data?.date) {
		const d = new Date(data.date);
		if (!isNaN(d.getTime())) return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
	}
	const year = parseYear(data);
	return year ? [Number(year)] : [];
}

function pad2(n) { return String(n).padStart(2, "0"); }

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

// Bare DOI (no scheme/host), as expected by the RIS DO tag and the CSL-JSON DOI field.
function normalizeDoi(v) {
	return String(v || "").trim()
		.replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//i, "")
		.replace(/^doi:\s*/i, "")
		.trim();
}

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

function isSuffix(value) {
	return SUFFIXES.has(String(value || "").replace(/\.$/, "").toLowerCase());
}

function nameKey(value) {
	return String(value || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const authorOrcids = new Map();
for (const name of fs.readdirSync(AUTHORS_PATH).filter((name) => name.endsWith(".md"))) {
	const data = parseFrontMatter(fs.readFileSync(path.join(AUTHORS_PATH, name), "utf8"));
	const orcid = String(data.orcid || "").match(/(?:orcid\.org\/)?(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i)?.[1];
	if (orcid && data.name) authorOrcids.set(nameKey(data.name), orcid);
}

function parseAuthorName(author) {
	const raw = String(author || "").trim();
	if (!raw) return null;
	const ORCID = authorOrcids.get(nameKey(raw));
	if (raw.includes(",")) {
		const segments = raw.split(",").map((s) => s.trim()).filter(Boolean);
		const last = segments[segments.length - 1];
		if (segments.length <= 3 && segments.length > 1 && isSuffix(last)) {
			// Two comma forms carry a generational suffix, and the plain
			// "Family, Given" split below reads the suffix as the given name
			// ("Bell, Jr." cites as "Jr., D. M. B."):
			//   "Family, Suffix, Given" — BibTeX's own three-part form
			//   "Given Family, Suffix"  — how an editor writes "Daniel M. Bell, Jr."
			const rest = segments.length === 3
				? { family: segments[0], given: segments[2] }
				: parseAuthorName(segments[0]) || {};
			const base = rest.literal ? { family: rest.literal } : rest;
			const suffixed = { ...base, suffix: last };
			const orcid = ORCID || authorOrcids.get(nameKey(segments.slice(0, -1).join(" ")));
			return { ...suffixed, ...(orcid ? { ORCID: orcid } : {}) };
		}
		const [family, ...rest] = raw.split(",");
		return { family: family.trim(), given: rest.join(",").trim(), ...(ORCID ? { ORCID } : {}) };
	}
	if (/[()]/.test(raw)) {
		return { literal: raw, ...(ORCID ? { ORCID } : {}) };
	}
	const parts = raw.split(/\s+/);
	if (parts.length === 1) return { literal: raw };
	// A generational suffix is not the family name: "John B. Cobb Jr." must parse
	// as Cobb / John B. / Jr., or it cites as "Jr., J. B. C."
	let suffix = "";
	if (parts.length > 2 && isSuffix(parts[parts.length - 1])) {
		suffix = parts.pop();
	}
	const family = parts.pop();
	return { family, given: parts.join(" "), ...(suffix ? { suffix } : {}), ...(ORCID ? { ORCID } : {}) };
}

// RIS AU tags are inverted: "Grane, Kevin S."
function risAuthor(author) {
	const parsed = parseAuthorName(author);
	if (!parsed) return "";
	if (parsed.literal) return parsed.literal;
	const inverted = parsed.given ? `${parsed.family}, ${parsed.given}` : parsed.family;
	return parsed.suffix ? `${inverted}, ${parsed.suffix}` : inverted;
}

function normalizeTitle(v) {
	return String(v || "").toLowerCase().normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

// ── RIS / CSL-JSON builders ────────────────────────────────────────
function makeArchiveRIS(e) {
	return [
		"TY  - JOUR", `TI  - ${escRIS(e.title)}`,
		...(e.authors.length ? e.authors.map((a) => `AU  - ${escRIS(risAuthor(a))}`) : ["AU  - "]),
		`T2  - ${JOURNAL_TITLE}`,
		`DA  - ${e.dateIso}`,
		`PY  - ${e.py || e.year}`, `VL  - ${escRIS(e.volume)}`, `IS  - ${escRIS(e.issue)}`,
		`C6  - ${escRIS(e.season)}`, `SP  - ${escRIS(e.sp)}`, `EP  - ${escRIS(e.ep)}`,
		`J2  - ${JOURNAL_ABBR}`, `PB  - ${PUBLISHER}`, `SN  - ${ISSN}`,
		...(e.doi ? [`DO  - ${escRIS(e.doi)}`] : []),
		`UR  - ${escRIS(e.url)}`, `N1  - ${RIGHTS}`, "ER  -",
	].join("\n") + "\n";
}

function makeArchiveCSL(e, id) {
	const obj = {
		id, type: "article-journal", title: e.title || id,
		"container-title": JOURNAL_TITLE, "short-container-title": JOURNAL_ABBR,
		publisher: PUBLISHER, ISSN, URL: e.url,
		note: RIGHTS,
	};
	const al = e.authors.map(parseAuthorName).filter(Boolean);
	if (al.length) obj.author = al;
	if (e.dateParts.length) obj.issued = { "date-parts": [e.dateParts] };
	if (e.season) obj.season = e.season;
	if (e.volume) obj.volume = e.volume;
	if (e.issue) obj.issue = e.issue;
	if (e.sp && e.ep) obj.page = `${e.sp}-${e.ep}`;
	else if (e.sp) obj.page = e.sp;
	if (e.doi) obj.DOI = e.doi;
	return JSON.stringify([obj], null, 2) + "\n";
}

function risDate(parts) {
	if (!parts || !parts.length) return "";
	const [y, m, d] = parts;
	return `${y}/${m ? pad2(m) : ""}/${d ? pad2(d) : ""}/`;
}

function makeTheoryRIS(e) {
	return [
		"TY  - BLOG", `TI  - ${escRIS(e.title)}`,
		...(e.authors.length ? e.authors.map((a) => `AU  - ${escRIS(risAuthor(a))}`) : ["AU  - "]),
		`T2  - ${RT_BLOG_TITLE}`,
		...(e.abstract ? [`AB  - ${escRIS(e.abstract)}`] : []),
		`DA  - ${risDate(e.dateParts)}`,
		`PY  - ${e.year}`,
		...(e.doi ? [`DO  - ${escRIS(e.doi)}`] : []),
		`LA  - ${LANGUAGE}`,
		`M3  - ${RT_WEBSITE_TYPE}`,
		`UR  - ${escRIS(e.url)}`,
		`L2  - ${escRIS(e.pdfUrl || e.url)}`,
		"ER  - ",
	].join("\n") + "\n";
}

function makeTheoryCSL(e, id) {
	const obj = {
		id, type: "post-weblog", title: e.title || id,
		"container-title": RT_BLOG_TITLE, genre: RT_WEBSITE_TYPE,
		language: LANGUAGE, URL: e.url,
	};
	if (e.abstract) obj.abstract = e.abstract;
	const al = e.authors.map(parseAuthorName).filter(Boolean);
	if (al.length) obj.author = al;
	if (e.dateParts?.length) obj.issued = { "date-parts": [e.dateParts] };
	else if (e.year) obj.issued = { "date-parts": [[Number(e.year)]] };
	if (e.doi) obj.DOI = e.doi;
	return JSON.stringify([obj], null, 2) + "\n";
}

// ── BibTeX builders ────────────────────────────────────────────────
const MONTH_MACROS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// LaTeX-special ASCII. Non-ASCII stays UTF-8 on purpose: biber, Zotero and
// pandoc all read UTF-8 .bib, and transliterating would mangle author names.
const LATEX_ESCAPES = {
	"\\": "\\textbackslash{}", "{": "\\{", "}": "\\}",
	"$": "\\$", "&": "\\&", "%": "\\%", "#": "\\#", "_": "\\_",
	"~": "\\textasciitilde{}", "^": "\\textasciicircum{}",
};

function escBib(v) {
	return String(v ?? "")
		.replace(/[\\{}$&%#_~^]/g, (c) => LATEX_ESCAPES[c])
		.replace(/\s+/g, " ")
		.trim();
}

// url and doi are verbatim fields in biblatex; backslash-escaping them would
// corrupt the value, so they only get whitespace/brace stripping.
function verbatimBib(v) {
	// Braces would end the field early, so they go. Internal whitespace is
	// percent-encoded rather than deleted: a filename with a space should yield
	// a working URL, not two halves silently welded into a dead one.
	return String(v ?? "").replace(/[{}]/g, "").trim().replace(/\s+/g, "%20");
}

// BibTeX name form is "Family, Suffix, Given"; names with no given part are
// braced so BibTeX does not re-split them into first/last.
function bibAuthor(author) {
	const parsed = parseAuthorName(author);
	if (!parsed) return "";
	if (parsed.literal) return `{${escBib(parsed.literal)}}`;
	const family = escBib(parsed.family);
	const given = escBib(parsed.given);
	const suffix = escBib(parsed.suffix);
	// Braced so BibTeX does not re-split a bare family name into first/last --
	// but a suffix still has to survive, or "Bell, Jr." cites as plain "Bell".
	if (!given) return suffix ? `{${family}}, ${suffix}` : `{${family}}`;
	return suffix ? `${family}, ${suffix}, ${given}` : `${family}, ${given}`;
}

function bibAuthors(authors) {
	return authors.map(bibAuthor).filter(Boolean).join(" and ");
}

// Fields flagged `raw` (the month macro) are emitted unbraced so .bst styles
// expand them to a month name instead of printing the literal "mar".
function bibEntry(type, id, fields) {
	const lines = fields
		.filter(([, value]) => String(value ?? "").trim() !== "")
		.map(([name, value, raw]) => `  ${name} = ${raw ? value : `{${value}}`},`);
	return `@${type}{${id},\n${lines.join("\n")}\n}\n`;
}

// JabRef and Zotero both parse `file` as "description:path:type", splitting on
// unescaped colons. A bare https URL splits into two junk fields and Zotero
// discards it, so the colon after the scheme is escaped.
function bibFile(url) {
	const clean = verbatimBib(url);
	return clean ? `Full Text PDF:${clean.replace(/:/g, "\\:")}:PDF` : "";
}

// biblatex reads `date` in preference to year+month and keeps day precision,
// which year+month alone throws away. Plain .bst styles ignore it and use year.
function bibDate(e) {
	if (!e.hasRealDate || e.dateParts.length < 3) return "";
	const [y, m, d] = e.dateParts;
	return `${y}-${pad2(m)}-${pad2(d)}`;
}

function bibMonth(dateParts) {
	const month = dateParts?.[1];
	return month >= 1 && month <= 12 ? MONTH_MACROS[month - 1] : "";
}

function titleCaseSeason(season) {
	return String(season || "").replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// biblatex's \MakeSentenceCase* ignores a brace group whose first token is a
// control sequence, so a title starting with an escape (e.g. "\#Subjectivities")
// loses its case protection under APA. A leading empty group restores it.
function bibTitle(value, fallback) {
	const escaped = escBib(value || fallback);
	return escaped.startsWith("\\") ? `{{}${escaped}}` : `{${escaped}}`;
}

function makeArchiveBib(e, id) {
	const page = e.sp && e.ep ? `${e.sp}--${e.ep}` : e.sp || "";
	const authors = bibAuthors(e.authors);
	return bibEntry("article", id, [
		["author", authors],
		// Legacy BibTeX sorts and labels on `author`; without a `key` the two
		// authorless front-matter pages raise "to sort, need author or key".
		["key", authors ? "" : escBib(e.title || id)],
		// The extra brace pair stops BibTeX styles from lowercasing capitals
		// inside the title.
		["title", bibTitle(e.title, id)],
		["journal", escBib(JOURNAL_TITLE)],
		["shortjournal", escBib(JOURNAL_ABBR)],
		["year", escBib(e.py || e.year)],
		// Only a date the front matter actually stated. Most archive issues give
		// a year and a season, and the generator fills the rest in as January 1
		// -- printing "Jan. 2023" on a Fall issue.
		["month", e.hasRealDate ? bibMonth(e.dateParts) : "", true],
		["date", bibDate(e)],
		// No `issue` for the season: pandoc concatenates biblatex `number` +
		// `issue` into a single CSL issue, so APA renders "24(2, Winter)", and
		// Zotero maps both onto one field where the later one wins. The season
		// stays available in the RIS C6 and CSL `season` siblings.
		["number", escBib(e.issue)],
		["volume", escBib(e.volume)],
		["pages", escBib(page)],
		// No `publisher`: biblatex's data model rejects it on @article. The
		// RIS/CSL-JSON siblings carry it verbatim.
		["issn", ISSN],
		["doi", verbatimBib(e.doi)],
		["url", verbatimBib(e.url)],
		["file", bibFile(e.pdfUrl)],
		// `copyright`, not `note`: biblatex prints `note` mid-citation, wedging
		// the rights statement between the issue and the page range. Zotero maps
		// `copyright` onto its Rights field, so the statement still reaches a
		// reader. biblatex's data model does not define it, so `biber
		// --validate-datamodel` warns and ignores it -- accepted deliberately,
		// because unlike `publisher` this field has a consumer that uses it.
		["copyright", escBib(RIGHTS)],
	]);
}

function makeTheoryBib(e, id) {
	const authors = bibAuthors(e.authors);
	// @online, not @misc: the RIS and CSL-JSON siblings both type these as blog
	// posts, and @online is the entry type that says so -- it gets the title
	// quoted, keeps day precision, and puts the blog in the container slot
	// rather than the publisher slot. Legacy plain.bst does not define @online:
	// it warns and falls back to author + title, losing the date and venue.
	return bibEntry("online", id, [
		["author", authors],
		["key", authors ? "" : escBib(e.title || id)],
		// Only `title` gets the extra case-protection brace pair; on other fields
		// citeproc prints the inner braces literally ("{Editor Reviewed Magazine}").
		["title", bibTitle(e.title, id)],
		// `organization` is the venue slot biblatex's online driver prints;
		// `journaltitle` and `howpublished` are both dropped there. `type` is not
		// valid on @online either -- the "Editor Reviewed Magazine" designation
		// stays in the RIS M3 and CSL `genre` siblings.
		["organization", escBib(RT_BLOG_TITLE)],
		["year", escBib(e.year)],
		["month", e.hasRealDate ? bibMonth(e.dateParts) : "", true],
		["date", bibDate(e)],
		// `langid`, not `language`: biblatex typesets `language` verbatim (a bare
		// "en." mid-entry) while `langid` only selects hyphenation.
		["langid", "english"],
		["abstract", escBib(e.abstract)],
		["doi", verbatimBib(e.doi)],
		["url", verbatimBib(e.url)],
		["file", bibFile(e.pdfUrl)],
	]);
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
	const srcEntries = archiveEntries(JCRT_V2_ROOT);
	if (srcEntries.length === 0) {
		console.log("[citations] No archive entries found under:", JCRT_V2_ROOT);
		return { total: 0, generated: 0, skipped: 0 };
	}

	fs.mkdirSync(OUT_ARCHIVES, { recursive: true });
	const legacyLookup = loadLegacyDates();
	let generated = 0, skipped = 0;

	for (const src of srcEntries) {
		const { issueSlug, fileSlug, content, data, issueMeta, pageUrl } = src;

		const volume = normalizeNumStr(data.volume || issueMeta.volume || issueSlug.split(".")[0] || "");
		const issue = normalizeNumStr(data.issue || issueMeta.issue || issueSlug.split(".")[1] || "");
		const { sp, ep } = parsePages(data.pages);
		const year = parseYear(data) || parseYear(issueMeta);
		const season = parseSeason(data) || parseSeason(issueMeta);
		const parsedDateParts = parseDateParts(data);
		const issueDateParts = parseDateParts(issueMeta);
		const hasRealDate = parsedDateParts.length === 3 || issueDateParts.length === 3;
		const dateParts = parsedDateParts.length === 3
			? parsedDateParts
			: issueDateParts.length === 3
				? issueDateParts
				: year ? [Number(year), 1, 1] : [];

		const url = pageUrl;

		// `pdf:` is a filename when a PDF exists and the YAML boolean false when
		// it does not, so only a non-empty string yields a URL.
		const pdfName = typeof data.pdf === "string" ? data.pdf.trim() : "";
		const pdfUrl = pdfName
			? (/^https?:\/\//i.test(pdfName) ? pdfName : `https://files.jcrt.org/archives/${issueSlug}/${pdfName}`)
			: "";

		const entry = {
			title: String(data.title || fileSlug).trim(),
			authors: splitAuthors(data.author),
			year, volume, issue, season, sp, ep, url, dateParts, pdfUrl, hasRealDate,
			dateIso: dateParts.map((part, index) => index ? pad2(part) : String(part)).join("-"),
			doi: normalizeDoi(data.doi),
		};
		const legacyDate = resolveLegacyDate(entry, legacyLookup);
		entry.season = entry.season || "unknown";
		entry.py = year || legacyDate.py || String(new Date().getUTCFullYear());

		const issueOutDir = path.join(OUT_ARCHIVES, issueSlug);
		const risPath = path.join(issueOutDir, `${fileSlug}.ris`);
		const cslPath = path.join(issueOutDir, `${fileSlug}.csl.json`);
		const bibPath = path.join(issueOutDir, `${fileSlug}.bib`);

		// Check if output is already current (content hash)
		const sig = sha256(`${content}|${JSON.stringify(issueMeta)}`);
		if (!FORCE && fs.existsSync(risPath) && fs.existsSync(cslPath) && fs.existsSync(bibPath)) {
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
		fs.writeFileSync(bibPath, makeArchiveBib(entry, citId), "utf8");
		// Write signature marker for incremental builds
		fs.writeFileSync(path.join(issueOutDir, `.${fileSlug}.sig`), sig, "utf8");
		generated++;
	}

	const total = generated + skipped;
	return { total, generated, skipped };
}

function generateTheoryCitations() {
	const srcEntries = theoryEntries(JCRT_V2_ROOT);
	if (srcEntries.length === 0) {
		console.log("[citations] No theory entries found under:", JCRT_V2_ROOT);
		return { total: 0, generated: 0, skipped: 0 };
	}

	fs.mkdirSync(OUT_THEORY, { recursive: true });
	let generated = 0, skipped = 0;

	for (const src of srcEntries) {
		const { fileSlug, content, data, pageUrl } = src;

		const risPath = path.join(OUT_THEORY, `${fileSlug}.ris`);
		const cslPath = path.join(OUT_THEORY, `${fileSlug}.csl.json`);
		const bibPath = path.join(OUT_THEORY, `${fileSlug}.bib`);

		const sig = sha256(`${content}|${pageUrl}`);
		if (!FORCE && fs.existsSync(risPath) && fs.existsSync(cslPath) && fs.existsSync(bibPath)) {
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
			dateParts: parseDateParts(data),
			hasRealDate: parseDateParts(data).length === 3,
			abstract: String(data.description || "").trim(),
			doi: normalizeDoi(data.doi),
			url: pageUrl,
			pdfUrl: String(data.pdf || "").trim() ? `https://files.jcrt.org/religioustheory/${String(data.pdf).trim()}` : "",
		};

		const citId = `religioustheory-${fileSlug}`.replace(/[^a-zA-Z0-9_.-]/g, "-");
		fs.writeFileSync(risPath, makeTheoryRIS(entry), "utf8");
		fs.writeFileSync(cslPath, makeTheoryCSL(entry, citId), "utf8");
		fs.writeFileSync(bibPath, makeTheoryBib(entry, citId), "utf8");
		fs.writeFileSync(path.join(OUT_THEORY, `.${fileSlug}.sig`), sig, "utf8");
		generated++;
	}

	const total = generated + skipped;
	return { total, generated, skipped };
}

// ── Run ────────────────────────────────────────────────────────────
console.log(`[citations] Reading content from: ${JCRT_V2_ROOT}`);
console.log(`[citations] Writing citations to: ${path.join(FILES_ROOT, "citations")}`);

const archives = RUN_ARCHIVES ? generateArchiveCitations() : { total: 0, generated: 0, skipped: 0 };
if (RUN_ARCHIVES) {
	console.log(`[citations] Archives: total=${archives.total}, generated=${archives.generated}, skipped=${archives.skipped}`);
}

const theory = RUN_THEORY ? generateTheoryCitations() : { total: 0, generated: 0, skipped: 0 };
if (RUN_THEORY) {
	console.log(`[citations] Theory: total=${theory.total}, generated=${theory.generated}, skipped=${theory.skipped}`);
}

const totalGen = archives.generated + theory.generated;
if (totalGen > 0) {
	console.log(`[citations] ✅ Generated ${totalGen} new/updated citation files`);
} else {
	console.log("[citations] ✅ All citations up to date");
}
