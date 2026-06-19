# 18. Attachment リソースとファイル本体（Base64）の扱い

- Status: accepted
- Date: 2026-06-16
- Deciders: jun.shiromoto (Joymerrevent)

> 議論の結果、提案どおり **(1) 専用アクセサ / (2) Content=Base64 string＋util / (3) 15000 ガード
> バイパス＋10MB ガード** で accepted（2026-06-16）。実装（`resources/attachment.ts`・`util/base64.ts`・
> requester のフラグ・公開型）は別 PR で反映する。
> [ADR-0003][0003]（MVP に Attachment）・[ADR-0005][0005]（公開 API）・[ADR-0011][0011]（XML）・basic-design §9 を具体化する。

## Context and Problem Statement

MVP 最後のリソース Attachment（添付ファイル）は、他の 5 リソース（Candidate/Job/Client/Process/Resume）と**構造が大きく異なる**:

- **接頭辞なし・固定項目**（`Id` / `Resource` / `ResourceId` / `ContentType` / `FileName` / `Content`）。`P_*` でも標準 Field Type でもなく、カスタム項目も無い。
- `Resource` は**リソース種別コード**（数値。例 17=Resume）、`ResourceId` は紐づくレコードの id。
- **`Content` はファイル本体（Base64・最大 10MB/ファイル）**。
- Write は `POST /v1/attachment?partition=N`、レスポンスは他と同じ（`<Item><Id><Code>`）。

このため**汎用 `createResource`（`${prefix}.P_Id` 前提・DataType カタログ駆動）にそのまま乗らない**。
さらに `Content` の Base64 は requester の**約 15000 文字ガードに必ず抵触する**（10MB ≈ Base64 約 13M 文字）。

問い: **(1) Attachment アクセサの作り／(2) ファイル本体（Content）の表現／(3) サイズガードとの整合**をどう決めるか。

## Decision Drivers

- **薄く・堅く**: バイナリ依存・重い経路をコアに入れない。Node・ブラウザ両対応。
- **型安全**: 固定項目なので**精密な静的型**を付けられる（SD-3 の動的型を待たない）。
- **フェイルセーフ**: 過大ファイルは送信前に検知して安全側へ。
- **既存資産の再利用**: requester・`parseWriteResult`・`parseResourcePage`。
- **公開 API の一貫性**: [ADR-0005][0005] のアクセサ形（`create`/`get`/`search` …）に寄せる。

## Considered Options

### (1) アクセサの作り

- 案1A: **専用 `createAttachmentResource`**（requester・パーサは再利用、URL/ボディは独自）。
- 案1B: 汎用ファクトリを Attachment 対応に一般化（prefix 無し・Id・固定項目を吸収）。

### (2) Content の表現

- 案2A: **Base64 `string`** で受け渡し（利用者がエンコード／デコード）。
- 案2B: **`Uint8Array`** を受けてライブラリが Base64 化／復号。
- 案2C: **2A をコア＋ `util` にクロスプラットフォームな binary↔Base64 純関数（opt-in）**。

### (3) サイズガードとの整合

- 案3A: **Attachment Write は 15000 文字ガードをスキップ**（`RequestSpec` フラグ）＋ Attachment 側で **10MB 専用ガード**。
- 案3B: 15000 ガードを全体的に緩める / 撤廃。
- 案3C: Attachment も 15000 ガード対象のまま（＝事実上アップロード不可）。

## Decision Outcome

**採用: (1) 案1A・(2) 案2C・(3) 案3A**。

- **(1) → 案1A（専用アクセサ）**。汎用ファクトリは prefix/P_Id/カタログ前提で合わない。requester・`parseWriteResult`・`parseResourcePage` は再利用。固定項目なので**精密な型**（例 `AttachmentInput = { resource; resourceId; contentType; fileName; content }`）を付けられる。
- **(2) → 案2C**。Attachment の値型は **Base64 `string`**（薄い・依存なし・portable）。加えて `util` に **`bytesToBase64` / `base64ToBytes`（依存なしクロスプラットフォーム純関数）を opt-in 提供**し、人に優しさを保つ。`Uint8Array` 直接受け口（案2B）はコアに入れず将来 opt-in 可。
- **(3) → 案3A**。`RequestSpec` にフラグ（例 `unboundedBody`）を足し **Attachment Write は 15000 ガードをスキップ**。代わりに Attachment アクセサで **Content が約 10MB を超える送信を `PortersConfigError` で弾く**（正しい閾値でフェイルセーフ）。

補足（軽微）: Read は標準の `field` で制御（`Content` は大きいので必要時に要求）、decode は passthrough（全項目文字列）。`Resource` は**種別コードを passthrough**（Resource List は docs 参照。名前↔コードの enum は将来）。

### Consequences

- Good: 既存資産を再利用・固定項目で**精密型**・portable・フェイルセーフ（10MB ガード）。
- Bad: 専用アクセサ＋`util` の Base64 ヘルパーを持つ。size ガードに分岐（フラグ）が増える。
- Neutral: `Uint8Array` 受け口は将来 opt-in。`Resource` の enum も将来。

## Pros and Cons of the Options

### (1) アクセサ

- 案1A 専用: Good=単純・既存資産再利用・精密型／ Bad=コード重複（ただし大半は requester/パーサ再利用で薄い）。
- 案1B 一般化: Good=単一経路／ Bad=ファクトリに「prefix 無し・Id・固定項目・サイズ例外」の分岐が増え複雑化・他リソースに無関係な負債。

### (2) Content

- 案2A string: Good=薄い・portable／ Bad=利用者が Base64 変換を要する。
- 案2B Uint8Array: Good=人に優しい／ Bad=クロスプラットフォーム Base64・経路追加・「薄く」に反する。
- 案2C string＋util: Good=薄いコア＋ergonomics の両立／ Bad=util を保守。

### (3) サイズガード

- 案3A フラグ＋10MB: Good=正しい閾値でフェイルセーフ・他は 15000 のまま／ Bad=フラグ追加。
- 案3B 緩和: Bad=通常 Write の安全網が弱まる。
- 案3C 現状: Bad=アップロード不可。却下。

## More Information

- 依存/前提: [ADR-0003][0003]（MVP）・[ADR-0005][0005]（公開 API）・[ADR-0011][0011]（XML）・basic-design §9。
- 出典: Attachment Read/Write・Mime Type List（`docs/reference/resource-api/resources/attachment.md`）。10MB/ファイル・FileName 255 バイト以内。
- 反映（accepted 後）: `resources/attachment.ts`（専用）・`util/base64.ts`（opt-in）・`http/requester.ts`（ガードのフラグ）・公開面に Attachment 型。

[0003]: 0003-add-attachment-to-mvp.md
[0005]: 0005-public-api-shape.md
[0011]: 0011-xml-parse-serialize.md
