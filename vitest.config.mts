import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests only (stage 1 of docs/test-plan.md): pure logic, no database or browser.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
