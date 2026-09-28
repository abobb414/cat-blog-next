import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 显式钉死 workspace root，避免外层目录存在 package-lock.json 时
  // 被自动推断为 monorepo 根，导致依赖解析失败
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
