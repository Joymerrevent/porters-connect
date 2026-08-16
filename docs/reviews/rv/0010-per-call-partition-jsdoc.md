# RV-10 🟡 per-call partition の JSDoc が存在しない機能を宣言していた

- 重要度: 🟡 ／ 観点: アーキテクチャ / DX
- 状態: fixed

## 概要

`PortersClientOptions.partition` の JSDoc が「overridable per call (ADR-0008)」と謳っていたが、
**per-call 上書きは未実装**だった。partition は構築時に固定され、
`SearchQuery` / `create` / `update` / マスタクエリのいずれにも `partition` 引数が無い。

## 根拠

- `src/client.ts:48` — JSDoc「overridable per call」。
- `src/resources/resource.ts:35-46` — `SearchQuery` に `partition` が無い。
- 同 `:175,184,187` — `deps.partition` を一律に使用。
- `docs/adr/0008-multitenancy-partition.md:46` / `docs/adr/0005-public-api-shape.md:44` /
  `docs/design/basic-design.md:63` — いずれも per-call 上書きを公開 API として定めている。

## 影響

実装が未達なのは計画上の遅れに過ぎないが、**JSDoc が存在しない機能を主張している**のは別問題。
エディタの補完で「呼び出しごとに上書きできる」と読んだ利用者は、その前提で設計してから
動かないと気づく。**ドキュメントが嘘をつく**のはフェイルセーフに正面から反する。
実装より先に、まず嘘を消す必要があった。

## 検出経緯

横断監査 [2026-06-22-03][run3]。accepted ADR が定めた v1 公開 API と実装を全件突き合わせた際、
未実装サーフェス群（→ [ADR-0033][adr33] 案F）とは別に、
**doc だけが先に「ある」と言っている**ケースとして分離した。

## 推奨

いずれか — (a) per-call `partition` 上書きを実装する（[ADR-0033][adr33] 案F-3 で対応予定）、
(b) 暫定で JSDoc から「overridable per call」を削除し未対応を明示する。
少なくとも (b) で**偽宣言を即時解消**する（嘘をつかない）。本実装は案F-3 に委ね、doc 訂正は先行できる。

## 処置

暫定 (b) を実施。`src/client.ts:53` の JSDoc から「overridable per call」を削除し、
「per-call override は未対応・予定（[ADR-0033][adr33]）」と明示した。0.3.0 のプレリリース整備で対応。

## 検証

JSDoc と実挙動が一致していることを確認。なお per-call 上書きは最終的に
[ADR-0040][adr40]（F-3・案1c）で **`tenant(id)` スコープ**という形に落ち、
「呼び出しごとの partition 選択」は per-call 引数ではなくスコープで表現することが決まった
（0.5.0 で公開）。偽宣言を消しておいたおかげで、設計が変わっても doc の訂正は不要だった。

[adr33]: ../../adr/0033-post-mvp-direction.md
[adr40]: ../../adr/0040-multitenancy-surface-impl.md
[run3]: ../2026-06-22-03.md
