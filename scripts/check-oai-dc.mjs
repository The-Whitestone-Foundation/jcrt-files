#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const xml = fs.readFileSync(path.join(root, "metadata", "oai_dc.xml"), "utf8");
const schema = path.resolve(root, "..", "jcrt-v2", "scripts", "schemas", "oai", "oai_dc.xsd");
const records = xml.match(/<oai_dc:dc\b[\s\S]*?<\/oai_dc:dc>/g) || [];
// Two rights regimes, keyed on the article's own dc:date. From 25.2 (2026-08-24)
// the author retains copyright and the issue is CC BY 4.0; before that the older
// all-rights text applies. Mirrors jcrt-v2/_config/license.js, as generate-sitemaps.mjs does.
const CC_BY_SINCE = "2026-08-24";
const rights = "<dc:rights>Copyright held by the author(s). Published in the Journal for Cultural and Religious Theory. https://jcrt.org/copyright/</dc:rights>";
const ccRights = "<dc:rights>© the author(s). Published in the Journal for Cultural and Religious Theory under a Creative Commons Attribution 4.0 International (CC BY 4.0) license (https://creativecommons.org/licenses/by/4.0/). Authors retain copyright.</dc:rights>";
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "jcrt-oai-"));

try {
	// Derived expectation, not a hardcoded count: the feed must carry one record per
	// archive article in the metadata tree. (A literal constant here went stale the same
	// way check_pdf_copyright.py's did.)
	const expected = fs
		.readdirSync(path.join(root, "metadata", "archives"), { recursive: true })
		.filter((f) => String(f).endsWith("metadata.json")).length;
	if (records.length !== expected) throw new Error(`Expected ${expected} Dublin Core records (one per metadata/archives article), found ${records.length}`);
	for (const [index, record] of records.entries()) {
		const date = record.match(/<dc:date>([^<]*)<\/dc:date>/)?.[1] || "";
		const expectsCcBy = date.slice(0, 10) >= CC_BY_SINCE;
		if (expectsCcBy) {
			// CC BY, and specifically BY -- a more restrictive variant slipping in
			// would still match "creative commons", so name the ones we reject.
			if (!record.includes(ccRights) || /by-nc|by-nd|by-sa/i.test(record)) {
				throw new Error(`Record ${index + 1} (${date}) should carry CC BY 4.0 rights metadata`);
			}
		} else if (!record.includes(rights) || /creative commons|cc[- ]by|creativecommons\.org/i.test(record)) {
			throw new Error(`Record ${index + 1} (${date}) has incorrect rights metadata`);
		}
		const file = path.join(temporary, `${index}.xml`);
		fs.writeFileSync(file, record.replaceAll("http://www.openarchives.org/OAI/2.0/oai_dc.xsd", schema));
		const result = spawnSync("xmllint", ["--noout", "--schema", schema, file], { encoding: "utf8" });
		if (result.status !== 0) throw new Error(`Record ${index + 1} failed OAI Dublin Core validation:\n${result.stderr}`);
	}
	console.log(`Validated ${records.length} OAI Dublin Core records.`);
} finally {
	fs.rmSync(temporary, { recursive: true, force: true });
}
