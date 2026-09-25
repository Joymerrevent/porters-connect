# 99. 検索クエリの型からページ送り（`count` / `start`）を外し、`Paging` を別の型にする

- Status: proposed
- Date: 2026-09-25
- Deciders: jun.shiromoto (Joymerrevent)

> 起票元は stakeholder の問い（2026-09-25）。データ系とマスタの読み取りの組み立てを揃えているときに「マスタは
> `search` が `Q & Paging`（独自のクエリ ＋ ページ送り）なのに、データ系はなぜ違うのか。データ系も揃えられないか」と
> 問いがあり、「`SearchQuery` に破壊的変更を入れてもよい」と方針が示された。
>
> [ADR-0038][adr38] で決めた公開の検索クエリ `SearchQuery`（`count` / `start` を含む）の形を改める。**公開 API の破壊的変更**。

## Context and Problem Statement

### いまの形

公開している検索クエリの型は、どれも**ページ送り（`count` / `start`）を含んでいる**。ページ送りを自分で決める
`searchAll` は、そこから `count` / `start` を**抜いた型**を受ける。

| 対象                                                 | `search` が受ける型                                           | `searchAll` が受ける型                                           |
| ---------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| データ系 12 種（Attachment を除く）                  | `SearchQuery<F, R>`（`CandidateSearchQuery` など）            | `Omit<SearchQuery<F, R>, "count" \| "start">`                    |
| マスタ 4 種（Partition / User / Field / Department） | `PartitionSearchQuery` など                                   | `Omit<PartitionSearchQuery, "count" \| "start">` など            |
| Attachment                                           | `AttachmentSearchQuery`                                       | `AttachmentWalkQuery`（`Omit<AttachmentSearchQuery, …>` の別名） |
| Option                                               | `OptionSearchQuery`（`count` だけ。ページではなく件数の上限） | （`searchAll` は無い。PORTERS 側に `start` が無い）              |

一方、ライブラリの内部では、マスタの読み取りの組み立てを「そのマスタ独自のクエリ `Q` ＋ ページ送り `Paging`」と
いう向きで書いた（`search` は `Q & Paging`、`searchAll` は `Q`）。**同じ「クエリとページ送り」を、公開の型は
「ページ送り込みから抜く」向き、内部の組み立ては「独自のクエリに足す」向きで表していて、揃っていない**。

### 何が読みにくいか

- **`searchAll` の引数の型に名前が無い**（Attachment を除く）。API リファレンスには `Omit<…, "count" | "start">` が
  そのまま出る。Attachment だけは `AttachmentWalkQuery` という名前を付けていて、ほかと扱いが違う。
- **`count` / `start` の意味が型の中で 2 つに割れている**。`search` ではページの指定、`searchAll` では「指定できない
  もの」。ページ送りは「何を探すか」とは別の関心事なのに、「何を探すか」の型に入っている。

### 問い

検索クエリの型を「何を探すか」だけにし、ページ送りを別の型にするか。するなら、どの型まで揃えるか。

## Decision Drivers

- **関心事で型を分ける**: 「何を探すか」（クエリ）と「どこからどれだけ読むか」（ページ送り）を別の型にする。
- **データ系とマスタと Attachment で同じ形にする**: `search` は「クエリ ＋ ページ送り」、`searchAll` は「クエリ」。
- **`searchAll` の引数に名前を付ける**: API リファレンスに `Omit<…>` を出さない。
- **1.0 前**: 破壊的変更を入れるなら今が安い（[ADR-0091][adr91]・[ADR-0093][adr93] と同じ判断）。

## Considered Options

### 軸1: クエリの型の形

- **案1a: `…SearchQuery` からページ送りを外し、`Paging`（`count` / `start`）を公開の型として足す**（推奨）
- 案1b: `…SearchQuery` は今のまま残し、ページ送りを除いた型を別の名前で足す（例: `ReadQuery`）。破壊的変更なし
- 案1c: 変えない

### 軸2: 揃える範囲

- **案2a: データ系・マスタ 4 種・Attachment のすべて。Option は対象にしない**（推奨）
- 案2b: データ系の `SearchQuery` だけ

## Decision Outcome

**未決（proposed）**。以下は推奨案（1a ＋ 2a）で書いた場合の形。

### 決めること（推奨案）

- 公開の型 `Paging` を足す: `{ count?: number; start?: number }`（`count` は 1〜200、`start` は 0 始まり。範囲の検査は
  いまと同じく送る前に行う）。
- 次の型から `count` / `start` を外す。中身は「何を探すか」だけになる。
  - `SearchQuery<F, R>` と、それを特定したリソースごとの別名（`CandidateSearchQuery` など 12 種）
  - `PartitionSearchQuery` / `UserSearchQuery` / `FieldSearchQuery` / `DepartmentSearchQuery`
  - `AttachmentSearchQuery`
- `search` は `query?: …SearchQuery & Paging`、`searchAll` は `query?: …SearchQuery` を受ける。
- `AttachmentWalkQuery` は無くす（`AttachmentSearchQuery` と同じ中身になるため）。
- **Option は対象にしない**。Option の `count` はページ送りではなく件数の上限で（`start` も `searchAll` も無い）、
  `Paging` とは意味が違う。`OptionSearchQuery` はいまのまま `count` を持つ。
- 利用者向けの移行の案内を CHANGELOG（changeset）に書く。

### 利用者への影響

- `t.candidate.search({ field: [...], count: 50 })` のように、その場でオブジェクトを書くコードは**そのまま動く**。
- 壊れるのは、クエリを変数に取って `…SearchQuery` の型を付け、そこに `count` / `start` を書いているコード。
  例: `const q: CandidateSearchQuery = { count: 50 }`。移行は型を `CandidateSearchQuery & Paging` にするだけ。
- `AttachmentWalkQuery` を使っているコードは、`AttachmentSearchQuery` に書き換える。
- `…SearchQuery["count"]` のように型から取り出しているコードは、`Paging["count"]` に書き換える。

### 推奨案を採る理由

- **案1a**: 「何を探すか」と「どこからどれだけ読むか」が別の型になり、`search` / `searchAll` の違いが型の名前で
  読める（`& Paging` があるかどうか）。`searchAll` の引数にも名前が付く。
- **案1b** は壊さないが、同じ中身の型が 2 つの名前で並ぶ（`SearchQuery` と `ReadQuery`）。どちらを使うかを利用者が
  迷い、`…SearchQuery` の名前が「ページ送り込み」を意味し続けるので、関心事の割れは残る。
- **案1c** は、`searchAll` の型に名前が無いまま・Attachment だけ名前がある状態を残す。
- **案2a**: 同じ考え方でマスタと Attachment も揃えないと、「〜SearchQuery」がデータ系ではページ送りを含まず、
  マスタでは含む、と名前の意味が食い違う。
- **案2b** は影響が小さいが、上の食い違いを作る。

### Consequences

- Good: クエリとページ送りが別の型になり、`search` と `searchAll` の違いが型で読める。
- Good: `searchAll` の引数に名前が付き、`AttachmentWalkQuery` だけが特別な状態がなくなる。
- Good: 公開の型とライブラリ内部の組み立て（独自のクエリ ＋ ページ送り）が同じ向きになる。
- Bad: **破壊的変更**。クエリを変数に取って型を付けているコードと、`AttachmentWalkQuery` を使うコードは直す必要がある。
- Neutral: 送るパラメータ・範囲の検査・戻り値は変わらない。Option は変わらない。

## Pros and Cons of the Options

- 案1a — Good: 関心事で型が分かれる。名前が揃う。Bad: 破壊的変更。
- 案1b — Good: 壊さない。Bad: 同じ中身の型が 2 つの名前で並ぶ。関心事の割れが残る。
- 案1c — Good: 何も変えない。Bad: `searchAll` の型に名前が無いまま。
- 案2a — Good: 「〜SearchQuery」の意味がどこでも同じになる。Bad: 変える型が多い（公開の型 18 個と `AttachmentWalkQuery`）。
- 案2b — Good: 影響が小さい。Bad: データ系とマスタで名前の意味が食い違う。

## More Information

- 実装（accepted 後・別 PR）: 公開の型の定義、`search` / `searchAll` の型、`src/index.ts`（`Paging` を足し、
  `AttachmentWalkQuery` を外す）、型のテスト、API リファレンスの生成し直し、使い方ドキュメント（「検索」の章と
  リソース別のページの型の表）、changeset（minor・破壊的変更と移行の案内）。
- 実装は、公開 API を変えないリファクタリング（データ系とマスタの読み取りの組み立てを揃える PR）の後に行う。

[adr38]: 0038-read-query-surface-impl.md
[adr91]: 0091-token-provider-and-store.md
[adr93]: 0093-get-token-with-expiry.md
