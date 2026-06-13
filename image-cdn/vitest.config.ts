import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workflows": new URL("src/__stubs__/cloudflare-workflows.ts", import.meta.url).pathname,
    },
  },
});
