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
 *   node scripts/generate-file-sitemaps.mjs archives   # only archives.xml
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

// Directories that hold tooling or worker source rather than served assets. Everything
// else at the top level is treated as CDN content and gets a sitemap automatically.
// This is an EXCLUDE list on purpose: an include list meant every new folder was silently
// left out of the sitemaps (and, in the deploy workflow, never uploaded at all).
const NON_ASSET_DIRS = new Set([".git", ".github", "node_modules", "scripts", "src", "sitemaps"]);

/** Top-level git-tracked directories that hold served files. */
function discoverServedFolders() {
	const tracked = git(["ls-files", "-z"]).split("\0").filter(Boolean);
	const dirs = new Set();
	for (const rel of tracked) {
		const slash = rel.indexOf("/");
		if (slash === -1) continue; // top-level file, not a served directory
		const top = rel.slice(0, slash);
		if (!NON_ASSET_DIRS.has(top)) dirs.add(top);
	}
	return [...dirs].sort();
}

// Browsers render sitemaps through this stylesheet; crawlers ignore the instruction.
// Kept absolute so it resolves the same whether the document is fetched at
// /sitemaps/<folder>.xml or at the root alias /sitemap.xml.
const STYLESHEET_PI = '<?xml-stylesheet type="text/xsl" href="https://files.jcrt.org/sitemaps/style.xsl"?>';

const CHECK_MODE = process.argv.includes("--check");
const REQUESTED_FOLDERS = process.argv.slice(2).filter((arg) => arg !== "--check");

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

	const allFolders = discoverServedFolders();
	const folders = REQUESTED_FOLDERS.length ? REQUESTED_FOLDERS : allFolders;
	const unknown = folders.filter((folder) => !allFolders.includes(folder));
	if (unknown.length) {
		console.error(`[file-sitemaps] unknown served folder: ${unknown.join(", ")}`);
		process.exit(1);
	}

	const lastmodMap = buildLastmodMap();
	const stale = [];
	const written = [];
	const lastmodByFolder = new Map();

	for (const folder of folders) {
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

	if (!REQUESTED_FOLDERS.length) {
		writeOrCheck(path.join(OUT_DIR, "index.xml"), renderIndex(allFolders, lastmodByFolder), stale);
	}

	for (const { folder, count } of written) {
		console.log(`[file-sitemaps] ${folder}.xml: ${count} URLs`);
	}
	if (!REQUESTED_FOLDERS.length) console.log(`[file-sitemaps] index.xml: ${allFolders.length} sitemaps`);

	if (CHECK_MODE && stale.length > 0) {
		console.error(`\n[file-sitemaps] stale or missing output:\n  ${stale.join("\n  ")}`);
		console.error(`Run: node scripts/generate-file-sitemaps.mjs${REQUESTED_FOLDERS.length ? ` ${REQUESTED_FOLDERS.join(" ")}` : ""}`);
		process.exit(1);
	}
}

main();
