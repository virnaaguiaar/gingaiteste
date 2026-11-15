import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O núcleo do GingAI é TypeScript puro do workspace packages/core
  transpilePackages: ["@gingai/core"],
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
