# RV-44 🟡 coverage / mutation が `src/fields/**` を除外したままで、実ロジック 4 本が測られていない

- 重要度: 🟡 ／ 観点: テスト厳密性
- 状態: fixed

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

**(a) を採用**（2026-09-15）。`vitest.config.ts` の `exclude` と `stryker.config.json` の `mutate` から
`src/fields/**` を外し、計測対象に戻した。除外理由を書いていた `vitest.config.ts` の
コメントも実態に合わせた（「プレースホルダだったが ADR-0023 / ADR-0069 以降は実ロジック」）。

戻す前に、閾値を割っていた 2 経路にテストを足した。

- `define-fields.ts` — 値が `undefined` のリソースキーを読み飛ばす経路。条件付きで宣言を組む
  （`job: wantJob ? decl : undefined`）呼び出しで通る道で、空カタログを載せるとそのリソースの
  カスタム項目が静かに解決されなくなる
- `generate-field-decls.ts` — 宣言できない項目のコメントを alias 順に並べる整列。宣言側を整列して
  いる理由（再生成で同じ文面になる）がコメント側にも要る

計測対象に戻したことで **mutation もこの領域を初めて見るようになり**、生き残った変異のうち
テストの穴だったものを潰した（下記「検証」）。

## 検証

**coverage**（`pnpm test:coverage`・perFile 閾値つき）: `src/fields` は statements / functions /
lines とも **100%**、branches 98.64%（最も低い `verify-fields.ts` で 94.44% ＝ 閾値 90 を満たす）。
リポジトリ全体でも statements / functions / lines 100%・branches 99.05%。

**mutation**（`pnpm exec stryker run`）: 全体スコアは **95.99**（break 閾値 95）。
除外を外した直後は 95.11、テストの穴を埋めて 95.75、同値変異を除外して 95.99。
**`src/fields` は 4 ファイルとも 100.00**（279 killed / 生存 0）。

生き残った変異を潰すために足したテスト（＝mutation が見つけた実際の穴）:

- `defineFields` の alias 規則が**前方一致**であること（`P_SubU_score` は custom ではない）と、
  未知のリソースキーのときにメッセージが**打ち間違いと候補一覧**を含み `category: "config"` であること
- `readCustomCatalog` が `P_Name` の無い行で `names` に**エントリを作らない**こと
  （作ると `generateFieldDecls` が `// null` と書き出す）と、alias 規則が前方一致であること
- `verifyFields` の「宣言済みだが宣言不能な項目を missing と呼ばない」判定が**alias ごと**であること
  （そうでないと 1 件の宣言不能項目が全部の欠落を免罪する）
- `assertFieldsMatch` のメッセージが**1 件 1 行**であること

テストで潰せない **7 件は同値変異**（テストの穴ではない）。テストを書いても殺せない＝殺せた
としても振る舞いの違いを検査していないことになるので、**理由を添えて Stryker から除外**した
（[ADR-0015][adr15]「真の同値変異のみに限定」）。

| 場所                                             | なぜ同値か                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `tenant-catalog.ts` の `fieldType === null` 分岐 | フォールスルーしても `dataType === undefined` 側が**同じエントリ**を作る（2 件）     |
| `tenant-catalog.ts` の `kind: "undeclarable"`    | 呼び出し側は `=== "declarable"` しか見ないので、別の値でも同じ経路（4 件）           |
| `generate-field-decls.ts` の整列 `a < b`         | alias は重複しないので、`<=` にしても並びが変わらない（2 件・うち 1 件は行ごと除外） |

除外は**行単位**（`// Stryker disable next-line <Mutator>: 理由`）に絞り、同じ行にある他の変異や
隣の `reason` 文字列は対象のまま残している。整列の 1 件だけはチェーンの途中で行指定が効かないため、
その文にかぎって `disable` / `restore` で囲んだ。

[adr14]: ../../adr/0014-test-coverage-policy.md
[adr15]: ../../adr/0015-mutation-testing.md
[adr23]: ../../adr/0023-custom-field-declaration-dsl.md
[adr69]: ../../adr/0069-tenant-field-catalog-tooling.md
[adr74]: ../../adr/0074-custom-field-declaration-required.md
