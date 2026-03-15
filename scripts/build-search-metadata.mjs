#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const FILES_REPO_ROOT = path.resolve(process.cwd());
const SOURCE_CONTENT_ROOT = path.resolve(FILES_REPO_ROOT, "../jcrt-v2/content");

const METADATA_ROOT = path.join(FILES_REPO_ROOT, "metadata");
const SEARCH_ROOT = path.join(METADATA_ROOT, "search");
const SEARCH_JSON_ROOT = path.join(SEARCH_ROOT, "json");
const SEARCH_SITEMAP_PATH = path.join(METADATA_ROOT, "search-sitemap.xml");

const MAX_BYTES_PER_CHUNK = 5 * 1024 * 1024;
const FIELD_LIMIT = 1000;

const SECTIONS = [
	{
		key: "archives",
		sourceDir: path.join(SOURCE_CONTENT_ROOT, "archives"),
		select: (absPath) => absPath.endsWith(".md") && !absPath.endsWith("/archives.11tydata.js"),
		toUrl: (sourcePath, frontmatter) => {
			const rel = path.relative(path.join(SOURCE_CONTENT_ROOT, "archives"), sourcePath);
			const parts = rel.split(path.sep);
			if (parts.length < 2) return "";
			const issue = parts[0];
			const fileSlug = path.basename(parts[parts.length - 1], ".md");
			if (fileSlug.toLowerCase() === "index") return "";
			const slug = normalizeSlug(frontmatter.slug || fileSlug);
			return slug ? `https://jcrt.org/archives/${issue}/${slug}/` : "";
		},
	},
	{
		key: "religioustheory",
		sourceDir: path.join(SOURCE_CONTENT_ROOT, "religioustheory", "posts"),
		select: (absPath) => absPath.endsWith(".md"),
		toUrl: (sourcePath, frontmatter) => {
			const fileSlug = path.basename(sourcePath, ".md");
			const slug = normalizeSlug(frontmatter.slug || fileSlug);
			return slug ? `https://jcrt.org/religioustheory/${slug}/` : "";
		},
	},
	{
		key: "blog",
		sourceDir: path.join(SOURCE_CONTENT_ROOT, "blog"),
		select: (absPath) => absPath.endsWith(".md"),
		toUrl: (sourcePath, frontmatter) => {
			const fileSlug = path.basename(sourcePath, ".md");
			const slug = normalizeSlug(frontmatter.slug || fileSlug);
			return slug ? `https://jcrt.org/blog/${slug}/` : "";
		},
	},
	{
		key: "authors",
		sourceDir: path.join(SOURCE_CONTENT_ROOT, "authors"),
		select: (absPath) => absPath.endsWith(".md"),
		toUrl: (sourcePath, frontmatter) => {
			const fileSlug = path.basename(sourcePath, ".md");
			const slug = normalizeSlug(frontmatter.slug || fileSlug);
			return slug ? `https://jcrt.org/authors/${slug}/` : "";
		},
	},
];

function normalizeSlug(value) {
	const slug = String(value || "").trim().toLowerCase();
	if (!slug) return "";
	return slug
		.replace(/['"`]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function limit(value, max = FIELD_LIMIT) {
	const s = String(value || "").trim().replace(/\s+/g, " ");
	if (!s) return "";
	if (s.length <= max) return s;
	return `${s.slice(0, max - 1).trim()}...`;
}

function stripMarkdown(content) {
	return String(content || "")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`[^`]*`/g, " ")
		.replace(/!\[[^\]]*]\([^)]*\)/g, " ")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/^>+/gm, " ")
		.replace(/[#*_~>-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function parseFrontmatter(raw) {
	const text = String(raw || "");
	if (!text.startsWith("---")) return { frontmatter: {}, body: text };
	const end = text.indexOf("\n---", 3);
	if (end === -1) return { frontmatter: {}, body: text };
	const fmText = text.slice(3, end).trim();
	const body = text.slice(end + 4).replace(/^\s+/, "");
	const lines = fmText.split(/\r?\n/);
	const out = {};
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		if (!line || !line.includes(":")) {
			i += 1;
			continue;
		}
		const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
		if (!match) {
			i += 1;
			continue;
		}
		const key = match[1];
		const rawValue = match[2] || "";
		if (rawValue.trim() !== "") {
			out[key] = unquote(rawValue.trim());
			i += 1;
			continue;
		}
		const arr = [];
		let j = i + 1;
		while (j < lines.length) {
			const itemLine = lines[j];
			if (/^\s{2,}-\s+/.test(itemLine)) {
				arr.push(unquote(itemLine.replace(/^\s*-\s+/, "")));
				j += 1;
				continue;
			}
			if (/^\s{2,}[A-Za-z0-9_-]+\s*:/.test(itemLine)) {
				j += 1;
				continue;
			}
			break;
		}
		out[key] = arr.length > 0 ? arr : "";
		i = j;
	}
	return { frontmatter: out, body };
}

function unquote(value) {
	const v = String(value || "").trim();
	if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
		return v.slice(1, -1);
	}
	return v;
}

function walkFiles(dir) {
	const out = [];
	const stack = [dir];
	while (stack.length > 0) {
		const current = stack.pop();
		if (!current || !fs.existsSync(current)) continue;
		const entries = fs.readdirSync(current, { withFileTypes: true });
		for (const entry of entries) {
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) {
				stack.push(full);
			} else if (entry.isFile()) {
				out.push(full);
			}
		}
	}
	return out.sort((a, b) => a.localeCompare(b));
}

function buildItem(sectionKey, sourcePath, frontmatter, body, toUrl) {
	const title = limit(frontmatter.title || frontmatter.name || path.basename(sourcePath, ".md"));
	const author = limit(frontmatter.author || frontmatter.name || "");
	const descriptionSeed =
		frontmatter.description ||
		frontmatter.abstract ||
		frontmatter.bio ||
		stripMarkdown(body);
	const description = limit(descriptionSeed || "", FIELD_LIMIT);
	const url = toUrl(sourcePath, frontmatter);
	if (!url) return null;
	return {
		id: `${sectionKey}:${path.relative(SOURCE_CONTENT_ROOT, sourcePath).replace(/\\/g, "/")}`,
		section: sectionKey,
		title,
		author,
		description,
		url,
		date: limit(frontmatter.date || frontmatter.year || ""),
		source_path: path.relative(path.resolve(FILES_REPO_ROOT, "../jcrt-v2"), sourcePath).replace(/\\/g, "/"),
		updated_at: new Date().toISOString(),
	};
}

function readJsonIfExists(filePath, fallback) {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch {
		return fallback;
	}
}

function writeIfChanged(filePath, content) {
	try {
		const existing = fs.readFileSync(filePath, "utf8");
		if (existing === content) return false;
	} catch {}
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, content, "utf8");
	return true;
}

function chunkFilename(sectionKey, idx) {
	return `${sectionKey}-${String(idx).padStart(2, "0")}.search.json`;
}

function chunkObject(sectionKey, items) {
	return {
		site: "JCRT",
		section: sectionKey,
		generated_at: new Date().toISOString(),
		item_count: items.length,
		items,
	};
}

function chunkSizeBytes(sectionKey, items) {
	return Buffer.byteLength(JSON.stringify(chunkObject(sectionKey, items)));
}

function loadExistingChunks(sectionKey) {
	if (!fs.existsSync(SEARCH_JSON_ROOT)) return [];
	const files = fs
		.readdirSync(SEARCH_JSON_ROOT)
		.filter((name) => new RegExp(`^${sectionKey}-\\d+\\.search\\.json$`).test(name))
		.sort((a, b) => a.localeCompare(b));
	return files.map((file) => {
		const filePath = path.join(SEARCH_JSON_ROOT, file);
		const parsed = readJsonIfExists(filePath, {});
		const items = Array.isArray(parsed.items) ? parsed.items : [];
		return {
			file,
			filePath,
			items,
			generatedAt: typeof parsed.generated_at === "string" ? parsed.generated_at : "",
		};
	});
}

function appendItemsToChunks(sectionKey, existingChunks, newItems) {
	const chunks = existingChunks.length
		? existingChunks.map((c) => ({ ...c, items: [...c.items] }))
		: [{ file: chunkFilename(sectionKey, 1), filePath: path.join(SEARCH_JSON_ROOT, chunkFilename(sectionKey, 1)), items: [] }];
	for (const item of newItems) {
		let target = chunks[chunks.length - 1];
		const candidateItems = [...target.items, item];
		const candidateSize = chunkSizeBytes(sectionKey, candidateItems);
		if (target.items.length > 0 && candidateSize > MAX_BYTES_PER_CHUNK) {
			const nextIndex = chunks.length + 1;
			target = {
				file: chunkFilename(sectionKey, nextIndex),
				filePath: path.join(SEARCH_JSON_ROOT, chunkFilename(sectionKey, nextIndex)),
				items: [item],
			};
			chunks.push(target);
		} else {
			target.items.push(item);
		}
	}
	return chunks;
}

function writeSection(section) {
	const sourceFiles = walkFiles(section.sourceDir).filter(section.select);
	const discoveredItems = [];
	for (const sourcePath of sourceFiles) {
		const raw = fs.readFileSync(sourcePath, "utf8");
		const { frontmatter, body } = parseFrontmatter(raw);
		const item = buildItem(section.key, sourcePath, frontmatter, body, section.toUrl);
		if (item) discoveredItems.push(item);
	}
	discoveredItems.sort((a, b) => a.url.localeCompare(b.url));

	const existingChunks = loadExistingChunks(section.key);
	const existingUrls = new Set();
	for (const chunk of existingChunks) {
		for (const item of chunk.items) {
			const url = String(item?.url || "").trim();
			if (url) existingUrls.add(url);
		}
	}
	const newItems = discoveredItems.filter((item) => !existingUrls.has(item.url));
	const chunks = appendItemsToChunks(section.key, existingChunks, newItems);
	const existingByFile = new Map(existingChunks.map((chunk) => [chunk.file, chunk]));

	let changedCount = 0;
	for (const chunk of chunks) {
		const previous = existingByFile.get(chunk.file);
		const sameItems =
			previous &&
			JSON.stringify(previous.items) === JSON.stringify(chunk.items);
		if (sameItems) continue;
		const payload = chunkObject(section.key, chunk.items);
		const text = `${JSON.stringify(payload, null, 2)}\n`;
		if (writeIfChanged(chunk.filePath, text)) changedCount += 1;
	}

	const manifestPath = path.join(SEARCH_ROOT, `${section.key}.search.json`);
	const previousManifest = readJsonIfExists(manifestPath, {});
	const manifest = {
		site: "JCRT",
		section: section.key,
		generated_at:
			newItems.length === 0 && typeof previousManifest.generated_at === "string"
				? previousManifest.generated_at
				: new Date().toISOString(),
		chunk_size_limit_bytes: MAX_BYTES_PER_CHUNK,
		total_items: chunks.reduce((sum, c) => sum + c.items.length, 0),
		new_items_added: newItems.length,
		chunks: chunks.map((chunk) => {
			const stat = fs.statSync(chunk.filePath);
			return {
				file: chunk.file,
				url: `https://files.jcrt.org/metadata/search/json/${chunk.file}`,
				item_count: chunk.items.length,
				size_bytes: stat.size,
				lastmod: stat.mtime.toISOString().slice(0, 10),
			};
		}),
	};
	if (writeIfChanged(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)) changedCount += 1;

	return {
		section: section.key,
		total: manifest.total_items,
		added: newItems.length,
		changedFiles: changedCount,
	};
}

function buildSearchSitemap() {
	const candidates = [];
	const roots = [SEARCH_ROOT, SEARCH_JSON_ROOT];
	for (const root of roots) {
		if (!fs.existsSync(root)) continue;
		for (const file of fs.readdirSync(root)) {
			const full = path.join(root, file);
			const stat = fs.statSync(full);
			if (!stat.isFile() || !file.endsWith(".json")) continue;
			const rel = path.relative(METADATA_ROOT, full).replace(/\\/g, "/");
			candidates.push({
				loc: `https://files.jcrt.org/metadata/${rel}`,
				lastmod: stat.mtime.toISOString().slice(0, 10),
			});
		}
	}
	candidates.sort((a, b) => a.loc.localeCompare(b.loc));
	const lines = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
	];
	for (const item of candidates) {
		lines.push("  <url>");
		lines.push(`    <loc>${item.loc}</loc>`);
		lines.push(`    <lastmod>${item.lastmod}</lastmod>`);
		lines.push("  </url>");
	}
	lines.push("</urlset>");
	writeIfChanged(SEARCH_SITEMAP_PATH, `${lines.join("\n")}\n`);
	return candidates.length;
}

function main() {
	fs.mkdirSync(SEARCH_JSON_ROOT, { recursive: true });
	const summary = [];
	for (const section of SECTIONS) {
		summary.push(writeSection(section));
	}
	const sitemapEntries = buildSearchSitemap();
	console.log("[search-metadata] complete");
	for (const row of summary) {
		console.log(
			`  - ${row.section}: total=${row.total} added=${row.added} changed_files=${row.changedFiles}`
		);
	}
	console.log(`  - search-sitemap entries: ${sitemapEntries}`);
}

main();
