# RV-8 🟢 依存方向が resources → fields と上向きになっている

- 重要度: 🟢 ／ 観点: アーキテクチャ
- 状態: fixed

## 概要

各データリソースが「カスタム項目なし」の既定型 `EmptyCatalog` を `../fields` から import しており、
**resources → fields の上向き依存**が生じていた（型のみ・実行時の循環は無し）。
`EmptyCatalog` は `Record<never, never>` の汎用ユーティリティで、カタログ概念の側に近い。

## 根拠

- `src/resources/{candidate,job,client,process,resume}.ts` — `import type { EmptyCatalog } from "../fields"`。
- 定義は `src/fields/define-fields.ts`。
- `fields` 側は `../errors`・`../xml/decode` のみ import しており、**現状は循環していない**。

## 影響

**いまは何も壊れていない**（型のみの依存で実行時循環なし）。問題は将来で、
`fields` が `resources` の型を必要とした瞬間に**循環が発生する**。
層の向きが揃っていないと、その時に「どちらを動かすか」の判断が要る。
予防的整理なので 🟢＝急がないが、放置する理由も無い。

## 検出経緯

[2026-06-19-01][run619]。[ADR-0023][adr23]（`defineFields`）の実装を層の観点で確認していて、
新しく入った import の向きが既存と逆だと気づいた。

## 推奨

`EmptyCatalog` を `src/resources/read-core.ts`（`FieldCatalog` の隣）へ移し、
`resource.ts` から re-export する。依存方向を **fields → resources** に揃える。

## 処置

`EmptyCatalog` を `read-core.ts`（`FieldCatalog` の隣）へ移し、`resource.ts` で re-export した。
データリソース 5 種は `./resource` から取得するようにし、`../fields` の import を撤去。
`define-fields.ts` と `client.ts` は `resources/read-core` から import する形にした。

## 検証

resources → fields の上向き依存が消え、依存方向が **fields → resources** に統一されたことを確認
（型のみ・循環なし）。lint / typecheck とも緑。

[adr23]: ../../adr/0023-custom-field-declaration-dsl.md
[run619]: ../2026-06-19-01.md
