#!/usr/bin/env node
/**
 * Generate XML sitemaps for the files served from files.jcrt.org.
 *
 * One sitemap per served top-level folder, plus a sitemap index that points at them:
 *
 *   sitemaps/index.xml            <sitemapindex>, served at the root as /sitemap.xml
 *   sitemaps/archives.xml         every tracked file under archives/
 *   sitemaps/citations.xml        ...and so on for each folder in SERVED_FOLDERS
 *
 * This is a file inventory for crawlers. It is distinct from scripts/generate-sitemaps.mjs,
 * which builds DOAJ / OAI-PMH / citation metadata into metadata/ from jcrt-v2 front matter.
 *
 * Usage:
 *   node scripts/generate-file-sitemaps.mjs
 *   node scripts/generate-file-sitemaps.mjs --check    # fail if output is stale
 *
 * Only git-tracked files are listed, because those are exactly the files the R2 deploy
 * workflow uploads. lastmod comes from git commit dates, not filesystem mtimes: a CI
 * checkout rewrites every mtime to checkout time, which would republish the whole
 * inventory as "changed today" on every run.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = path.resolve(
	import.meta.dirname || path.dirname(new URL(import.meta.url).pathname),
	"..",
);
const OUT_DIR = path.join(REPO_ROOT, "sitemaps");
const BASE_URL = "https://files.jcrt.org";

// Folders whose contents are uploaded to R2 and served. Keep in sync with
// DEFAULT_TARGETS in .github/workflows/deploy-r2-worker.yml.
const SERVED_FOLDERS = ["archives", "citations", "docs", "images", "metadata", "religioustheory"];

// Browsers render sitemaps through this stylesheet; crawlers ignore the instruction.
// Kept absolute so it resolves the same whether the document is fetched at
// /sitemaps/<folder>.xml or at the root alias /sitemap.xml.
const STYLESHEET_PI = '<?xml-stylesheet type="text/xsl" href="https://files.jcrt.org/sitemaps/style.xsl"?>';

const CHECK_MODE = process.argv.includes("--check");

function git(args) {
	return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

/** Map every tracked path to the ISO date of the commit that last touched it. */
function buildLastmodMap() {
	const map = new Map();
	// One git pass. Output alternates: a date line, then the paths in that commit.
	const log = git(["log", "--format=%cI", "--name-only", "--diff-filter=AMRC"]);
	let currentDate = null;
	for (const line of log.split("\n")) {
		if (line === "") continue;
		if (/^\d{4}-\d{2}-\d{2}T/.test(line)) {
			currentDate = line.slice(0, 10);
			continue;
		}
		// Log is newest-first, so the first date seen for a path is its latest change.
		if (currentDate && !map.has(line)) map.set(line, currentDate);
	}
	return map;
}

function trackedFiles(folder) {
	const out = git(["ls-files", "-z", "--", folder]);
	return out.split("\0").filter(Boolean).sort();
}

function xmlEscape(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

/** Percent-encode each path segment, leaving the separators intact. */
function encodePath(relPath) {
	return relPath.split("/").map(encodeURIComponent).join("/");
}

function renderUrlset(files, lastmodMap) {
	const entries = files.map((rel) => {
		const loc = xmlEscape(`${BASE_URL}/${encodePath(rel)}`);
		const lastmod = lastmodMap.get(rel);
		return lastmod
			? `\t<url>\n\t\t<loc>${loc}</loc>\n\t\t<lastmod>${lastmod}</lastmod>\n\t</url>`
			: `\t<url>\n\t\t<loc>${loc}</loc>\n\t</url>`;
	});
	return `<?xml version="1.0" encoding="UTF-8"?>\n${STYLESHEET_PI}\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
}

function renderIndex(folders, lastmodByFolder) {
	const entries = folders.map((folder) => {
		const loc = xmlEscape(`${BASE_URL}/sitemaps/${folder}.xml`);
		const lastmod = lastmodByFolder.get(folder);
		return lastmod
			? `\t<sitemap>\n\t\t<loc>${loc}</loc>\n\t\t<lastmod>${lastmod}</lastmod>\n\t</sitemap>`
			: `\t<sitemap>\n\t\t<loc>${loc}</loc>\n\t</sitemap>`;
	});
	return `<?xml version="1.0" encoding="UTF-8"?>\n${STYLESHEET_PI}\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</sitemapindex>\n`;
}

function writeOrCheck(filePath, contents, stale) {
	const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
	if (existing === contents) return;
	if (CHECK_MODE) {
		stale.push(path.relative(REPO_ROOT, filePath));
		return;
	}
	fs.writeFileSync(filePath, contents);
}

function main() {
	if (!CHECK_MODE) fs.mkdirSync(OUT_DIR, { recursive: true });

	const lastmodMap = buildLastmodMap();
	const stale = [];
	const written = [];
	const lastmodByFolder = new Map();

	for (const folder of SERVED_FOLDERS) {
		const files = trackedFiles(folder);
		if (files.length === 0) {
			console.warn(`[file-sitemaps] ${folder}/ has no tracked files; skipping`);
			continue;
		}
		// The folder's lastmod is the newest lastmod among its files.
		const newest = files
			.map((rel) => lastmodMap.get(rel))
			.filter(Boolean)
			.sort()
			.pop();
		if (newest) lastmodByFolder.set(folder, newest);

		writeOrCheck(path.join(OUT_DIR, `${folder}.xml`), renderUrlset(files, lastmodMap), stale);
		written.push({ folder, count: files.length });
	}

	const folders = written.map((w) => w.folder);
	writeOrCheck(path.join(OUT_DIR, "index.xml"), renderIndex(folders, lastmodByFolder), stale);

	for (const { folder, count } of written) {
		console.log(`[file-sitemaps] ${folder}.xml: ${count} URLs`);
	}
	console.log(`[file-sitemaps] index.xml: ${folders.length} sitemaps`);

	if (CHECK_MODE && stale.length > 0) {
		console.error(`\n[file-sitemaps] stale or missing output:\n  ${stale.join("\n  ")}`);
		console.error("Run: node scripts/generate-file-sitemaps.mjs");
		process.exit(1);
	}
}

main();
