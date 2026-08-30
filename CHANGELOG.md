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

## [00.01.32] — 2026-08-30
adding dois and patching
- Notes: adding dois and patching.

## [00.01.31] — 2026-08-30
pdf patching
- Notes: pdf patching.

## [00.01.30] — 2026-08-30
Update update-changelog.mjs
- Notes: Update update-changelog.mjs.

## [00.01.29] — 2026-08-30
Merge branch 'main' of https://github.com/The-Whitestone-Foundation/jcrt-files
- Notes: Merge branch 'main' of https://github.com/The-Whitestone-Foundation/jcrt-files.

## [00.01.28] — 2026-08-30
fixing change log
- Notes: fixing change log.

## [00.01.30] — 2026-08-30
adding dois fixing apostrophe problems
- Notes: adding dois fixing apostrophe problems.

## [00.01.26] — 2026-08-30
adding dois fixing apostrophe problems
- Notes: adding dois fixing apostrophe problems.

## [00.01.25] — 2026-08-30
Update generate-file-sitemaps.mjs
- Notes: Update generate-file-sitemaps.mjs.

## [00.01.24] — 2026-08-30
chore: regenerate file sitemaps and changelog
- Notes: chore: regenerate file sitemaps and changelog.

## [00.01.23] — 2026-08-30
Merge branch 'main' of https://github.com/The-Whitestone-Foundation/jcrt-files
- Notes: Merge branch 'main' of https://github.com/The-Whitestone-Foundation/jcrt-files.

## [00.01.22] — 2026-08-30
chore: regenerate citation and metadata files
- Notes: chore: regenerate citation and metadata files.

## [00.01.21] — 2026-08-30
edit: prepping for KCWorks import
- Notes: edit: prepping for KCWorks import.

## [00.01.20] — 2026-08-30
chore: regenerate file sitemaps and changelog
- Notes: chore: regenerate file sitemaps and changelog.

## [00.01.19] — 2026-08-30
image addition
- Notes: image addition.

## [00.01.18] — 2026-08-30
ci: actions/cache v6, clears node20 deprecation warning
- Notes: ci: actions/cache v6, clears node20 deprecation warning.

## [00.01.17] — 2026-08-30
post: token TODO resolved — primary deploys
- Notes: post: token TODO resolved — primary deploys.

## [00.01.16] — 2026-08-30
post: readme spacing
- Notes: post: readme spacing.

## [00.01.15] — 2026-08-30
post: token TODO now describes the permission gap, not the whitespace
- Notes: post: token TODO now describes the permission gap, not the whitespace.

## [00.01.14] — 2026-08-30
ci: worker deploy tries each token by deploying, not by whoami
- Notes: ci: worker deploy tries each token by deploying, not by whoami.

## [00.01.13] — 2026-08-30
chore: regenerate file sitemaps and changelog
- Notes: chore: regenerate file sitemaps and changelog.

## [00.01.12] — 2026-08-30
update: publish 25.2 to OAI-PMH and DOAJ feeds; derive record count; fix boolean published filter
- Notes: update: publish 25.2 to OAI-PMH and DOAJ feeds; derive record count; fix boolean published filter.

## [00.01.11] — 2026-08-30
chore: regenerate file sitemaps and changelog
- Notes: chore: regenerate file sitemaps and changelog.

## [00.01.10] — 2026-08-30
fix: restore last 3 referenced images from jcrt-v2 history
- Notes: fix: restore last 3 referenced images from jcrt-v2 history.

## [00.01.09] — 2026-08-30
chore: regenerate file sitemaps and changelog
- Notes: chore: regenerate file sitemaps and changelog.

## [00.01.08] — 2026-08-30
fix: generate missing citations and metadata; coverage guard
- Notes: fix: generate missing citations and metadata; coverage guard.

## [00.01.07] — 2026-08-29
ci: checkout v6, pin node 24 in both workflows
- Notes: ci: checkout v6, pin node 24 in both workflows.

## [00.01.06] — 2026-08-30
chore: regenerate file sitemaps and changelog
- Notes: chore: regenerate file sitemaps and changelog.

## [00.01.05] — 2026-08-29
fix: restore 198 pruned images from jcrt-v2 history; auto-update changelog in CI
- Notes: fix: restore 198 pruned images from jcrt-v2 history; auto-update changelog in CI.

## [00.01.04] — 2026-08-29
ci: prune mode must sync per-directory; files-from scoped deletions to nothing
- Notes: ci: prune mode must sync per-directory; files-from scoped deletions to nothing.

## [00.01.03] — 2026-08-29
post: changelog with per-commit versions; README deploy docs + token TODO
- Notes: post: changelog with per-commit versions; README deploy docs + token TODO.

## [00.01.02] — 2026-08-29
ci: trim and fall back across Cloudflare tokens for worker deploy
- Notes: ci: trim and fall back across Cloudflare tokens for worker deploy.

## [00.01.01] — 2026-08-29
ci: cache rclone binary between deploys
- Notes: ci: cache rclone binary between deploys.

## [00.01.00] — 2026-08-29
refactor: ponyfill worker split + image transforms (w/h/q/f, scale-down, via-guard)
- Notes: refactor: ponyfill worker split + image transforms (w/h/q/f, scale-down, via-guard).

## [00.00.99] — 2026-08-29
fix: drop stale a11ty audit from the repo root
- Notes: fix: drop stale a11ty audit from the repo root.

## [00.00.98] — 2026-08-29
fix: probe R2 endpoint instead of trusting jurisdiction secret
- Notes: fix: probe R2 endpoint instead of trusting jurisdiction secret.

## [00.00.97] — 2026-08-29
perf: rclone checksum sync to R2, sub-30s deploys
- Notes: perf: rclone checksum sync to R2, sub-30s deploys.

## [00.00.96] — 2026-08-29
fix: auto-discover CDN folders so new content deploys without editing the workflow
- Notes: fix: auto-discover CDN folders so new content deploys without editing the workflow.

## [00.00.95] — 2026-08-29
fix: legacy citation alias shadowed real files, causing 404s
- Notes: fix: legacy citation alias shadowed real files, causing 404s.

## [00.00.94] — 2026-08-29
fix: track scripts/ — stray gitignore hid new tooling from the repo
- Notes: fix: track scripts/ — stray gitignore hid new tooling from the repo.

## [00.00.93] — 2026-08-29
fix: restore PDF rights check, incremental and no hardcoded count
- Notes: fix: restore PDF rights check, incremental and no hardcoded count.

## [00.00.92] — 2026-08-29
fix: deploy religioustheory to R2, add file sitemaps and XSLT
- Notes: fix: deploy religioustheory to R2, add file sitemaps and XSLT.

## [00.00.91] — 2026-08-29
Create 9780593493205.pdf
- Notes: Create 9780593493205.pdf.

## [00.00.90] — 2026-08-27
chore: regenerate citation files
- Notes: chore: regenerate citation files.

## [00.00.89] — 2026-08-26
fix: emit full dates in archive citations
- Notes: fix: emit full dates in archive citations.

## [00.00.88] — 2026-08-27
chore: regenerate citation files
- Notes: chore: regenerate citation files.

## [00.00.87] — 2026-08-26
Merge branch 'main' of https://github.com/The-Whitestone-Foundation/jcrt-files
- Notes: Merge branch 'main' of https://github.com/The-Whitestone-Foundation/jcrt-files.

## [00.00.86] — 2026-08-26
metadata update
- Notes: metadata update.

## [00.00.85] — 2026-08-27
chore: regenerate citation files
- Notes: chore: regenerate citation files.

## [00.00.84] — 2026-08-26
Merge branch 'main' of https://github.com/The-Whitestone-Foundation/jcrt-files
- Notes: Merge branch 'main' of https://github.com/The-Whitestone-Foundation/jcrt-files.

## [00.00.83] — 2026-08-26
metadata fix
- Notes: metadata fix.

## [00.00.82] — 2026-08-26
edit: 25.2 page number fix
- Notes: edit: 25.2 page number fix.

## [00.00.81] — 2026-08-25
chore: regenerate citation files
- Notes: chore: regenerate citation files.

## [00.00.80] — 2026-08-25
25.2
- Notes: 25.2.

## [00.00.79] — 2026-08-19
chore: regenerate citation files
- Notes: chore: regenerate citation files.

## [00.00.78] — 2026-08-18
fix: invert archive RIS authors; grant citation workflow write access
- Notes: fix: invert archive RIS authors; grant citation workflow write access.

## [00.00.77] — 2026-08-18
fix: emit blog-type citations with DOI and full dates
- Notes: fix: emit blog-type citations with DOI and full dates.

## [00.00.76] — 2026-08-11
Create book-review-guidelines.pdf
- Notes: Create book-review-guidelines.pdf.

## [00.00.75] — 2026-08-05
edit: updating categories
- Notes: edit: updating categories.

## [00.00.74] — 2026-08-03
add new image
- Notes: add new image.

## [00.00.73] — 2026-08-03
Create jcrt-doi.png
- Notes: Create jcrt-doi.png.

## [00.00.72] — 2026-07-30
Update bimi.svg
- Notes: Update bimi.svg.

## [00.00.71] — 2026-07-29
Create bimi.svg
- Notes: Create bimi.svg.

## [00.00.70] — 2026-07-19
Create scans.pdf
- Notes: Create scans.pdf.

## [00.00.69] — 2026-07-13
edit: metadata update
- Notes: edit: metadata update.

## [00.00.68] — 2026-07-09
Add homepage thumbnail versions of recent issue covers
- Notes: Add homepage thumbnail versions of recent issue covers.

## [00.00.67] — 2026-07-09
edit optmize workers
- Notes: edit optmize workers.

## [00.00.66] — 2026-07-08
Update submission-guidelines-jcrt-stylesheet.pdf
- Notes: Update submission-guidelines-jcrt-stylesheet.pdf.

## [00.00.65] — 2026-07-08
Update submission-guidelines-jcrt-stylesheet.pdf
- Notes: Update submission-guidelines-jcrt-stylesheet.pdf.

## [00.00.64] — 2026-07-08
Create submission-guidelines-jcrt-stylesheet.pdf
- Notes: Create submission-guidelines-jcrt-stylesheet.pdf.

## [00.00.63] — 2026-07-05
update: adding metadata.json
- Notes: update: adding metadata.json.

## [00.00.62] — 2026-06-27
fix: webfirewall
- Notes: fix: webfirewall.

## [00.00.61] — 2026-06-26
Add robots.txt handler to Worker
- Notes: Add robots.txt handler to Worker.

## [00.00.60] — 2026-06-09
Create jajs.webp
- Notes: Create jajs.webp.

## [00.00.59] — 2026-06-09
files
- Notes: files.

## [00.00.58] — 2026-05-29
Update worker.js
- Notes: Update worker.js.

## [00.00.57] — 2026-05-04
updating canonical urls
- Notes: updating canonical urls.

## [00.00.56] — 2026-04-30
fixing 404
- Notes: fixing 404.

## [00.00.55] — 2026-04-22
Update worker.js
- Notes: Update worker.js.

## [00.00.54] — 2026-04-18
worker
- Notes: worker.

## [00.00.53] — 2026-04-17
Restore postscript.pdf
- Notes: Restore postscript.pdf.

## [00.00.52] — 2026-04-17
Delete postscript.pdf
- Notes: Delete postscript.pdf.

## [00.00.51] — 2026-04-17
updating citation files
- Notes: updating citation files.

## [00.00.50] — 2026-04-17
Update postscript.pdf
- Notes: Update postscript.pdf.

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
- Notes: Update a11ty-audit.md.

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
- Notes: Update a11ty-audit.md.

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
- Notes: Update vasquez.pdf.

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
- Notes: sync: jcrt-v2 assets @ 25c5bd3ea78de1ee841d3953a9952afca99b4003.

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
- Notes: sync: jcrt-v2 assets @ 1c63b1c766a1e8d3d4fa38664e96bbae119911dd.

## [00.00.15] — 2026-03-14
fix: use verified token for wrangler deploy
- Notes: fix: use verified token for wrangler deploy.

## [00.00.14] — 2026-03-14
ci: fix R2 bucket detection for wrangler v4 text output
- Notes: ci: fix R2 bucket detection for wrangler v4 text output.

## [00.00.13] — 2026-03-14
ci: add CLOUDFLARE_API_TOKEN_V2 auth fallback
- Notes: ci: add CLOUDFLARE_API_TOKEN_V2 auth fallback.

## [00.00.12] — 2026-03-14
ci: support JCRT_R2 account token fallbacks
- Notes: ci: support JCRT_R2 account token fallbacks.

## [00.00.11] — 2026-03-14
ci: add Cloudflare token fallback for R2 deploy
- Notes: ci: add Cloudflare token fallback for R2 deploy.

## [00.00.10] — 2026-03-14
ci: fix wrangler bucket preflight command
- Notes: ci: fix wrangler bucket preflight command.

## [00.00.09] — 2026-03-14
ci: remove jurisdiction handling for global R2 uploads
- Notes: ci: remove jurisdiction handling for global R2 uploads.

## [00.00.08] — 2026-03-14
ci: add R2 preflight, jurisdiction support, and upload retries
- Notes: ci: add R2 preflight, jurisdiction support, and upload retries.

## [00.00.07] — 2026-03-14
Update README.md
- Notes: Update README.md.

## [00.00.06] — 2026-03-14
ci: deploy to remote R2 and make prune optional
- Notes: ci: deploy to remote R2 and make prune optional.

## [00.00.05] — 2026-03-14
sync: jcrt-v2 assets @ a46b4a057480cd0e1ab6a3853e5d0e498ea73af1
- Notes: sync: jcrt-v2 assets @ a46b4a057480cd0e1ab6a3853e5d0e498ea73af1.

## [00.00.04] — 2026-03-14
ci: add manual full-sync mode for R2 uploads
- Notes: ci: add manual full-sync mode for R2 uploads.

## [00.00.03] — 2026-03-14
fix: use valid custom-domain route pattern for worker
- Notes: fix: use valid custom-domain route pattern for worker.

## [00.00.02] — 2026-03-14
splitting jcrt-v2 and jcrt-files
- Notes: splitting jcrt-v2 and jcrt-files.

## [00.00.01] — 2026-03-14
splitting jcrt-v2 and jcrt-files
- Notes: splitting jcrt-v2 and jcrt-files.

## [00.00.00] — 2026-03-14
Initial commit
- Notes: Initial commit.
