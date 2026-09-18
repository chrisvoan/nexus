import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory otherwise makes Turbopack pick the wrong root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
