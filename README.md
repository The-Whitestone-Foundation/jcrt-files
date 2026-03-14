# jcrt-files

Asset delivery repository for JCRT.

## Purpose
This repo receives synced assets from `jcrt-v2` and publishes them to Cloudflare R2, served by a Worker on:

- `https://files.jcrt.org/images/...`
- `https://files.jcrt.org/archives/...`
- `https://files.jcrt.org/citations/...`
- `https://files.jcrt.org/docs/...`

## Required secrets (GitHub repo: jcrt-files)
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Required Cloudflare setup
1. Create R2 bucket: `jcrt-files`.
2. Deploy worker from this repo (`wrangler deploy`).
3. Add Worker custom domain route for `files.jcrt.org/*`.
4. Ensure DNS for `files.jcrt.org` is in Cloudflare-managed `jcrt.org` zone.

## How sync works
- `jcrt-v2` workflow pushes mirrored content into this repo.
- This repo workflow uploads only changed files to R2 and deletes removed files.
