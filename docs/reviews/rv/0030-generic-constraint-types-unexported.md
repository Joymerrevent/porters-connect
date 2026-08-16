# RV-30 🟢 公開ジェネリクスの制約型が未 export

- 重要度: 🟢 ／ 観点: 型安全 / 公開サーフェス
- 状態: open

## 概要

`PortersClient<C extends DeclaredCatalogs>` と `TenantScope<C extends DeclaredCatalogs>` は公開型なのに、
制約の `DeclaredCatalogs` と、メンバ型に現れる `CustomFor` が **`src/index.ts` から export されていない**。
`dist/index.d.ts` には型定義自体は出力されるが export リストに無いため、利用者が
**クライアントを引数に取るヘルパーの型を名前で書けない**（`typeof porters` で回避はできる）

## 根拠

`src/index.ts:42-48`（export は `CustomDataType` / `DefinedFields` / `FieldBuilder` / `FieldDecls` / `FieldDef` のみ）/
`dist/index.d.ts:724`（`type DeclaredCatalogs`）・`:740`（`type CustomFor`）・`:904`（export リストに両者なし）/
`src/client.ts:46,93,110`（公開型の制約に使用）

## 推奨

`DeclaredCatalogs` / `CustomFor`（必要なら `CustomFieldResource`）を `src/index.ts` に追加する。
2 行の追加で、**追加のみ＝破壊的でない**（semver minor）

## 処置

—
