import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keeps Turbopack inside this project when other Node projects exist on the machine.
  turbopack: {
    root: process.cwd(),
  },
  // Dev only: lets a phone on the same network open the local app (e.g. DEV_ALLOWED_ORIGINS=192.168.0.10).
  allowedDevOrigins: (process.env.DEV_ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean),
};

export default nextConfig;
