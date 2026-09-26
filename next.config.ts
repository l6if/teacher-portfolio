import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    // الأنواع تُفحص صراحة عبر `bun run typecheck` — والبناء يرفض أي خطأ
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
