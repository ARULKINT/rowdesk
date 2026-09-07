import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/lib/testing/server-only-stub.ts"),
    },
  },
  test: {
    setupFiles: ["./vitest.setup.ts"],
    // Test files share one SQLite file via vitest.setup.ts — run them
    // sequentially so parallel workers don't race on migrating/writing it.
    fileParallelism: false,
  },
});
