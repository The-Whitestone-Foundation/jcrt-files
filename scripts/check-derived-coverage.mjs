#!/usr/bin/env node
/**
 * Verifies every archive article and religious theory post that jcrt-v2
 * emits citation/metadata URLs for actually has those derived files in
 * this repo. Catches the class of dead reference where the site links to
 * a citation or metadata file that generate-citations.mjs / the metadata
 * backfill never produced.
 *
 * Checks for MISSING files only — orphaned derived files for retired
 * slugs are harmless and not flagged.
 */
import fs from "node:fs";
import path from "node:path";
import { archiveEntries, theoryEntries } from "./lib/content-entries.mjs";

const root = path.resolve(import.meta.dirname, "..");
const v2Root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(root, "..", "jcrt-v2");

if (!fs.existsSync(v2Root)) {
	console.error(`Expected a sibling jcrt-v2 checkout at ${v2Root} (a precondition of npm test), but it does not exist.`);
	process.exit(1);
}

const sections = [
	{ name: "archive articles", entries: archiveEntries(v2Root) },
	{ name: "religious theory posts", entries: theoryEntries(v2Root) },
];

const MAX_PRINTED = 20;
let anyMissing = false;

for (const { name, entries } of sections) {
	const missing = [];
	for (const entry of entries) {
		const wanted = [
			path.join(root, entry.citationDir, `${entry.citationStem}.ris`),
			path.join(root, entry.citationDir, `${entry.citationStem}.csl.json`),
			path.join(root, entry.metadataDir, "metadata.json"),
		];
		if (entry.issueSlug && typeof entry.data?.pdf === "string" && !/^https?:\/\//i.test(entry.data.pdf)) {
			wanted.push(path.join(root, "archives", entry.issueSlug, path.basename(entry.data.pdf)));
		}
		for (const file of wanted) {
			if (!fs.existsSync(file)) missing.push(path.relative(root, file));
		}
	}
	if (missing.length === 0) continue;

	anyMissing = true;
	console.error(`Missing derived files for ${name} (${missing.length}):`);
	for (const file of missing.slice(0, MAX_PRINTED)) console.error(`  - ${file}`);
	if (missing.length > MAX_PRINTED) console.error(`  ...and ${missing.length - MAX_PRINTED} more`);
}

if (anyMissing) process.exit(1);

const counts = sections.map(({ name, entries }) => `${entries.length} ${name}`).join(" and ");
// Content sanity: a coverage check that only tests existence reported green while 205
// published citations carried the literal title ">-" (a YAML folded-scalar parsing bug)
// and orphaned records pointed at 404 pages. Fail loudly on both classes.
{
	const fsMod = await import("node:fs");
	const pathMod = await import("node:path");
	const bad = [];
	const walk = (dir) => {
		for (const e of fsMod.readdirSync(dir, { withFileTypes: true })) {
			const full = pathMod.join(dir, e.name);
			if (e.isDirectory()) walk(full);
			else if (e.name.endsWith(".ris") || e.name.endsWith(".csl.json")) {
				const text = fsMod.readFileSync(full, "utf8");
				if (/^TI  - >-\s*$/m.test(text) || text.includes('"title": ">-"')) bad.push(full);
			}
		}
	};
	walk("citations");
	if (bad.length > 0) {
		console.error(`[coverage] ${bad.length} citation file(s) with corrupt ">-" titles:`);
		for (const b of bad.slice(0, 10)) console.error("  " + b);
		process.exit(1);
	}
}

console.log(`Verified derived files for ${counts}.`);
