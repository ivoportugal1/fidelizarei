import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keeps Turbopack inside this project when other Node projects exist on the machine.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
