import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  outputFileTracingRoot: path.resolve(__dirname, "..", ".."),
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@domain": path.resolve(__dirname, "../../packages/domain/src"),
    };
    return config;
  },
};

export default nextConfig;
