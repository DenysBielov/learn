import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ['better-sqlite3', 'bcrypt', 'sharp', 'web-push'],
  transpilePackages: ['@flashcards/database', '@flashcards/shared'],
};

export default nextConfig;
