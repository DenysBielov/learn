import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { resolve } from "path";

const rootPkg = JSON.parse(
  readFileSync(resolve(__dirname, "../../package.json"), "utf-8")
);

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ['better-sqlite3', 'sharp', 'web-push'],
  transpilePackages: ['@flashcards/database', '@flashcards/shared'],
  env: {
    NEXT_PUBLIC_APP_VERSION: rootPkg.version,
  },
};

export default nextConfig;
