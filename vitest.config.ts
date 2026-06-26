import { defineConfig } from "vitest/config";

// Node environment by default. DOM-dependent test files opt in per-file with
// a `// @vitest-environment jsdom` docblock comment (see tests/badge.test.ts).
export default defineConfig({
  test: { environment: "node" },
});
