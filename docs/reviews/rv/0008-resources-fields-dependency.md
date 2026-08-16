# RV-8 🟢 依存方向：resources → fields

- 重要度: 🟢 ／ 観点: アーキテクチャ
- 状態: fixed

## 概要

各データリソースが「カスタム無し」の既定型 `EmptyCatalog` を `../fields` から import しており、resources → fields の **上向き依存**が生じている（型のみ・実行時循環は無し）。`EmptyCatalog` は `Record<never, never>` の汎用ユーティリティで、カタログ概念に近い

## 根拠

`src/resources/{candidate,job,client,process,resume}.ts`（`import type { EmptyCatalog } from "../fields"`）/ 定義は `src/fields/define-fields.ts`。`fields` 側は `../errors`・`../xml/decode` のみ import（現状は循環無し）

## 推奨

`EmptyCatalog` を `src/resources/read-core.ts`（`FieldCatalog` の隣）へ移し `resource.ts` から re-export。依存方向を fields → resources に揃え、将来 fields が resources 型を要したときの循環を予防（薄い予防的整理・緊急ではない）

## 処置

`EmptyCatalog` を `read-core.ts`（`FieldCatalog` の隣）へ移し `resource.ts` で re-export。データリソース 5 種は `./resource` から取得（`../fields` import を撤去）。`define-fields.ts`・`client.ts` は `resources/read-core` から import。これで resources→fields の上向き依存が消え、依存方向は fields → resources に統一（型のみ・循環無し）
