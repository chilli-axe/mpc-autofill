import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workflows": new URL(
        "src/__stubs__/cloudflare-workflows.ts",
        // @ts-ignore
        import.meta.url
      ).pathname,
    },
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
    }),
  ],
});
