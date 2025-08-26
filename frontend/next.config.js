const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  compiler: { styledComponents: true },
  reactStrictMode: true,

  // the below config for why did you render was retrieved from https://stackoverflow.com/a/72400455/13021511
  webpack(config, { dev, isServer }) {
    // why did you render
    if (dev && !isServer) {
      const originalEntry = config.entry;
      config.entry = async () => {
        const wdrPath = path.resolve(__dirname, "./scripts/whyDidYouRender.ts");
        const entries = await originalEntry();
        if (entries["main.js"] && !entries["main.js"].includes(wdrPath)) {
          entries["main.js"].unshift(wdrPath);
        }
        return entries;
      };
    }

    return config;
  },
};

module.exports = nextConfig;

// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(module.exports, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "nicholas-de-paola-3af166ac6",
  project: "mpc-autofill",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
});
