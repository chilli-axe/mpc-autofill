interface Env {
  // Binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  thumbnails: R2Bucket;
  // Binding to Queues.
  thumbnailRefreshQueue: Queue<string>;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN: string;
  WORKER_DOMAIN: string;
}
