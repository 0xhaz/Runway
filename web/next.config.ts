import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The @runway/* workspace packages ship raw TypeScript source, so Next must
  // transpile them rather than expecting prebuilt JS.
  transpilePackages: [
    "@runway/shared",
    "@runway/indexer",
    "@runway/agent",
    "@runway/policy",
  ],
};

export default nextConfig;
