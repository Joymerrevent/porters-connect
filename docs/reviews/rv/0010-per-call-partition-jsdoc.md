# RV-10 🟡 per-call partition の JSDoc 偽宣言

- 重要度: 🟡 ／ 観点: アーキテクチャ / DX
- 状態: fixed

## 概要

`PortersClientOptions.partition` の JSDoc が「overridable per call (ADR-0008)」と謳うが、per-call 上書きは**未実装**。partition は構築時に固定され、`SearchQuery`／`create`／`update`／マスタクエリのいずれにも `partition` 引数が無い。ADR-0008/0005・basic-design は per-call 上書きを公開 API として定めるため、実装が未達なうえ **JSDoc が存在しない機能を主張**している（利用者を誤誘導＝フェイルセーフ違反）

## 根拠

`src/client.ts:48`（JSDoc「overridable per call」）/ `src/resources/resource.ts:35-46`（`SearchQuery` に `partition` 無し）, `:175,184,187`（`deps.partition` を一律使用）/ `docs/adr/0008-multitenancy-partition.md:46` / `docs/adr/0005-public-api-shape.md:44` / `docs/design/basic-design.md:63`

## 推奨

いずれか — (a) per-call `partition` 上書きを実装（[ADR-0033][adr33] 案F-3 で対応予定。`tenant(id)` も同群）、(b) 暫定で JSDoc から「overridable per call」を削除し未対応を明示。少なくとも (b) で**偽宣言を即時解消**（嘘をつかない＝フェイルセーフ）。本実装は案F-3 に委ね、doc 訂正は先行可

## 処置

暫定 (b) を実施。`src/client.ts:53` の JSDoc から「overridable per call」を削除し「per-call override は未対応・予定（ADR-0033）」と明示。偽宣言を解消（per-call 上書きの実装自体は案F-3 に委ねる）。0.3.0 プレリリース整備で対応

[adr33]: ../../adr/0033-post-mvp-direction.md
