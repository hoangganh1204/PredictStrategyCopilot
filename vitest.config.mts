import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    // Default: node env for server-side / pure logic tests
    // React component tests can override with @vitest-environment jsdom docblock
    environment: "node",
    globals: true,
    setupFiles: [],
    passWithNoTests: true,
    // Treat @mysten/* and MSW as external ESM — don't try to bundle them
    server: {
      deps: {
        external: [/node_modules/],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
