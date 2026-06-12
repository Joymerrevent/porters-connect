import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

// ESLint flat config（format+lint レシピの lint 部分）。
// 役割分担: 整形は Prettier、ここでは「型だけでは拾えないバグ・品質」を検出する。
// 型情報を使うルール（no-floating-promises 等）を有効化するため type-checked を採用。
// ※ 型情報ありの lint には対象プロジェクトの tsconfig.json が必要。
export default tseslint.config(
  { ignores: ["dist", "build", "coverage"] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 先頭 _ の未使用引数/変数は許可（tsc の noUnusedParameters と挙動を揃える）
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // 設定系ファイル（このファイル含む）は型情報なしで lint する
  // ※ tsconfig に含まれない *.mjs/*.js/*.cjs を type-checked 対象から外す
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // 整形に関するルールを無効化（Prettier と競合させない）。必ず最後に置く。
  eslintConfigPrettier,
);
