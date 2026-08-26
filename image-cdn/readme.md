# image-cdn

Cloudflare Worker that proxies and caches card images fetched from Google Drive,
so the frontend (and PDF generator) never fetch large images directly from Drive.

## Endpoints

`GET /images/google_drive/{small|large|full}/{driveFileId}.jpg?dpi=<n>&jpgQuality=<n>`

- `small`/`large` are served through an R2 cache (binding `thumbnails`): cache hit
  serves straight from R2, cache miss proxies from Drive and populates the cache
  in the background.
- `full` is always a live proxy (no caching) so callers can vary `dpi`/`jpgQuality`
  per request without unbounded cache growth.

No authentication is required to fetch images - Drive files just need to be
publicly shared, same as the rest of this project's card sourcing.

## Google OAuth secrets

`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` are only used
by the scheduled `ThumbnailRefreshWorkflow` (see `wrangler.toml`'s
`[[workflows]]`/`schedules`), which checks Drive's `modifiedTime` to invalidate
stale R2 cache entries once a day. They are **not** used by the request-serving
path in `src/index.ts` - a fresh deploy works for serving images even before
real OAuth credentials are wired up; only the daily refresh job will no-op until
then.

## Deploying

Deployed via `.github/workflows/cloudflare-workers-ci.yml` (`publish-image-cdn`
job) on every push to `master` that touches this directory, using
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and the three
`IMAGE_CDN_GOOGLE_*` repo secrets. The R2 bucket (`thumbnails`) must already
exist in the target Cloudflare account before the first deploy.
