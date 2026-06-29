# 41. 一括書き込みの公開メソッド `createMany` / `updateMany` の詳細設計（F-4）

- Status: accepted
- Date: 2026-06-29
- Deciders: jun.shiromoto (Joymerrevent)

> [[0033-post-mvp-direction]] 案F-4（一括書き込み）の**詳細設計**。`CLAUDE.md`（「200 件超は 200 件ずつに分割」）と
> reference（[write-format][wf]：1 リクエスト最大 200 件・作成と更新を混在可・per-item `Id`+`Code`・非アトミック）が
> 求める一括書き込みを公開 API に落とす。**内部（`buildWriteXml` の配列・`parseWriteResult` の per-item）は実装済み**で、
> 不足は**公開サーフェスのみ**。本 ADR は **公開メソッドの形・部分成功の戻り値/エラー方針・自動分割（件数＋サイズ）・
> チャンク失敗時の挙動・Attachment の扱い・配置・semver** を現行コードに接地して詰める。
> **decider 承認により `accepted`（2026-06-29）**: 軸1＝**案1a**（`createMany`/`updateMany` 分離）、軸2＝**案2a**（`BulkWriteResult`・
> 部分成功は throw しない）、従属して軸4＝**案4a**（チャンク失敗は throw＋進捗）・軸3a（件数＋サイズ分割）・軸5（Attachment 対象外）・
> 非破壊 minor を採用（下記 Decision Outcome）。**実装は別 PR（ADR 先行 → 実装）。反映は accept 後。**

## Context and Problem Statement

PORTERS の Write は **1 リクエストに `<Item>` を複数並べて一括書き込み**でき、**最大 200 件**／
**作成（`P_Id=-1`）と更新（対象 ID）を 1 リクエストで混在可**／レスポンスは **`<Item>` ごとに `<Id>`+`<Code>`**
（送信と同順・同数・各件が独立に成否を持つ＝**非アトミック**）（[write-format][wf]）。`CLAUDE.md` も「200 件超は 200 件ずつに分割」
「リクエストが長すぎると 400（正典 ~15000 文字）」を定める。

現行コードの事実（接地）:

- **内部は一括対応済み**。`buildWriteXml({ …, items: WriteItem[] })` は**配列**を受け複数 `<Item>` を描画（`src/xml/encode.ts:108-120`）。
  `parseWriteResult(xml): WriteResultItem[]` は **per-item `{ id, code }`** を返す（`src/xml/parser.ts`・JSDoc も「bulk は成否混在・per-item code 適用は accessor の責務」と明記）。
- **公開 API は単件のみ**。`createResource` の `write(item, idempotent)` は `items:[item]` の**単一要素**で送り、
  `firstWriteResultId`（`src/resources/resource.ts:112-133`）が**先頭 1 件のみ**取り出し `code!=0` を throw（`create`/`update`）。
- 送信前 **`MAX_REQUEST_LENGTH=15000`** ガードは body 全体長を検査（`src/http/requester.ts`）。Write は throttle 別バケット
  （1 分 500・[ADR-0010][a10]）。create は非冪等（`idempotent:false`＝ネットワーク不確実時に自動リトライしない）。
- Attachment は bespoke（巨大 Base64・`unboundedBody:true` で size ガード回避・`src/resources/attachment.ts`）。

問い: **(a) 一括の公開メソッドをどう出すか**（作成/更新分離 か 混在 `writeMany` か）、**(b) 部分成功をどう返すか**
（per-item 結果 か throw か）、**(c) 200 件超・15000 字超をどう自動分割するか**、**(d) チャンク（=1 リクエスト）失敗時に
既に書けた分をどう扱うか（create は非冪等）**、**(e) Attachment を含めるか**、**(f) 配置・semver**。

## Decision Drivers

- **API 忠実 / 接地**（[[0002-ground-design-in-live-api-docs]]）: 200 件・per-item code・**非アトミック**を偽装しない。混在書き込みの可否も reference どおり。
- **フェイルセーフ**: 部分成功を**握り潰さない**（どの件が失敗したか返す）。一方で**成功した件も失わない**。送信前に 400 要因（件数・サイズ）を**分割で回避**。
- **薄く・堅く・メンテしやすく**（`CLAUDE.md`）: 内部は既に配列/per-item 対応＝**公開メソッドと分割ロジックの薄い追加**で足りる。型機構を過剰にしない。
- **型安全**（[[0004-field-type-model]] / [[0019-static-resource-types]]）: 一括入力も `CreateInput`/`UpdateInput` を再利用し、単件と同じ型保証。
- **非破壊**: 既存 `create`/`update` を変えない。**追加のみ**。
- **既存資産の再利用**: `buildWriteXml`（配列）・`parseWriteResult`（per-item）・write throttle・送信前 size ガード。
- **MCP が薄く乗る**（[[0005-public-api-shape]]）: 一括メソッドもそのまま tool 化できる素直な形。

## Considered Options

### 軸1: 公開メソッドの形

- **案1a: 作成/更新を分離（推奨）** — `createMany(inputs: CreateInput[]): Promise<BulkWriteResult>` ／
  `updateMany(items: Array<{ id: number; fields: UpdateInput }>): Promise<BulkWriteResult>`。単件 `create`/`update` を鏡写し、
  `CreateInput`（required-on-create 必須）/`UpdateInput`（全 optional）を**そのまま再利用**＝型がきれい。1 リクエストには同種のみ載る
  （作成バッチ・更新バッチを別リクエストで送る）。
- **案1b: 混在 `writeMany(entries)`** — `writeMany(Array<{ op:"create"; fields } | { op:"update"; id; fields }>)`。
  reference の「1 リクエストで作成と更新を混在」を活かしリクエスト数を最小化できるが、判別 union で型が重く、required-on-create の保証が弱まる。
- **案1c: 両方** — 1a＋1b。サーフェス増。

### 軸2: 部分成功の戻り値・エラー方針

- **案2a: per-item 結果を返す `BulkWriteResult`（推奨）** — 送信順に `Array<{ index; id; code; ok }>`（`ok = code===0`）を返し、
  `code!=0` の件で**throw しない**（一括は成否混在が正常）。取り回し用に `succeeded`/`failed`（または `hasFailures`）を併設。
  **HTTP 非 200・transport 失敗・パース不能は throw**（全件不達＝従来どおり例外）。単件 `create`/`update` は**不変**（先頭 1 件・throw 維持）。
- **案2b: 失敗があれば集約 throw `PortersBulkError`** — 成功 ID を載せて投げる。partial の取得が一手間・成功を例外に隠す。
- **案2c: 単件と同じく最初の失敗で throw** — 一括の半分が書けた状態で例外＝最も非フェイルセーフ。

### 軸3: 自動分割（件数＋サイズ）

- **案3a: 件数（≤200）＋サイズ（≤ ~15000 字）で分割（推奨）** — 入力を順に積み、**次の 1 件で 200 件に達する or `MAX_REQUEST_LENGTH` を超える**直前で
  チャンクを閉じる。各チャンクを**逐次**送信（write throttle が 500/分をペース）、結果を**入力順に連結**。1 件で 15000 字超（巨大カスタム値）の場合は
  その件で送信前 `PortersConfigError`（単件と同じガード思想）。
- **案3b: 件数（200）だけで分割** — サイズ超過は既存ガードに任せ throw。実装は軽いが、200 件×大項目で 400 手前の `PortersConfigError` 多発＝使い勝手が悪い。

### 軸4: チャンク（1 リクエスト）失敗時の挙動と冪等性

- **案4a: 失敗チャンクで throw＋進捗を載せる（推奨）** — あるチャンクが HTTP 非 200/transport で落ちたら、
  **既に成功した件数（や部分 `BulkWriteResult`）を error に載せて throw**。create は非冪等のため**丸ごと再実行は重複**を生む点を JSDoc/guide で明示
  （回復は「失敗位置以降のみ再送」）。在庫の per-item code 失敗（軸2a）とは別物（あちらは throw しない）。
- **案4b: チャンク失敗もそのチャンクの全件を `failed` として結果に畳む** — throw しない。transport エラーを per-item code と混同＝忠実でない・握り潰しに近い。

### 軸5: Attachment

- **対象外（単件のみ維持）** — Attachment は bespoke で本体が巨大 Base64（最大 ~14MB・`unboundedBody` で size ガード回避）。
  一括は 1 リクエストが容易に 400 / メモリ圧迫＝**bulk を出さない**。必要なら将来 follow-up（件数小・サイズ厳格運用）。

### 軸6: 配置・semver

- **`createResource`（generic factory）に `createMany`/`updateMany` を追加**（`Resource` 型に生やす）。`buildWriteXml`（配列）・`parseWriteResult`（per-item）を
  そのまま使い、**チャンク分割ユーティリティ**（`src/resources/` か `src/util/`）と `BulkWriteResult` 型を新設。`firstWriteResultId` は単件用に温存。
  純粋な**追加** → semver **minor**（`0.5.0` → `0.6.0`）。

### 軸7: テスト

- 200 件境界（200/201 で 1→2 チャンク）・サイズ境界（~15000 字で分割）・per-item 成否混在（`code` 0/非0 が `ok`/`failed` に出る）・
  入力順の連結・チャンク失敗時の throw＋進捗・単件 `create`/`update` 不変・型（`createMany` は `CreateInput[]`、`updateMany` は id+`UpdateInput`）。
  mock transport（[[0024-mock-transport]]）結線。[[0014-test-coverage-policy]] perFile 100 / branch ≥90。

## Decision Outcome

> **`accepted`（2026-06-29）。** decider 承認による確定方針。反映（guide/JSDoc/CHANGELOG・実装）は accept 後に別 PR。

採用: **案1a ／ 案2a ／ 案3a ／ 案4a ／ Attachment 対象外 ／ 追加 minor ／ 軸7 テスト**。サブ決定:

- **SD-1 形 = 案1a**。`createMany(inputs: CreateInput[])` / `updateMany(items: Array<{ id: number; fields: UpdateInput }>)`。混在 `writeMany` は将来 follow-up（非破壊で足せる）。
- **SD-2 戻り値 = 案2a**。`BulkWriteResult` = 送信順の per-item `{ index; id; code; ok }` ＋ `failed`（`ok=false` の抽出）＋ `hasFailures`。`code!=0` は throw しない。HTTP 非 200/transport/パース不能は throw。単件は不変。
- **SD-3 分割 = 案3a**。件数 ≤200 ＋ サイズ ≤`MAX_REQUEST_LENGTH` で逐次チャンク、結果を入力順連結。1 件で超過は `PortersConfigError`（送信前）。
- **SD-4 チャンク失敗 = 案4a**。throw＋既書き込み進捗を error context に載せる。create 非冪等の再送注意を JSDoc/guide に明記。
- **SD-5 Attachment = 対象外**（単件のみ）。理由を JSDoc に残す。
- **SD-6 配置 = generic factory に `createMany`/`updateMany`**＋`BulkWriteResult` 型＋チャンク util。`buildWriteXml`/`parseWriteResult` 再利用。**minor**。
- **SD-7 docs**。guide（一括書き込み：200/サイズ分割・部分成功の読み方・create 非冪等の再送注意）＋ JSDoc、CHANGELOG（minor・追加）。**反映は accept 後**（[ADR 運用][adr]）。
- **SD-8 テスト = 軸7**。
- **SD-9 不確実性**。**部分失敗時に PORTERS がそのリクエストの他件をロールバックするか**は reference に記載なし（非アトミックと読むが実機未確認）＝ accept 後に [live-verification][lv] エントリを追加し `VERIFY(live)`。

### Consequences

- Good: F-4（[[0033-post-mvp-direction]] 案F-4）を充足。内部既存資産（配列 encode・per-item parse・throttle・size ガード）の**薄い追加**で出荷。部分成功を忠実に返し（握り潰さない）成功件も保持。200/サイズ分割で 400 をフェイルセーフに回避。非破壊 minor。
- Bad: `BulkWriteResult` の per-item 解釈は利用者の責務が増える（単件の「throw で気づく」より明示的に確認が要る）。create のチャンク跨ぎは非冪等＝部分適用が起こり得る（doc で周知）。混在 `writeMany` を出さない分、作成＋更新はリクエスト 2 回（許容）。
- Neutral: 混在 `writeMany`・Attachment 一括は将来 follow-up（非破壊で追加可能）。ロールバック有無は [live-verification][lv] で接地。

## Pros and Cons of the Options

### 軸1（形）

- **案1a**: Good=単件を鏡写し・`CreateInput`/`UpdateInput` 再利用で型がきれい・required-on-create を保てる。Bad=作成＋更新は別リクエスト。
- **案1b**: Good=1 リクエストで混在・リクエスト数最小。Bad=判別 union が重い・required-on-create 保証が緩む。
- **案1c**: Good=両用途。Bad=サーフェス増・二重メンテ。

### 軸2（部分成功）

- **案2a**: Good=非アトミックを忠実に表現・成功/失敗を両取り・送信前例外は維持。Bad=利用者が結果確認するひと手間。
- **案2b**: Good=「失敗は例外」で気づきやすい。Bad=成功 ID を例外に隠す・partial 取得が一手間。
- **案2c**: Good=単件と同型。Bad=半分書けた状態で例外＝非フェイルセーフ。

### 軸4（チャンク失敗）

- **案4a**: Good=transport 失敗を per-item と分離・進捗を返し回復可能。Bad=throw とper-item 結果の二系統を利用者が理解要。
- **案4b**: Good=戻り値一系統で単純。Bad=transport エラーを code 失敗に偽装・握り潰しに近い。

## More Information

- 接地（reference）: [write-format][wf]（200 件・作成更新混在・per-item `Id`+`Code`・非アトミック・データ型別書式）／[resource-api 概要][ra]（1 リクエスト最大 200・Write 500/分）。
- 接地（コード）: `src/xml/encode.ts`（`buildWriteXml` 配列）／`src/xml/parser.ts`（`parseWriteResult` per-item）／`src/resources/resource.ts`（`write`/`firstWriteResultId`＝単件先頭）／`src/http/requester.ts`（`MAX_REQUEST_LENGTH`・write throttle・idempotent）。
- 内部前提: [[0019-static-resource-types]]（`CreateInput`/`UpdateInput`）／[[0006-error-model]]（`PortersConfigError`/`PortersResourceError`・握り潰さない）／[[0010-retry-throttle]]（write throttle・冪等性）／[[0011-xml-parse-serialize]]（encode/decode）／[[0013-coding-conventions-class-vs-function]]（factory・arrow・type）／[[0024-mock-transport]]（テスト）。
- 責務分離: Attachment（[[0018-attachment-design]]）は bespoke・bulk 対象外。
- 位置づけ: [[0033-post-mvp-direction]] 案F-4。要件は `CLAUDE.md`（200 件分割・15000 字）。
- 不確実性 → [live-verification][lv]: 部分失敗時のロールバック有無（非アトミックの実挙動）。
- 後続/対象外: 実装は別 PR（ADR 先行 → 実装）。混在 `writeMany`・Attachment 一括・件数並列化は将来 follow-up。

[wf]: ../reference/resource-api/write-format.md
[ra]: ../reference/resource-api/README.md
[lv]: ../live-verification.md
[adr]: README.md
[a10]: 0010-retry-throttle.md
