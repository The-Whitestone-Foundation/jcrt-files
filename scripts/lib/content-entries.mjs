/**
 * Shared content-entry index for jcrt-v2 content.
 *
 * Single place encoding "which jcrt-v2 content files are derivable" and
 * "where do their derived files (citations, metadata) live". Consumed by
 * generate-citations.mjs, generate-metadata.mjs, and
 * check-derived-coverage.mjs.
 *
 * Node builtins ONLY — this module is imported by an npm-test script that
 * runs without node_modules, so no js-yaml or other dependency here.
 */
import fs from "node:fs";
import yaml from "js-yaml";
import path from "node:path";

const BASE_URL = "https://jcrt.org";

// ── Front-matter parsing (moved verbatim from generate-citations.mjs) ──

export function parseFrontMatter(content) {
	// js-yaml, not a hand-rolled parser: the previous line-based parser turned YAML
	// folded scalars (title: >-) into the literal string ">-", which corrupted the
	// published titles of 205 citation records. js-yaml is already a production
	// dependency and is what generate-metadata.mjs uses on the same files.
	if (!content.startsWith("---")) return {};
	const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
	if (!match) return {};
	try {
		const parsed = yaml.load(match[1]);
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

export function splitAuthors(value) {
	if (!value) return [];
	if (Array.isArray(value)) return value.flatMap(splitAuthors);
	let s = String(value);
	if (s.includes(";")) return s.split(";").map((p) => p.trim()).filter(Boolean);
	if (/\s+and\s+/i.test(s)) return s.split(/\s+and\s+/i).map((p) => p.trim()).filter(Boolean);
	return [s.trim()].filter(Boolean);
}

export function isExplicitFalse(value) {
	return String(value || "").trim().toLowerCase() === "false";
}

// ── Enumeration helpers ─────────────────────────────────────────────

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

/**
 * Archive articles under content/archives/<issueSlug>/<fileSlug>.md.
 * Enumeration replicates generate-citations.mjs's generateArchiveCitations.
 */
export function archiveEntries(v2Root) {
	const archivesDir = path.join(v2Root, "content", "archives");
	const files = walkMd(archivesDir);
	const issueMetaCache = new Map();

	function getIssueMeta(issueSlug) {
		if (issueMetaCache.has(issueSlug)) return issueMetaCache.get(issueSlug);
		const indexPath = path.join(archivesDir, issueSlug, "index.njk");
		let meta = {};
		try { meta = parseFrontMatter(fs.readFileSync(indexPath, "utf8")) || {}; }
		catch { meta = {}; }
		issueMetaCache.set(issueSlug, meta);
		return meta;
	}

	const entries = [];
	for (const filePath of files) {
		const rel = path.relative(archivesDir, filePath);
		const parts = rel.split(path.sep);
		if (parts.length < 2) continue;
		const issueSlug = parts[0];
		const fileSlug = path.basename(parts[parts.length - 1], ".md");
		if (!issueSlug.includes(".")) continue;
		if (fileSlug.toLowerCase() === "index") continue;

		const content = fs.readFileSync(filePath, "utf8");
		if (!content.startsWith("---")) continue;

		const data = parseFrontMatter(content);
		if (isExplicitFalse(data.published)) continue;

		const issueMeta = getIssueMeta(issueSlug);
		const pageUrl = `${BASE_URL}/archives/${issueSlug}/${fileSlug}/`;

		entries.push({
			filePath,
			issueSlug,
			fileSlug,
			content,
			data,
			issueMeta,
			pageUrl,
			citationDir: `citations/archives/${issueSlug}`,
			citationStem: fileSlug,
			metadataDir: `metadata/archives/${issueSlug}/${fileSlug}`,
		});
	}
	return entries;
}

// Normalize a front-matter permalink to have a leading and trailing slash.
function normalizePermalink(value) {
	let p = String(value || "").trim();
	if (!p) return "";
	if (!p.startsWith("/")) p = `/${p}`;
	if (!p.endsWith("/")) p = `${p}/`;
	return p;
}

/**
 * Religious Theory posts, covering both content/religioustheory/posts and
 * content/religioustheory/live. Citation output is keyed flatly by
 * fileSlug (jcrt-v2's live.11tydata.js re-exports posts.11tydata.js), so
 * fileSlug must be unique across both directories.
 */
export function theoryEntries(v2Root) {
	const dirs = [
		{ dirName: "posts", dir: path.join(v2Root, "content", "religioustheory", "posts") },
		{ dirName: "live", dir: path.join(v2Root, "content", "religioustheory", "live") },
	];

	const entries = [];
	const seenSlugs = new Map();

	for (const { dirName, dir } of dirs) {
		if (!fs.existsSync(dir)) continue;
		const files = fs.readdirSync(dir, { withFileTypes: true })
			.filter((e) => e.isFile() && e.name.endsWith(".md"))
			.map((e) => path.join(dir, e.name));

		for (const filePath of files) {
			const fileSlug = path.basename(filePath, ".md");
			if (seenSlugs.has(fileSlug)) {
				throw new Error(
					`theoryEntries: duplicate fileSlug "${fileSlug}" in ${dirName}/ ` +
					`(already seen in ${seenSlugs.get(fileSlug)}/) — flat citation namespace would collide`
				);
			}
			seenSlugs.set(fileSlug, dirName);

			const content = fs.readFileSync(filePath, "utf8");
			const data = parseFrontMatter(content);

			const permalink = normalizePermalink(data.permalink);
			const urlPath = permalink || `/religioustheory/${dirName}/${fileSlug}/`;
			const pageUrl = `${BASE_URL}${urlPath}`;
			const metadataDir = `metadata${urlPath.replace(/\/$/, "")}`;

			entries.push({
				filePath,
				dirName,
				fileSlug,
				content,
				data,
				pageUrl,
				citationDir: "citations/religioustheory",
				citationStem: fileSlug,
				metadataDir,
			});
		}
	}
	return entries;
}
