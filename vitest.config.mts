import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    env: loadEnv(mode, process.cwd(), ""), // loads .env, .env.local into process.env for tests
    testTimeout: 30_000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
}));
