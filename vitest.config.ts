import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  maxWorkers: 1,
  minWorkers: 1,
  test: {
    globals: false,
    environment: "node",
    sequence: {
      concurrent: false
    },
    pool: "forks"
  }
});
