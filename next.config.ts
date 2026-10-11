import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hanya untuk `next dev`: izinkan tes dari HP lewat IP LAN laptop (tidak berpengaruh ke produksi).
  // shortcut: IP ditulis langsung, ganti/tambah kalau IP laptop di jaringan berubah
  allowedDevOrigins: ["192.168.100.161"],
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
