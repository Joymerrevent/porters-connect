# 101. リソースの共通の仕組みを `src/accessor/` に出し、ファイル名に `create` を付けてもよいことにする

- Status: accepted
- Date: 2026-09-26
- Deciders: jun.shiromoto (Joymerrevent)

> 起票元は stakeholder との議論（2026-09-26）。`src/resources/core/` のリファクタリング（#434）の後、`src/` のフォルダと
> ファイルのルールを基本設計にまとめる議論の中で、stakeholder が「`resources/core/` を `core/` に分離するのはどうか」
> 「ファイル名の `create` は付けてもよいことにしたい」と提案した。名前は `accessor/` を選んだ。どちらも
> [ADR-0097][adr97] で決めたこと（案3a・名前の決まり）を変えるので、この ADR で置き換える。
>
> **decider が案1a ＋ 案2a を選択し `accepted`（2026-09-26）。** 実装は accept 後・別 PR（#434 のマージ後）。
>
> **追記（accepted・マージ後 2026-09-26）**: 基本設計の議論の続きで、「1 ファイルに主な export は 1 つ」を原則にし、
> まとめてよいものを例外として挙げることにした（下の「追記: ファイルの分け方」）。accepted の ADR は新しい ADR で
> 置き換える運用だが、いま進めている作業の範囲なので、**stakeholder の指示で例外として本文に追記した**。

## Context and Problem Statement

### いまの形（ADR-0097）

- **共通の仕組みの置き場（案3a）**: アクセサを組み立てる共通の仕組みを `src/resources/core/` に置き、リソース本体と分ける。
  層の表では `resources/` の中の一部として扱い、「`core/` は `resources/` 直下を import しない」を**別の規則**として足している
  （`eslint.config.mjs` の `resources/core/` 専用の設定）。
- **ファイル名の決まり**: ファイル名は主な export の名前を kebab-case にしたもの。**factory の `create` は付けない**
  （`createTokenManager` → `token-manager.ts`）。

### 何が変わったか（2026-09-26 に数えた。#434 の後の形）

| 項目                                       | ADR-0097 のとき（2026-09-25） | いま                                                                                             |
| ------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `resources/core/` のファイル               | 7                             | 21（テスト 17 を除く）                                                                           |
| `core/` を `resources/` の外から使うところ | —                             | `client.ts`・`fields/define-fields.ts`（`EmptyCatalog` など）、テスト 7 ファイル（偽サーバー等） |

- `core/` は、項目の一覧の型（`catalog`）・送信（`read` / `write`）・ページ送り・`field` の組み立て・クエリの組み立て・
  データ系とマスタのアクセサの factory まで持つ、**それだけで 1 つの責務のまとまり**になった。
- `client.ts` と `fields/` は、`resources/` の中の `core/` まで手を入れて型を取っている。層の表では `resources` を使ってよいので
  規則には反しないが、「リソース本体」ではなく「仕組み」に依存していることが、パスからは読み取れない。
- `core/` のための別の規則は、層の表の外にある例外で、表を読むだけでは分からない。

### 問い

1. 共通の仕組みを、`resources/` の中に置くか、`src/` の直下に 1 つのモジュールとして出すか。出すなら名前は何か。
2. ファイル名の決まりで、factory の `create` を付けないことを続けるか。

## Decision Drivers

- **規則に例外を作らない**: 依存の向きは層の表だけで読めて、eslint も表のとおりに止める。
- **名前で中身が分かる**: フォルダ名から、何が入っているかが読める。
- **公開 API を変えない**: 動かすのは内部のファイルだけ。
- **いまあるファイル名を無理に変えない**: 決まりを変えるために、合っているファイルの名前を変えることはしない。

## Considered Options

### 軸1: 共通の仕組みの置き場

- **案1a: `src/accessor/` に出し、層を 1 段足す**（stakeholder の提案）
- 案1b: いまのまま `src/resources/core/` に置く（ADR-0097 のまま）
- 案1c: `src/core/` に出す（名前だけ案1a と違う）

### 軸2: ファイル名の `create`

- **案2a: 付けても付けなくてもよい**（stakeholder の提案）
- 案2b: 付けない（ADR-0097 のまま）
- 案2c: factory のファイルには必ず付ける

## Decision Outcome

採用: **案1a ＋ 案2a**（decider が 2026-09-26 に選択）。

### 決めること（案1a）

- `src/resources/core/` を `src/accessor/` に移す。名前は、中身が「リソースのアクセサを組み立てる仕組み」であることから取る
  （`src/` の直下で `core` とすると、ライブラリ全体の中心とも読めるため）。
- 層の表に `accessor` を 1 段足す。

| 層  | モジュール                       | import してよい先                           |
| --- | -------------------------------- | ------------------------------------------- |
| 0   | `porters/`                       | なし（[ADR-0098][adr98]）                   |
| 1   | `errors/`                        | `porters`                                   |
| 2   | `util/`                          | 1 まで                                      |
| 3   | `xml/`                           | 2 まで                                      |
| 4   | `http/`                          | 3 まで                                      |
| 5   | `auth/`                          | 4 まで                                      |
| 6   | `accessor/`（新）                | 4 まで（`auth` は使っていないので含めない） |
| 7   | `resources/`                     | 4 まで と `accessor`                        |
| 8   | `fields/`                        | 4 まで と `accessor` / `resources`          |
| 9   | 直下（`client.ts` / `index.ts`） | すべて                                      |

- 「`core/` は `resources/` 直下を import しない」という別の規則は、層の表の「`accessor` は `resources` を import しない」に
  吸収されて無くなる。eslint の `resources/core/` 専用の設定も、層の表の 1 行に置き換わる。
- `accessor/` の中にも、フォルダ名と重なる語は付けない（`-accessor` を付けない。ADR-0097 の決まりのまま）。

### 決めること（案2a）

- ファイル名は、いままでどおり**主な export の名前を kebab-case にしたもの**。factory の `create` は**付けても付けなくてもよい**
  （`createTokenManager` は `token-manager.ts` でも `create-token-manager.ts` でもよい）。
- この決まりに合わせるために、いまあるファイルの名前は変えない。

### 追記: ファイルの分け方（accepted・マージ後 2026-09-26）

[ADR-0097][adr97] の「主な export が 1 つに決まらないファイルは、役割を表す名前にする」を、次のように改める。

- **原則: 1 ファイルに主な export は 1 つ**。ファイル名はその名前を kebab-case にしたもの（`create` は案2a のとおり任意）。
  ファイル名と中の名前が同じになるので、名前だけで置き場所が分かる。
- **その export の引数・戻り値・設定にだけ使う型は、同じファイルに置いてよく、数に入れない**
  （例: `createDataReader` と `DataReadConfig`）。
- **例外（1 ファイルにまとめてよいもの）**。例外のファイルは役割を表す名前にする。
  - **対になる関数**: 変換と逆変換のように、片方を直すともう片方も直すもの（例: `util/alias.ts` の `qualify` / `bareAlias`、
    `util/base64.ts`、`util/datetime.ts`、`util/time-of-day.ts`）
  - **一緒に使う型の集まり**: 1 つの概念を複数の型で表すもの（例: 検索クエリの `Condition` / `Order` / `SearchQuery`、
    `auth/types.ts`）
  - **PORTERS が決めた値の表**: `porters/` の中（[ADR-0098][adr98] で値の種類ごとに分けると決めている）
- **いまあるファイル**: 原則に合わないもの（2026-09-26 に数えて 17 本前後。名前だけずれているもの 8 本前後と、
  複数の関数や型を持つもの 9 本前後）は、`src/accessor/` への移動の後に、1 本のリファクタリングの PR でまとめて直す。
  それまでに新しく作るファイルは原則に合わせる。

### 対象外

- `accessor/` の中のファイルを、読み込みは `read-`、書き込みは `write-` で始めて並べている形（#434）は**一時的なもの**で、
  この ADR ではルールにしない。
- 名前の変更を中身の変更と別のコミットにすること、移したファイルを ADR の索引の「移設前のパス表記」に載せることは、
  ADR-0097 のまま続ける（手順なので、基本設計ではなく `CLAUDE.md` と ADR の索引に書く）。

### Consequences

- Good: 依存の向きが層の表だけで読める。`core/` のための別の規則が無くなる。
- Good: `client.ts` と `fields/` が、リソース本体ではなく仕組み（`accessor`）に依存していることが、パスで分かる。
- Good: `resources/` にはリソース本体だけが残る。
- Bad: `src/resources/core/` の 21 ファイル（とテスト 17）を移し、`resources/` 21 ファイル・`client.ts`・`fields/`・
  テスト 7 ファイルの import を書き換える。
- Bad（案2a）: 同じ種類のファイルに、`create` の付いた名前と付いていない名前が混ざりうる。
- Neutral: 公開 API は変わらない（`src/index.ts` が export する記号は同じ。どのフォルダから取るかだけが変わる）。

## 信じている入力

該当なし — ファイルの置き場と名前の決定で、外部から受け取って正しいと信じる値は無い。

## Pros and Cons of the Options

- 案1a — Good: 層の表に例外が無い。名前で中身が分かる。Bad: 移すファイルと書き換える import が多い。
- 案1b — Good: 何も動かさない。Bad: 層の表の外に `core/` の規則が残る。`client.ts` / `fields/` が `resources/` の中に手を入れる。
- 案1c — Good: 案1a と同じく例外が無い。名前が短い。Bad: `src/` の直下の `core` は、ライブラリ全体の中心とも読める。
- 案2a — Good: `create` を付けた方が読みやすい場面で付けられる。いまのファイル名を変えなくてよい。Bad: 書き方が 2 通りになる。
- 案2b — Good: 書き方が 1 通り。Bad: 付けた方が読みやすい場面でも付けられない。
- 案2c — Good: factory のファイルが名前で分かる。Bad: いまある factory のファイル（`token-manager.ts` など）を改名することになる。

## More Information

- 実装（accepted 後・別 PR）: `src/resources/core/` → `src/accessor/` への移動（名前の変更は中身の変更と別のコミット）、
  import とコメントの中のパスの書き換え、`eslint.config.mjs` の層の表、基本設計 §2、`CLAUDE.md` のディレクトリ構成、ADR の索引の
  「移設前のパス表記」。
- 順番: #433（[ADR-0100][adr100] の実装）と #434（`resources/core/` のリファクタリング）がマージされた後に行う。
  「追記: ファイルの分け方」に合わせたいまあるファイルの見直しは、`src/accessor/` への移動の後に別の PR で行う。ほぼ全ファイルの
  import を書き換えるので、先に行うと両方の取り込み直しで衝突する。
- [ADR-0097][adr97] には、accepted と同時に「案3a とファイル名の決まりの `create` は ADR-0101 で改めた」ことを 1 行で足した（本文は書き換えない）。

[adr97]: 0097-src-module-layout.md
[adr98]: 0098-porters-rules-folder.md
[adr100]: 0100-expand-resource-types.md
