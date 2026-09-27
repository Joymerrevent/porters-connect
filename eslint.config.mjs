import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

// ADR-0097 / ADR-0098 / ADR-0101: 各モジュールが import してはいけない先（自分より上の層）。直下の client / index は全員にとって上。
// 一番下の porters/（PORTERS が決めた値と定義表）は、ほかのどのモジュールも import しない（下の layerRules で別に止める）。
const LAYERS = [
  [
    "errors",
    ["util", "xml", "http", "auth", "accessor", "resources", "fields"],
  ],
  ["util", ["xml", "http", "auth", "accessor", "resources", "fields"]],
  ["xml", ["http", "auth", "accessor", "resources", "fields"]],
  ["http", ["auth", "accessor", "resources", "fields"]],
  ["auth", ["accessor", "resources", "fields"]],
  // accessor と resources は auth を使っていないので、import してよい先に含めない（ADR-0097 / ADR-0101 の表）。
  ["accessor", ["auth", "resources", "fields"]],
  ["resources", ["auth", "fields"]],
  ["fields", ["auth"]],
];

const layerRules = () => [
  ...LAYERS.map(([module, above]) => ({
    files: [`src/${module}/**/*.ts`],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: `^(\\.\\./)+(${[...above, "client", "index"].join("|")})(/|$)`,
              message: `src/${module}/ は下の層だけを import できます（ADR-0097 の層の表）。`,
            },
          ],
        },
      ],
    },
  })),
  // porters/ は一番下の層。フォルダの外（`../` で始まる指定）を一切 import しない（ADR-0098）。
  {
    files: ["src/porters/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^\\.\\./",
              message:
                "src/porters/ は一番下の層で、ほかのモジュールを import できません（ADR-0098）。",
            },
          ],
        },
      ],
    },
  },
];

// ESLint flat config（format+lint レシピの lint 部分）。
// 役割分担: 整形は Prettier、ここでは「型だけでは拾えないバグ・品質」を検出する。
// 型情報を使うルール（no-floating-promises 等）を有効化するため type-checked を採用。
// ※ 型情報ありの lint には対象プロジェクトの tsconfig.json が必要。
export default tseslint.config(
  { ignores: ["dist", "build", "coverage", "tmp", ".stryker-tmp", "reports"] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["*.config.ts"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 先頭 _ の未使用引数/変数は許可（tsc の noUnusedParameters と挙動を揃える）
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // ADR-0013: 関数は全 arrow（const）に統一（function 宣言を禁止）
      "func-style": ["error", "expression"],
      // ADR-0013: arrow は巻き上げ無し → 定義前参照を禁止して定義順を強制
      "no-use-before-define": "off",
      "@typescript-eslint/no-use-before-define": "error",
      // ADR-0013: 型定義は全 type（interface 不使用）
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
    },
  },

  // ADR-0097: src/ のモジュールの層。下の層から上の層を import したら止める（人の記憶でなく仕組みで守る）。
  // porters → errors → util → xml → http → auth → resources → fields → 直下（client.ts / index.ts）の順。
  // 相対 import の深さによらず、`../` を 1 つ以上たどって上の層のフォルダ（直下の client / index を含む）に
  // 入る指定を弾く。テスト（test/ と隣の *.test.ts）は対象外（テストはどの層も直接 import してよい）。
  ...layerRules(),

  // 設定系ファイル（このファイル含む）は型情報なしで lint する
  // ※ tsconfig に含まれない *.mjs/*.js/*.cjs を type-checked 対象から外す
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },

  // 整形に関するルールを無効化（Prettier と競合させない）。必ず最後に置く。
  eslintConfigPrettier,
);
