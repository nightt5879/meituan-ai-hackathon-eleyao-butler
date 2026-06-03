import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// Mirrors the tsconfig path alias (@/* -> ./*) so tests can import "@/lib/...".
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(projectRoot)
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
