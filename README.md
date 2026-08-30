[![Deploy jcrt-files to R2 + Worker](https://github.com/The-Whitestone-Foundation/jcrt-files/actions/workflows/deploy-r2-worker.yml/badge.svg?branch=main)](https://github.com/The-Whitestone-Foundation/jcrt-files/actions/workflows/deploy-r2-worker.yml)
# jcrt-files // files.jcrt.org


Asset delivery repository for JCRT.

## TODO (Adam)
- [x] ~~Grant the `CLOUDFLARE_API_TOKEN` Workers deploy permission.~~ **Resolved
      2026-08-30**: after the re-paste fixed the formatting and the permission grant
      added Workers Scripts: Edit, run 33297892081 logged `Deployed with TOKEN_PRIMARY`.
      The deploy-is-the-test token fallback (PRIMARY → V2 → BACKUP) stays in place as
      insurance.

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
- Every push runs an `rclone --checksum` comparison of the whole git-tracked tree against
  the bucket and uploads whatever differs (content-addressed — no diff windows, so a file
  committed during a cancelled run is picked up by the next one). The git tree is the
  source of truth.
- Deletion is opt-in: dispatch the workflow with `prune_deletes=true` to remove bucket
  objects no longer tracked in git.
- The Worker deploys only when `src/` or `wrangler.toml` changed (or `deploy_worker=true`).
