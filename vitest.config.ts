import { defineConfig } from "vitest/config";

// Coverage policy: ADR-0014 (all logic exercised). Only files with real logic
// are measured; barrels / type-only / placeholders / tests are excluded.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/index.ts",
        "src/**/types.ts",
        "src/types/**",
        "src/fields/**",
        "**/*.test.ts",
      ],
      // ADR-0014: all logic exercised -> statements/functions/lines = 100%.
      // branches < 100% は防御的な `?? 既定` / `=== undefined` 等で、無理に通すと
      // coverage theater になるため実測直下（90%）を下限に（回帰防止・ADR-0014 記録）。
      thresholds: {
        statements: 100,
        functions: 100,
        lines: 100,
        branches: 90,
      },
    },
  },
});
