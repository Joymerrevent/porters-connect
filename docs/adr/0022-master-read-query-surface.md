# 22. マスタ Read のクエリ面と current() を実 Read API に接地（ADR-0021 を amend）

- Status: accepted
- Date: 2026-06-17
- Deciders: jun.shiromoto (Joymerrevent)

> jun.shiromoto の決定により **D1=案D1a（`get(id)` を出さない）／D3=案D3b（Partition は `current()` を出さず一覧のみ・
> `current()` は User だけ）／D2=接地どおり／D4=記載どおり** で **accepted（2026-06-17）**。
> [ADR-0021][0021] は要約表（[docs/reference のマスタ各表][ref-masters]）を基に起票され、**各マスタ Read のクエリ・パラメータが
> 省かれていた**。実装直前に正典の Read 記事 4 本を精読したところ、マスタのクエリ面と `current()` 意味論が ADR-0021 の前提
> （汎用 Read 流用・`current()`=request_type=0=ログイン中）と食い違うと判明。本 ADR は **ADR-0021 の軸2（クエリ面）・
> 軸4（current）を実 Read API に接地して amend** する。ADR-0021 の軸1（単数形＋`tenant` 改名）・軸3（Option 再帰フラット化）・
> 軸5（カタログ駆動 decode）・読み取り専用という核は据え置く。コードへの反映は ADR-0021 のフォローアップ実装 PR に織り込む。

## Context and Problem Statement

[ADR-0021][0021] 軸2/軸5 は「マスタもデータ系の汎用 Read 内部（`SearchQuery`＝field/condition/count/start、`buildReadUrl`＝
partition+field 前提、カタログ既定 field）を流用する」、軸4 は「`current()` が `request_type=0` でログイン中 Partition/User を返す」
と仮定していた。しかし正典の Read 記事（[Partition][src-partition]/[User][src-user]/[Field][src-field]/[Option][src-option]）は次を示す:

| マスタ    | 必須                       | 任意                            | `field`  | `condition` | `request_type` | get(id) |
| --------- | -------------------------- | ------------------------------- | -------- | ----------- | -------------- | ------- |
| Partition | `request_type`             | count/start                     | ✕        | ✕           | ●              | ✕       |
| User      | `partition`,`request_type` | `user_type`/count/start/`field` | ○(既定4) | ✕           | ●              | ✕       |
| Field     | `partition`,`resource`     | `active`/count/start            | ✕        | ✕           | ✕              | ✕       |
| Option    | `partition`                | `level`/`alias`/`enabled`/count | ✕        | ✕           | ✕              | ✕       |

導かれる事実:

1. **`condition` を受けるマスタは無い** → どのマスタも **id 指定の `get(id)` を持てない**（汎用 `get` は `P_Id:eq` condition に依存）。
2. **`field` を受けるのは User のみ**。Partition/Field/Option は固定列を返す（カタログ既定 field は User 以外不要）。
3. **Partition は `partition` パラメータすら取らない**（partition を発見する API なので当然）。汎用 `buildReadUrl`（partition 必須）に乗らない。
4. **`request_type` は Partition/User で必須**で、意味が **OAuth 方式（[ADR-0007][0007]）依存**:
   - Partition `request_type=0`（ログイン中）: ブラウザ `code` 認証時のみ取得可。**`code_direct`（本ライブラリ既定）では Result Code 403**。
   - Partition `request_type=1`: アクセス可能な Partition 一覧（`code_direct` でも機能）。
   - User `request_type=0`: `code` ならログインユーザー、**`code_direct` なら「アプリ名の User（＝API アプリ自身のユーザー）」**＝自己同定として有効。
   - User `request_type=1`: 全 User。
5. 封筒は Partition/User/Field が標準（`Total/Count/Start` 属性）、Option は `<Code>`＋再帰 `<Items>`。いずれも `parseResourcePage` で top-level はパース可能。
6. Field の `P_ReferTo` は空 or 入れ子（`<Field.P_ReferTo><Option.P_Area/></Field.P_ReferTo>`）＝既存 Data Type で表せない bespoke 値。

問い: マスタごとに **どんなクエリ型を公開し**、**`get` をどう扱い**、**`current()` を OAuth 依存の現実にどう合わせ**、**何を共有し何を bespoke にするか**。

## Decision Drivers

- **API 忠実性 / 接地**（[ADR-0002][0002]）: 実 Read API が受けるパラメータだけを型に出す。受け付けない `condition`/`get(id)` を偽装しない。
- **フェイルセーフ / least surprise**: 既定動作（`code_direct`）で 403 にしかならない経路を「ふつうに呼べる」顔で出さない。意味の違いは型・JSDoc で明示。
- **薄いラッパー**: PORTERS のクエリ語彙（`request_type`/`user_type`/`resource`/`active`/`level`/`alias`/`enabled`）を素直に型化。
- **再利用は可能な範囲で**: 封筒パース（`parseResourcePage`）・カタログ decode（`decodeItem`）・ページング（`searchAll`）は共有。URL/クエリ・`current()`・Option 再帰・`P_ReferTo` は bespoke。
- **ADR-0021 の核を壊さない**: 単数形アクセサ・読み取り専用・Option フラット化・カタログ decode は維持。

## Considered Options

### D1: `get(id)` の扱い（どのマスタも condition 非対応）

- **案D1a: `get(id)` を提供しない** — 契約を `search()` ＋ `searchAll()`（＋ `current()`）に縮める。マスタは「リスト＋発見」モデル。
- **案D1b: クライアント側 list+filter で `get(id)` を疑似提供** — 全件取得して id 一致を返す。API には無い操作を“あるように”見せ、over-fetch。

### D2: マスタ毎のクエリ型（実 API に接地）

各マスタ bespoke（共通 `SearchQuery` は使わない）。`partition` は client/per-call の既定から供給（Partition は送らない）:

- Partition: `{ requestType?: 0 | 1; count?; start? }`（既定 `requestType=1`）
- User: `{ requestType?: 0 | 1; userType?: -1 | 0 | 1; field?: string[]; count?; start? }`（既定 `requestType=1`/`userType=-1`/`field`=カタログ既定）
- Field: `{ resource: ResourceType; active?: -1 | 0 | 1; count?; start? }`（`resource` 必須）
- Option: `{ alias?: string; level?: number; enabled?: -1 | 0 | 1; count? }`（再帰フラット化は ADR-0021 軸3）

### D3: `current()`（request_type=0）の出し方

- **案D3a: User に `current()`、Partition にも `current()`（OAuth 依存を JSDoc 明示）** — `user.current()`=自己（code_direct ではアプリ User）、
  `partition.current()`=ログイン中（`code` 時のみ・`code_direct` は 403）。403 は構造化エラー（permission/auth）＋ hint に倒す。一覧は `search()`（`requestType=1` 既定）。
  オンボーディング（[basic-design][bd] §118）はブラウザ `code` で `authorizationUrl()` 経由＝そこで `partition.current()` が活きる。
- **案D3b: Partition は `current()` を出さず一覧（`requestType=1`）のみ** — `code_direct` で 403 にしかならない経路を公開面から除く。`current()` は User だけ。

### D4: 共有 vs bespoke（実装方針）

- 共有: `parseResourcePage`（封筒）/ カタログ `decodeItem` / `searchAll`（ページング）。
- bespoke: マスタ毎の URL・クエリ型 / `current()` / Option の `Items` 再帰フラット化 / Field `P_ReferTo` の入れ子 decode。

## Decision Outcome

採用: **D1=案D1a ／ D2=接地どおり ／ D3=案D3b ／ D4=記載どおり**。

- **D1a（get なし）**: マスタの読み取り専用契約から **`get(id)` を除外**（どのマスタも condition/id を受けないため）。ADR-0021 軸2 の
  `{search, searchAll, get}` を見直し、**マスタ毎に API が実際に持つ操作だけ**を公開する。id で 1 件欲しい用途は `search()` 結果を利用側で絞る:
  - Partition: `search` ＋ `searchAll`
  - User: `search` ＋ `searchAll` ＋ `current`
  - Field: `search` ＋ `searchAll`
  - Option: **`search` のみ**（Option Read に `start` が無く offset ページング不可。ツリーは `count` 制限付きで一括返却＝`searchAll` 非対応）
- **D2**: 上記 bespoke クエリ型をマスタ毎に公開。`ResourceType`（Field 用）は [resources-list][res-list] の Value（Candidate=1/Job=3/Client=5/…）に対応する名前付き型。
- **D3b（Partition は current なし）**: `current()`（request_type=0）は **User だけ**に提供（`code_direct` ではアプリ自身の User＝自己同定として有効）。
  **Partition は `current()` を出さず `search()`（`requestType` 既定 1＝アクセス可能 Partition 一覧）のみ**。`code_direct` 既定で 403 にしかならない
  `partition` の request_type=0 経路を公開面から排除＝最小驚き。`code` 利用時のログイン Partition 発見は、必要になれば将来 opt-in で再検討。
- **D4**: 封筒（`parseResourcePage`）/ カタログ decode（`decodeItem`）/ ページング（`searchAll`）は既存実装を共有関数化して再利用
  （ADR-0021 軸2 の「重複ゼロ」は**読み取り内部**については成立）、クエリ面は bespoke。

### Consequences

- Good: 公開面が**実 Read API が実際に受ける形**に一致（偽の `condition`/`get`/`current` を出さない）。`code_direct` 既定で 403 にしかならない `partition` の request_type=0 経路を**公開面から排除**＝最小驚き。ADR-0021 の核（単数形・読み取り専用・Option フラット・カタログ decode）は維持。
- Bad: マスタ毎にクエリ型・操作集合が分かれ、データ系の `SearchQuery`/`get` と統一できない（学習面はマスタごとの小さな型で緩和）。`get(id)` 不在・Option の `searchAll` 不在を README/JSDoc で周知する必要。`code` 利用時のログイン Partition 発見は v1 では出さない（将来 opt-in）。
- Neutral: ADR-0021 軸2/軸4 を本 ADR が **amend**（軸1/3/5 と読み取り専用は不変）。実装は ADR-0021 のフォローアップ PR に本 ADR を織り込む。Field `P_ReferTo` の入れ子 decode・`User.current()`（request_type=0）の `code_direct` 実挙動（アプリ User 返却）・Partition が partition 非送信で通るかは [live-verification][lv] で接地（実機確認）。

## Pros and Cons of the Options

### D1

- **案D1a**: Good=API に無い操作を出さない・薄い。Bad=「1 件取得」は利用側で絞る一手間。
- **案D1b**: Good=データ系と同じ `get(id)` で見かけ統一。Bad=over-fetch＋API に無い操作の偽装＝最小驚き/忠実性に反する。

### D3

- **案D3a**: Good=自己同定（User）とオンボーディング（Partition・`code` 時）を提供・意図が API に出る。Bad=`code_direct` で `partition.current()` が 403＝説明責任（JSDoc/エラー hint で対処）。
- **案D3b**: Good=403 経路を公開面から排除し最小驚き。Bad=`code` 利用時のログイン partition 発見を別途要し、オンボーディング補助が弱まる。

## More Information

- 接地（正典 Read 記事）: [Partition Read][src-partition]・[User Read][src-user]・[Field Read][src-field]・[Option Read][src-option]。リソース Value: [resources-list][res-list]。
- amend 対象: [ADR-0021][0021]（軸2 クエリ面・軸4 current）。据え置き: 軸1（単数形＋`tenant`）・軸3（Option 再帰フラット）・軸5（カタログ decode）。
- 関連: [ADR-0007][0007]（code/code_direct）／[ADR-0008][0008]（partition 既定・`tenant`）／[ADR-0011][0011]（decode）／[ADR-0019][0019]（カタログ SoT）／[ADR-0020][0020]（既定 field）。
- 不確実性: [live-verification][lv] に追加（Field `P_ReferTo` 入れ子・Partition `current` の `code_direct` 403・Partition が partition 非送信で通るか）。
- フォローアップ: accept 後、ADR-0021 のフォローアップ実装 PR に統合（共有 Read 内部の切り出し → マスタ毎 factory ＋ `current` → fixture/テスト → README/JSDoc → LV）。

[0021]: 0021-master-read-resources.md
[0020]: 0020-read-field-default.md
[0019]: 0019-static-resource-types.md
[0011]: 0011-xml-parse-serialize.md
[0008]: 0008-multitenancy-partition.md
[0007]: 0007-oauth-public-surface.md
[0002]: 0002-ground-design-in-live-api-docs.md
[bd]: ../design/basic-design.md
[lv]: ../live-verification.md
[ref-masters]: ../reference/resource-api/resources/
[res-list]: ../reference/resource-api/resources-list.md
[src-partition]: ../../tmp/porters-docs/txt/115012006227-Partition-Read.md
[src-user]: ../../tmp/porters-docs/txt/115012160288-User-Read.md
[src-field]: ../../tmp/porters-docs/txt/115012160308-Field-Read.md
[src-option]: ../../tmp/porters-docs/txt/115012160328-Option-Read.md
