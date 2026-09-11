#!/usr/bin/env node
/**
 * Deposit archive article PDFs into the Internet Archive, the preservation
 * commitment stated on https://jcrt.org/archiving/ ("Every article PDF ... is
 * deposited in the Internet Archive on publication").
 *
 * Reads the generated metadata/archives/<issue>/<slug>/metadata.json records in
 * this repo -- so the IA record carries the same title, authors, date, subjects,
 * DOI and licence as every other JCRT format -- and uploads the matching PDF
 * from archives/<issue>/.
 *
 * DRY RUN BY DEFAULT. An Internet Archive item is public immediately and
 * effectively permanent (removal needs IA staff), so uploading requires an
 * explicit --confirm.
 *
 * Usage:
 *   node scripts/deposit-archive-org.mjs                 # dry run, every issue
 *   node scripts/deposit-archive-org.mjs --issue 25.2    # dry run, one issue
 *   node scripts/deposit-archive-org.mjs --issue 25.2 --confirm
 *   node scripts/deposit-archive-org.mjs --cc-by-only    # only CC BY articles
 *   node scripts/deposit-archive-org.mjs --limit 1 --confirm
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const ARGS = process.argv.slice(2);
const flag = (name) => ARGS.includes(`--${name}`);
const value = (name) => {
	const i = ARGS.indexOf(`--${name}`);
	return i === -1 ? "" : ARGS[i + 1] || "";
};

const CONFIRM = flag("confirm");
const CC_BY_ONLY = flag("cc-by-only");
const ONLY_ISSUE = value("issue");
const LIMIT = Number(value("limit") || 0);
const COLLECTION = value("collection");

// Identifiers are permanent and globally unique across all of archive.org, so
// they carry the journal prefix and the stable jcrt.org path that names the
// article: https://jcrt.org/archives/22.1/gaetano/ -> jcrt-22.1-gaetano.
function identifierFor(issueSlug, fileSlug) {
	return `jcrt-${issueSlug}-${fileSlug}`
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function readRecords() {
	const base = path.join(REPO_ROOT, "metadata", "archives");
	const out = [];
	for (const issueSlug of fs.readdirSync(base).sort()) {
		if (ONLY_ISSUE && issueSlug !== ONLY_ISSUE) continue;
		const issueDir = path.join(base, issueSlug);
		if (!fs.statSync(issueDir).isDirectory()) continue;
		for (const fileSlug of fs.readdirSync(issueDir).sort()) {
			const metaPath = path.join(issueDir, fileSlug, "metadata.json");
			if (!fs.existsSync(metaPath)) continue;
			const data = JSON.parse(fs.readFileSync(metaPath, "utf8"));
			const pdfUrl = data.encoding?.contentUrl || "";
			if (!pdfUrl) continue; // front matter without a PDF has nothing to deposit
			const pdfPath = path.join(REPO_ROOT, pdfUrl.replace("https://files.jcrt.org/", ""));
			if (!fs.existsSync(pdfPath)) continue;
			const ccBy = String(data.license || "").includes("creativecommons.org");
			if (CC_BY_ONLY && !ccBy) continue;
			// The DOI comes from the CSL-JSON sibling: the schema.org record does
			// not carry one (its `identifier` holds only the nanoid).
			let doi = "";
			try {
				const csl = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "citations", "archives", issueSlug, `${fileSlug}.csl.json`), "utf8"));
				doi = csl[0]?.DOI || "";
			} catch { /* no citation record; deposit without a DOI */ }
			out.push({ issueSlug, fileSlug, data, pdfPath, ccBy, doi });
		}
	}
	return LIMIT > 0 ? out.slice(0, LIMIT) : out;
}

function metadataFor({ data, ccBy, doi }) {
	const authors = (data.author || []).map((a) => a.name).filter(Boolean);
	const subjects = (data.about || []).map((t) => t.name).filter(Boolean);
	const meta = {
		mediatype: "texts",
		title: data.name,
		creator: authors.length ? authors : ["JCRT Editors"],
		date: data.datePublished,
		publisher: data.publisher?.name,
		language: "eng",
		description: data.abstract || data.description || "",
		"external-identifier": doi ? `urn:doi:${doi}` : undefined,
		source: data.url,
		journaltitle: data.isPartOf?.name,
		issn: data.isPartOf?.issn,
		volume: data.volumeNumber,
		issue: data.issueNumber,
		subject: subjects.length ? subjects : undefined,
		// Only the CC BY articles get a licenseurl. Earlier articles are "all
		// rights reserved" and the notice goes in `rights` instead, so nothing
		// is presented as more freely reusable than it is.
		licenseurl: ccBy ? data.license : undefined,
		rights: data.copyrightNotice,
		collection: COLLECTION || undefined,
	};
	for (const key of Object.keys(meta)) if (meta[key] === undefined || meta[key] === "") delete meta[key];
	return meta;
}

// Pacing for archive.org's abuse guard, which rejected a 10-file burst as spam.
const THROTTLE_MS = Number(value("throttle") || 15000);
const RETRY_BASE_MS = 60000;
const MAX_ATTEMPTS = 4;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Does the item already hold this file? The only reliable "already done" signal. */
function hasFile(identifier, remoteName) {
	try {
		const raw = execFileSync("ia", ["metadata", identifier], { encoding: "utf8" });
		const parsed = JSON.parse(raw || "{}");
		return (parsed.files || []).some((file) => file.name === remoteName);
	} catch {
		return false;
	}
}

const records = readRecords();
if (records.length === 0) {
	console.log("[ia] Nothing to deposit for the given filters.");
	process.exit(0);
}

console.log(`[ia] ${records.length} article PDF(s) selected${ONLY_ISSUE ? ` from issue ${ONLY_ISSUE}` : ""}${CC_BY_ONLY ? " (CC BY only)" : ""}`);
console.log(`[ia] mode: ${CONFIRM ? "UPLOAD" : "DRY RUN (pass --confirm to upload)"}`);

let uploaded = 0, skipped = 0, failed = 0;
for (const record of records) {
	const identifier = identifierFor(record.issueSlug, record.fileSlug);
	const meta = metadataFor(record);
	const remoteName = `${identifier}.pdf`;

	if (!CONFIRM) {
		console.log(`\n  ${identifier}`);
		console.log(`    file     ${path.relative(REPO_ROOT, record.pdfPath)} -> ${remoteName}`);
		for (const [k, v] of Object.entries(meta)) {
			console.log(`    ${k.padEnd(20)} ${Array.isArray(v) ? v.join(" | ") : String(v).slice(0, 96)}`);
		}
		continue;
	}

	// Skip on the FILE, not on the item. A rate-limited upload leaves the item
	// created but empty, and an existence check would skip it forever.
	if (hasFile(identifier, remoteName)) {
		console.log(`  = ${identifier} (already on archive.org, skipped)`);
		skipped++;
		continue;
	}

	const args = ["upload", identifier, `${record.pdfPath}`, "--remote-name", remoteName];
	for (const [k, v] of Object.entries(meta)) {
		for (const one of Array.isArray(v) ? v : [v]) args.push("--metadata", `${k}:${one}`);
	}

	// archive.org rate-limits bursts as spam. Pace the uploads, and back off
	// and retry rather than leaving a half-created item behind.
	let done = false;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS && !done; attempt++) {
		try {
			execFileSync("ia", args, { stdio: "inherit" });
			done = true;
		} catch {
			// `ia` exits non-zero on a rate-limited upload, but the file may still
			// have landed; ask the server rather than trusting the exit code.
			if (hasFile(identifier, remoteName)) { done = true; break; }
			if (attempt === MAX_ATTEMPTS) break;
			const backoff = RETRY_BASE_MS * attempt;
			console.log(`    rate-limited, retrying in ${Math.round(backoff / 1000)}s (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
			await sleep(backoff);
		}
	}

	if (done) { console.log(`  + ${identifier}`); uploaded++; }
	else { console.error(`  ! ${identifier} failed after ${MAX_ATTEMPTS} attempts`); failed++; }

	await sleep(THROTTLE_MS);
}

if (CONFIRM) {
	console.log(`\n[ia] uploaded=${uploaded} skipped=${skipped} failed=${failed}`);
} else {
	console.log(`\n[ia] Dry run only. Nothing was uploaded.`);
}
