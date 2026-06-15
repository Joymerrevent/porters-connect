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
      // ADR-0014: all logic exercised. perFile=true で「各ファイル」に閾値を適用
      // （aggregate で弱いファイルが隠れるのを防ぐ）。statements/functions/lines=100%。
      // branches は防御的な `?? 既定` / `=== undefined` を意味あるテストで埋めつつ、
      // 真に到達不能な分岐のみ限定 ignore。各ファイル 90% を下限に。
      thresholds: {
        perFile: true,
        statements: 100,
        functions: 100,
        lines: 100,
        branches: 90,
      },
    },
  },
});
