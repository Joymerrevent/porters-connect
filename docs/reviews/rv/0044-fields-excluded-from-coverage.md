# RV-44 🟡 coverage / mutation が `src/fields/**` を除外したままで、実ロジック 4 本が測られていない

- 重要度: 🟡 ／ 観点: テスト厳密性
- 状態: open

## 概要

[ADR-0014][adr14] は計測対象から「**プレースホルダ** `src/fields/**`」を除外した。起票当時の
`src/fields/` は中身の無い置き場だったが、いまは `defineFields`（[ADR-0023][adr23]）と
`verifyFields` / `generateFieldDecls` / `readCustomCatalog`（[ADR-0069][adr69]）の**実ロジック 4 本**が入っている。
除外はそのまま残っているため、**perFile 100% の閾値も mutation も、この 4 本には効いていない**。

## 根拠

- `vitest.config.ts:12-18` — `exclude` に `"src/fields/**"`。同ファイルのコメントは除外理由を
  「barrels / type-only / **placeholders** / tests」と説明している。
- `stryker.config.json` — `mutate` に `"!src/fields/**"`（[ADR-0015][adr15] が「[ADR-0014][adr14] と同様に除外」と決めたため）。
- [ADR-0014][adr14] Decision Outcome — 「**除外**: …プレースホルダ `src/fields/**`」。
- `src/fields/` の現在の中身 — `define-fields.ts` / `verify-fields.ts` / `generate-field-decls.ts` /
  `tenant-catalog.ts`（いずれも隣に `*.test.ts` がある）。
- **実測**（除外だけ外して計測・2026-09-15。閾値は perFile で statements / functions / lines = 100・branches = 90）:

  | ファイル                  | Stmts | Branch | Funcs | Lines | 未到達       |
  | ------------------------- | ----- | ------ | ----- | ----- | ------------ |
  | `define-fields.ts`        | 96.96 | 83.33  | 100   | 100   | 180 行       |
  | `generate-field-decls.ts` | 96.66 | 92     | 85.71 | 96.66 | 93 行        |
  | `verify-fields.ts`        | 100   | 94.44  | 100   | 100   | 126 行の分岐 |
  | `tenant-catalog.ts`       | 100   | 100    | 100   | 100   | —            |

  つまり**除外を外すと 2 ファイルが閾値割れ**する（`define-fields.ts` は branches も 90 未満）。
  未到達は `define-fields.ts:180` の `if (declare === undefined) continue;`（宣言を省いた項目の読み飛ばし）と
  `generate-field-decls.ts:93` の整列コールバック（`undeclarable` が 2 件以上のときだけ走る）。

## 影響

「**すべてのロジックを実際に通す**」という [ADR-0014][adr14] の約束が、カスタム項目まわり
（宣言 DSL・テナントカタログ突合・宣言の生成）だけ成立していない。この領域は
[ADR-0074][adr74] で公開挙動が変わったばかりで、未到達の 2 箇所はどちらも
「落ちずに静かに違う結果を出す」側に倒れうる（宣言の読み飛ばし・生成した宣言の並び）。
テストは隣にあり穴自体は小さいので 🔴 ではないが、**品質ゲートがこの領域を見ていない**状態が続くと、
次に足すロジックも同じ盲点に入る。

## 検出経緯

ADR の棚卸し（1 ファイルずつ現状と突き合わせる作業・2026-09-15）。[ADR-0014][adr14] の除外理由
「プレースホルダ」が現状と合わないと気づき、除外を外して実測した。

## 推奨

- **(a) 除外を外し、閾値割れの 2 ファイルにテストを足す**（推奨）。[ADR-0014][adr14] の決定
  （全ロジック網羅）に戻すだけなので**新しい決定は要らない**。`stryker.config.json` の
  `!src/fields/**` も同時に外す（片方だけだと mutation の穴が残る）。
- (b) 除外を残すなら、理由を「プレースホルダ」から実態に合うものへ書き換える。これは
  「測らない領域を認める」＝[ADR-0014][adr14] の方針変更なので**要 ADR**。

## 処置

—

[adr14]: ../../adr/0014-test-coverage-policy.md
[adr15]: ../../adr/0015-mutation-testing.md
[adr23]: ../../adr/0023-custom-field-declaration-dsl.md
[adr69]: ../../adr/0069-tenant-field-catalog-tooling.md
[adr74]: ../../adr/0074-custom-field-declaration-required.md
