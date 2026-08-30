# Changelog

All notable changes to jcrt-files (files.jcrt.org). One version per commit; versions increment by one per commit from 00.00.00 at the initial commit.

## Highlights

- March 2026: files.jcrt.org split out of jcrt-v2 into its own repo, seeded with archive PDFs, scan images, and pre-generated citation/DOAJ/OAI-DC sitemaps.
- Early CI hardening: a run of March fixes (Cloudflare token fallbacks, R2 jurisdiction handling, wrangler v4 output parsing, upload parallelism/retries/timeouts) to make the GitHub Actions R2 deploy reliable.
- Citation tooling foundation: citation generation scripts and workflow launched March 15 with 2,332 initial RIS/CSL files, later refined for correct RIS author ordering, full issued dates, DOIs, and blog-vs-journal export.
- Bulk archive curation, March-July: repeated rounds of PDF tagging, metadata updates, and webp conversions as the back catalog was organized for the CDN.
- Cloudflare Worker feature growth: custom-domain routing, robots.txt handling, canonical-URL and 404 fixes, and repeated worker optimization passes.
- Steady issue-publication rhythm: each new issue (25.1, 25.2, ...) lands as a content commit, followed by metadata fixes and an automated "regenerate citation files" commit.
- August 18 citation-accuracy overhaul: fixed inverted RIS author names and blog-type export drift, each regenerating roughly 1,200-1,300 citation files.
- The August 29 pipeline rebuild: rclone checksum-based sync replaces ad hoc uploads for sub-30s deploys, with the rclone binary itself later cached between runs.
- Same rebuild: per-folder file-inventory sitemaps plus an XSLT stylesheet served at the canonical /sitemap.xml via a worker rewrite; a legacy citation alias shadowing real files (causing 404s) fixed; CDN folder deployment made auto-discovering instead of hardcoded.
- Same rebuild: the worker refactored into explicit ponyfill helper modules (http-meta, keys) and a new imageTransform module added for on-the-fly image transforms (w/h/q/f, scale-down, via-guard); the PDF rights check restored as incremental; worker deploy hardened to trim and fall back across Cloudflare API tokens.

## [00.01.04] — 2026-08-29
ci: prune mode must sync per-directory; files-from scoped deletions to nothing
- Notes: ci: prune mode must sync per-directory; files-from scoped deletions to nothing.

## [00.01.03] — 2026-08-29
post: changelog with per-commit versions; README deploy docs + token TODO
- Notes: post: changelog with per-commit versions; README deploy docs + token TODO.

## [00.01.02] — 2026-08-29
ci: trim and fall back across Cloudflare tokens for worker deploy
- Notes: Hardens the worker-deploy CI step to trim stray whitespace from Cloudflare API token secrets and fall back across multiple token env vars, closing the same class of auth flakiness that plagued the original R2 deploy pipeline back in March.

## [00.01.01] — 2026-08-29
ci: cache rclone binary between deploys
- Notes: Caches the rclone binary between deploy runs instead of re-downloading it every time, trimming startup overhead from the newly sub-30-second deploy pipeline.

## [00.01.00] — 2026-08-29
refactor: ponyfill worker split + image transforms (w/h/q/f, scale-down, via-guard)
- Notes: Refactors the monolithic worker into explicit ponyfill helper modules (http-meta.js, keys.js) with behavior verified identical, and adds a new imageTransform.js module: on-the-fly image transforms (width/height/quality/format, scale-down) for images/ rasters, with a via-header guard so transform subrequests cannot loop back into the worker.

## [00.00.99] — 2026-08-29
fix: drop stale a11ty audit from the repo root
- Notes: Deletes a11ty-audit.md, a one-off accessibility-audit artifact sitting at the repo root that nothing referenced and that sat outside the CDN sync set — pure repo hygiene with no effect on what files.jcrt.org serves.

## [00.00.98] — 2026-08-29
fix: probe R2 endpoint instead of trusting jurisdiction secret
- Notes: The first rclone deploy failed with "directory not found" because the jurisdiction secret routed it to an endpoint where the bucket does not exist; the deploy now probes the default endpoint first and falls back to the jurisdiction-scoped one.

## [00.00.97] — 2026-08-29
perf: rclone checksum sync to R2, sub-30s deploys
- Notes: Replaces the ad hoc upload script with rclone's checksum-based sync so only changed files transfer, cutting typical deploy time to under 30 seconds.

## [00.00.96] — 2026-08-29
fix: auto-discover CDN folders so new content deploys without editing the workflow
- Notes: The deploy workflow now discovers top-level CDN folders automatically instead of relying on a hardcoded target list, so adding a new content directory no longer requires editing the workflow file.

## [00.00.95] — 2026-08-29
fix: legacy citation alias shadowed real files, causing 404s
- Notes: A legacy citation-URL alias was shadowing real files on the CDN, causing requests that should have resolved to 404 instead; this fixes the alias handling.

## [00.00.94] — 2026-08-29
fix: track scripts/ — stray gitignore hid new tooling from the repo
- Notes: A stray .gitignore entry was excluding the scripts/ directory from version control, silently hiding new deploy and citation tooling from the repo; removes the ignore rule and checks the scripts in.

## [00.00.93] — 2026-08-29
fix: restore PDF rights check, incremental and no hardcoded count
- Notes: Restores the PDF rights-check step that had been dropped, this time incremental and without a hardcoded file count so it doesn't silently break as PDFs are added.

## [00.00.92] — 2026-08-29
fix: deploy religioustheory to R2, add file sitemaps and XSLT
- Notes: The deploy workflow never synced religioustheory/ — it was missing from both the push-trigger paths and DEFAULT_TARGETS — so newly committed files there 404'd on the CDN. Also adds a generated file-inventory sitemap per served folder (served at the canonical /sitemap.xml via a worker rewrite, with lastmod from git commit dates instead of CI checkout mtimes) plus a properly content-typed XSLT stylesheet, fixes sitemap cache headers that were inheriting a 1-year immutable default, points robots.txt at the new sitemap, and drops the perpetually-stale check_pdf_copyright.py script.

## [00.00.91] — 2026-08-29
Create 9780593493205.pdf
- Notes: Adds 9780593493205.pdf (a book cover/PDF asset) to the CDN file tree.

## [00.00.90] — 2026-08-27
chore: regenerate citation files
- Notes: Large citation-file regeneration (1,524 files touched) picking up the full-date fix to archive citations from the previous commit.

## [00.00.89] — 2026-08-26
fix: emit full dates in archive citations
- Notes: Archive citation exports were emitting year-only dates instead of full dates; fixes the generator and regenerates the 135 affected citation files.

## [00.00.88] — 2026-08-27
chore: regenerate citation files
- Notes: Small citation-file regeneration following the preceding metadata fixes.

## [00.00.87] — 2026-08-26
Merge branch 'main' of https://github.com/The-Whitestone-Foundation/jcrt-files
- Notes: Merge commit reconciling a parallel push to main; introduces no changes of its own beyond the merged history.

## [00.00.86] — 2026-08-26
metadata update
- Notes: Metadata corrections across 38 files, feeding the next citation regeneration.

## [00.00.85] — 2026-08-27
chore: regenerate citation files
- Notes: Citation-file regeneration picking up the preceding metadata update.

## [00.00.84] — 2026-08-26
Merge branch 'main' of https://github.com/The-Whitestone-Foundation/jcrt-files
- Notes: Merge commit reconciling a parallel push to main, bringing in 18 regenerated citation files from that branch.

## [00.00.83] — 2026-08-26
metadata fix
- Notes: Small metadata corrections across 12 files.

## [00.00.82] — 2026-08-26
edit: 25.2 page number fix
- Notes: Corrects page numbers recorded for the 25.2 issue across 10 files.

## [00.00.81] — 2026-08-25
chore: regenerate citation files
- Notes: Citation-file regeneration for the newly published 25.2 issue.

## [00.00.80] — 2026-08-25
25.2
- Notes: Publishes issue 25.2: adds its article PDFs and metadata to the archive.

## [00.00.79] — 2026-08-19
chore: regenerate citation files
- Notes: Citation-file regeneration following the RIS author-inversion and workflow write-access fixes.

## [00.00.78] — 2026-08-18
fix: invert archive RIS authors; grant citation workflow write access
- Notes: Archive citations exported "AU - Kevin S. Grane" while theory citations exported the inverted "AU - Grane, Kevin S." for the same person; archive export now shares the same risAuthor() helper. Regenerating also fixed 248 theory posts that had just been credited to their real authors instead of "editors", and the Generate Citations workflow — reached for the first time via the new jcrt-v2 dispatch — was failing on push because the org default GITHUB_TOKEN is read-only, so this grants contents: write.

## [00.00.77] — 2026-08-18
fix: emit blog-type citations with DOI and full dates
- Notes: Religious Theory blog posts were exported as TY - JOUR / article-journal with empty journal fields, a year-only date, and no DOI, so reference managers rendered them as journal articles with an unknown author and no date. They now export as TY - BLOG / post-weblog with correct container/type tags, inverted RIS author names, full issued dates, and a normalized DOI; regenerating also caught drift where 39 theory posts had been misattributed to "Books" as author and 273 archive URLs pointed at renamed paths.

## [00.00.76] — 2026-08-11
Create book-review-guidelines.pdf
- Notes: Added book-review-guidelines.pdf to the CDN file tree.

## [00.00.75] — 2026-08-05
edit: updating categories
- Notes: Content/metadata change: updating categories.

## [00.00.74] — 2026-08-03
add new image
- Notes: add new image.

## [00.00.73] — 2026-08-03
Create jcrt-doi.png
- Notes: Added jcrt-doi.png to the CDN file tree.

## [00.00.72] — 2026-07-30
Update bimi.svg
- Notes: Updated bimi.svg in the CDN file tree.

## [00.00.71] — 2026-07-29
Create bimi.svg
- Notes: Added bimi.svg to the CDN file tree.

## [00.00.70] — 2026-07-19
Create scans.pdf
- Notes: Added scans.pdf to the CDN file tree.

## [00.00.69] — 2026-07-13
edit: metadata update
- Notes: Content/metadata change: metadata update.

## [00.00.68] — 2026-07-09
Add homepage thumbnail versions of recent issue covers
- Notes: Add homepage thumbnail versions of recent issue covers.

## [00.00.67] — 2026-07-09
edit optmize workers
- Notes: edit optmize workers.

## [00.00.66] — 2026-07-08
Update submission-guidelines-jcrt-stylesheet.pdf
- Notes: Updated submission-guidelines-jcrt-stylesheet.pdf in the CDN file tree.

## [00.00.65] — 2026-07-08
Update submission-guidelines-jcrt-stylesheet.pdf
- Notes: Updated submission-guidelines-jcrt-stylesheet.pdf in the CDN file tree.

## [00.00.64] — 2026-07-08
Create submission-guidelines-jcrt-stylesheet.pdf
- Notes: Added submission-guidelines-jcrt-stylesheet.pdf to the CDN file tree.

## [00.00.63] — 2026-07-05
update: adding metadata.json
- Notes: Content/metadata change: adding metadata.json.

## [00.00.62] — 2026-06-27
fix: webfirewall
- Notes: Bug fix: webfirewall.

## [00.00.61] — 2026-06-26
Add robots.txt handler to Worker
- Notes: Add robots.txt handler to Worker.

## [00.00.60] — 2026-06-09
Create jajs.webp
- Notes: Added jajs.webp to the CDN file tree.

## [00.00.59] — 2026-06-09
files
- Notes: files.

## [00.00.58] — 2026-05-29
Update worker.js
- Notes: Updated worker.js in the CDN file tree.

## [00.00.57] — 2026-05-04
updating canonical urls
- Notes: updating canonical urls.

## [00.00.56] — 2026-04-30
fixing 404
- Notes: fixing 404.

## [00.00.55] — 2026-04-22
Update worker.js
- Notes: Updated worker.js in the CDN file tree.

## [00.00.54] — 2026-04-18
worker
- Notes: worker.

## [00.00.53] — 2026-04-17
Restore postscript.pdf
- Notes: Restored postscript.pdf after an earlier deletion.

## [00.00.52] — 2026-04-17
Delete postscript.pdf
- Notes: Removed postscript.pdf from the CDN file tree.

## [00.00.51] — 2026-04-17
updating citation files
- Notes: updating citation files.

## [00.00.50] — 2026-04-17
Update postscript.pdf
- Notes: Updated postscript.pdf in the CDN file tree.

## [00.00.49] — 2026-04-17
adding files
- Notes: adding files.

## [00.00.48] — 2026-04-16
25.1 pdfs
- Notes: 25.1 pdfs.

## [00.00.47] — 2026-04-10
updating the metadata
- Notes: updating the metadata.

## [00.00.46] — 2026-04-09
update files
- Notes: update files.

## [00.00.45] — 2026-03-21
new feed
- Notes: new feed.

## [00.00.44] — 2026-03-21
adding missing pdfs
- Notes: adding missing pdfs.

## [00.00.43] — 2026-03-21
webp
- Notes: webp.

## [00.00.42] — 2026-03-21
Update a11ty-audit.md
- Notes: Updated a11ty-audit.md in the CDN file tree.

## [00.00.41] — 2026-03-21
tagging pdf cont
- Notes: tagging pdf cont.

## [00.00.40] — 2026-03-21
tagging pdf cont
- Notes: tagging pdf cont.

## [00.00.39] — 2026-03-21
tagging pdfs cont
- Notes: tagging pdfs cont.

## [00.00.38] — 2026-03-21
Update a11ty-audit.md
- Notes: Updated a11ty-audit.md in the CDN file tree.

## [00.00.37] — 2026-03-21
tagging pdfs cont
- Notes: tagging pdfs cont.

## [00.00.36] — 2026-03-21
tagg pdfs cont
- Notes: tagg pdfs cont.

## [00.00.35] — 2026-03-21
tagging pdfs
- Notes: tagging pdfs.

## [00.00.34] — 2026-03-21
updating metadata
- Notes: updating metadata.

## [00.00.33] — 2026-03-21
tagging pdfs
- Notes: tagging pdfs.

## [00.00.32] — 2026-03-19
Update vasquez.pdf
- Notes: Updated vasquez.pdf in the CDN file tree.

## [00.00.31] — 2026-03-17
adding missing files
- Notes: adding missing files.

## [00.00.30] — 2026-03-16
cleaning up citations
- Notes: cleaning up citations.

## [00.00.29] — 2026-03-15
Increase timeout to 240min, add target_dirs input, add .ris content type
- Notes: Increase timeout to 240min, add target_dirs input, add .ris content type.

## [00.00.28] — 2026-03-15
Increase deploy timeout to 120 minutes for full sync
- Notes: Increase deploy timeout to 120 minutes for full sync.

## [00.00.27] — 2026-03-15
Switch to sequential uploads with visible progress/errors
- Notes: Switch to sequential uploads with visible progress/errors.

## [00.00.26] — 2026-03-15
Reduce R2 upload parallelism to 2, increase retries to 5
- Notes: Reduce R2 upload parallelism to 2, increase retries to 5.

## [00.00.25] — 2026-03-15
Revert "sync: jcrt-v2 assets @ 25c5bd3ea78de1ee841d3953a9952afca99b4003"
- Notes: Revert "sync: jcrt-v2 assets @ 25c5bd3ea78de1ee841d3953a9952afca99b4003".

## [00.00.24] — 2026-03-15
Fix R2 deploy: use temp file for xargs, tolerate partial failures
- Notes: Fix R2 deploy: use temp file for xargs, tolerate partial failures.

## [00.00.23] — 2026-03-15
Fix R2 deploy: parallel uploads, prevent cancellation
- Notes: Fix R2 deploy: parallel uploads, prevent cancellation.

## [00.00.22] — 2026-03-15
sync: jcrt-v2 assets @ 25c5bd3ea78de1ee841d3953a9952afca99b4003
- Notes: Synced CDN assets from jcrt-v2 at commit 25c5bd3ea78d.

## [00.00.21] — 2026-03-15
Add 10.2 scan images and TIFFs from jcrt-v2
- Notes: Add 10.2 scan images and TIFFs from jcrt-v2.

## [00.00.20] — 2026-03-15
Add pre-generated DOAJ, OAI-DC, and citation sitemaps
- Notes: Add pre-generated DOAJ, OAI-DC, and citation sitemaps.

## [00.00.19] — 2026-03-15
Add 679 archive PDFs from jcrt-v2
- Notes: Add 679 archive PDFs from jcrt-v2.

## [00.00.18] — 2026-03-15
building json search files
- Notes: building json search files.

## [00.00.17] — 2026-03-15
Add citation generation: scripts + workflow + 2,332 citation files
- Notes: Add citation generation: scripts + workflow + 2,332 citation files.

## [00.00.16] — 2026-03-15
sync: jcrt-v2 assets @ 1c63b1c766a1e8d3d4fa38664e96bbae119911dd
- Notes: Synced CDN assets from jcrt-v2 at commit 1c63b1c766a1.

## [00.00.15] — 2026-03-14
fix: use verified token for wrangler deploy
- Notes: Bug fix: use verified token for wrangler deploy.

## [00.00.14] — 2026-03-14
ci: fix R2 bucket detection for wrangler v4 text output
- Notes: CI/deploy workflow change: fix R2 bucket detection for wrangler v4 text output.

## [00.00.13] — 2026-03-14
ci: add CLOUDFLARE_API_TOKEN_V2 auth fallback
- Notes: CI/deploy workflow change: add CLOUDFLARE_API_TOKEN_V2 auth fallback.

## [00.00.12] — 2026-03-14
ci: support JCRT_R2 account token fallbacks
- Notes: CI/deploy workflow change: support JCRT_R2 account token fallbacks.

## [00.00.11] — 2026-03-14
ci: add Cloudflare token fallback for R2 deploy
- Notes: CI/deploy workflow change: add Cloudflare token fallback for R2 deploy.

## [00.00.10] — 2026-03-14
ci: fix wrangler bucket preflight command
- Notes: CI/deploy workflow change: fix wrangler bucket preflight command.

## [00.00.09] — 2026-03-14
ci: remove jurisdiction handling for global R2 uploads
- Notes: CI/deploy workflow change: remove jurisdiction handling for global R2 uploads.

## [00.00.08] — 2026-03-14
ci: add R2 preflight, jurisdiction support, and upload retries
- Notes: CI/deploy workflow change: add R2 preflight, jurisdiction support, and upload retries.

## [00.00.07] — 2026-03-14
Update README.md
- Notes: Updated README.md in the CDN file tree.

## [00.00.06] — 2026-03-14
ci: deploy to remote R2 and make prune optional
- Notes: CI/deploy workflow change: deploy to remote R2 and make prune optional.

## [00.00.05] — 2026-03-14
sync: jcrt-v2 assets @ a46b4a057480cd0e1ab6a3853e5d0e498ea73af1
- Notes: Synced CDN assets from jcrt-v2 at commit a46b4a057480.

## [00.00.04] — 2026-03-14
ci: add manual full-sync mode for R2 uploads
- Notes: CI/deploy workflow change: add manual full-sync mode for R2 uploads.

## [00.00.03] — 2026-03-14
fix: use valid custom-domain route pattern for worker
- Notes: Bug fix: use valid custom-domain route pattern for worker.

## [00.00.02] — 2026-03-14
splitting jcrt-v2 and jcrt-files
- Notes: splitting jcrt-v2 and jcrt-files.

## [00.00.01] — 2026-03-14
splitting jcrt-v2 and jcrt-files
- Notes: splitting jcrt-v2 and jcrt-files.

## [00.00.00] — 2026-03-14
Initial commit
- Notes: Initial commit.
