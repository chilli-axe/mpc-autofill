/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: false,
  },
  output: "export",
  images: { unoptimized: true },
};

module.exports = nextConfig;
