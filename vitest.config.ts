import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    include: ["tests/**/*.test.ts"],
    env: {
      // Klucze testowe – nigdy prawdziwe.
      APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://invalid/test",
      SESSION_SECRET: "test-secret-test-secret-test-secret-1234",
      APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    },
  },
});
