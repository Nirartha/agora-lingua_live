import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(self)" },
    ] }];
  },
};
export default config;
