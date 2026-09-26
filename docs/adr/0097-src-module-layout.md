# 97. `src/` のモジュールを層に並べ、依存の向きを lint で守る

- Status: accepted
- Date: 2026-09-25
- Deciders: jun.shiromoto (Joymerrevent)

> 起票元は stakeholder の問い（2026-09-25）。はじめは「`src/resources/` のリソース本体とメソッドをフォルダで分けたい」
> だったが、議論で「`src/resources/` の中だけでなく `src/` 全体を整理する ADR にしたい」に広げた。
>
> [基本設計][basic-design] §2 のモジュール構成を改める案。公開 API は変えない。
>
> **decider が案1a ＋ 案2a ＋ 案3a ＋ 案4a を選択し `accepted`（2026-09-25）。** 実装は accept 後・別 PR（[ADR-0096][adr96] の実装より先）。
>
> **Amended by [ADR-0098][adr98]（2026-09-25）**: 層の表の一番下に `porters/`（PORTERS が決めた値と定義表）を足し、
> 案3a の「定義表（resource-list / field-type）は `resources/` 直下に残す」を改めた（定義表は `src/porters/` へ移す）。
>
> **Amended by [ADR-0101][adr101]（2026-09-26）**: 案3a の共通の仕組みの置き場（`resources/core/`）を `src/accessor/`（層を 1 段足す）に、
> ファイル名の決まりの「factory の `create` は付けない」を「付けても付けなくてもよい」に改めた。

## Context and Problem Statement

### いまの形（2026-09-25 時点・テストを除いたファイル数）

| モジュール   | ファイル数 | 中身                                                                                           |
| ------------ | ---------- | ---------------------------------------------------------------------------------------------- |
| `errors/`    | 3          | `PortersError` の階層と code → category                                                        |
| `util/`      | 5          | alias / xml-name / datetime（内部）、base64 / time-of-day（公開）                              |
| `xml/`       | 5          | パース・エンコード・デコード                                                                   |
| `http/`      | 10         | transport・requester・throttle・retry・アクセスポイント・モックの transport                    |
| `auth/`      | 7          | トークンの取り方・置き場所・管理・`porters.auth`                                               |
| `resources/` | 28         | リソース本体 18、共通の仕組み 7、PORTERS の定義表 2（resource-list / field-type）、バレル 1    |
| `fields/`    | 5          | `defineFields`（宣言）と、テナントの実際の項目を読む道具（tenant-catalog / generate / verify） |
| `types/`     | 2          | `Scope` / `PartitionId` / `Scheme` の 3 つの型とバレル                                         |
| 直下         | 2          | `client.ts`（`PortersClient`・`tenant()`）と `index.ts`（公開する記号の一覧）                  |

### モジュール間の依存（2026-09-25 に import を数えた）

```text
errors   ← どこからも import される。何も import しない
util     → errors
xml      → errors, util
http     → errors, types, auth（型 1 つだけ）
auth     → errors, http, xml, types
resources→ errors, util, xml, http
fields   → errors, xml, resources
client.ts→ errors, http, auth, resources, fields, types
index.ts → すべて
```

ほぼすべての依存が「下の層から上の層へは import しない」一方向に並んでいる。例外は 1 本だけで、`http/requester.ts` が
`auth/types.ts` の `AccessTokenSource`（型）を import している。`AccessTokenSource` は公開していない型で、使う側は
`http` の requester、実装する側は `auth` の token manager。

### 気になっている点

1. **`resources/` の中で、リソース本体と共通の仕組みが名前でしか見分けられない**。テストを含めて 56 ファイルが
   1 つのフォルダに並ぶ。共通の仕組み 7 ファイル（resource / read-core / query / expand / image / bulk-write / get-many）は、
   お互いと `src` のほかのモジュールだけを import していて、個別のリソースを読み込まない閉じた集まりになっている。
2. **`http` → `auth` の逆向きの import が 1 本ある**（上の型）。型だけなので実行時の循環にはならないが、`auth` と
   `http` がお互いに依存している形になっている。
3. **`types/` は 3 つの型の置き場で、それぞれの型の持ち主は別のモジュール**。`Scheme` を使うのは `http`（2 か所）と
   `client.ts`、`Scope` は `auth` と `client.ts`、`PartitionId` は `client.ts` だけ。
4. **依存の向きを止める仕組みが無い**。eslint に import の向きの決まりは無く、上の一方向の並びはいま偶然保たれて
   いるだけ。フォルダを分けても、境目を人の記憶で守ることになる。

### 問題にしていない点（変えない）

- **`util/`**: `errors` だけに依存する一番下の層として、すでにまとまっている。内部の関数と公開する関数が混ざって
  いるが、何を公開するかは `src/index.ts` の明示 export で決めているので、フォルダで分ける理由にならない。
- **`client.ts` を直下に置くこと**: パッケージの入口で、`PortersClient` と `tenant()` を組み立てる 1 つの責務に
  収まっている（463 行）。
- **`fields/`**: `defineFields` とテナントの項目を読む道具が同じモジュールにあり、道具だけが `resources/`（Field マスタ）
  に依存している。依存は下向きなので、向きの規則には反しない。
- ~~**ファイル名**: 移動するファイルも名前は変えない（`core/read-core.ts` のような重複した語も残す）。~~
  **改めた（accepted 後・マージ前 2026-09-25）**: ファイル名も見直す。下の「追記」を参照。

### 移動で影響を受けないもの・受けるもの

- 受けない: mutation テストの対象（`stryker.config.json` の `mutate` は `src/**/*.ts` の glob）、`scripts/` と
  `.github/`（`src/<モジュール>/` のパスを書いたものは無い）、公開 API（`src/index.ts` の明示 export）。
- 受ける: `src` の中の相対 import、`test/` の import（`src/` の個別のファイルを直接指す 98 行のうち、移すファイルを
  指すのは 8 行）、
  live-verification の「コード箇所」、API リファレンスの生成物（`docs/usage/api` の「定義された場所」）、
  [基本設計][basic-design] §2、過去の ADR 本文のパス（書き換えず、ADR README に読み替えを足す）。

### 問い

`src/` のモジュールをどう並べ、依存の向きをどう守るか。あわせて、上の 1〜3 をどう片付けるか。

## Decision Drivers

- **依存の向きを仕組みで守る**: 決めた向きを eslint で止める。人の記憶に頼らない。
- **見て分かる**: フォルダを開いたときに、そこに何があるかが分かる。
- **いまの依存の形に合わせる**: 構成のために処理を組み替えない。変えるのはファイルの置き場所と、型の持ち主だけ
  （accepted 後・マージ前に、ファイル名も加えた。下の「追記」を参照）。
- **公開 API を変えない**: 利用者のコードに影響を出さない。

## Considered Options

### 軸1: 依存の向き

- **案1a: モジュールを層に並べ、各モジュールが import してよい先を決めて eslint で止める**（推奨）
- 案1b: 層を文書に書くだけにする（lint では止めない）
- 案1c: 決めない（いまのまま）

### 軸2: `http` → `auth` の逆向きの import

- **案2a: `AccessTokenSource` を `http/types.ts` に移す（使う側が型を持つ）**（推奨）
- 案2b: 型だけの import は例外として認める

### 軸3: `resources/` の中

- **案3a: 共通の仕組み 7 ファイルを `resources/core/` に移し、リソース本体と定義表は直下に残す**（推奨）
- 案3b: 案3a に加えて、リソース本体を `data/`（データ系 13 ＋ resource-list）と `master/`（マスタ系 5 ＋ field-type）に分ける
- 案3c: 分けない

### 軸4: `types/`

- **案4a: 3 つの型を持ち主のモジュールに移し、`types/` を無くす**（推奨）
- 案4b: いまのまま残す

## Decision Outcome

採用: **案1a ＋ 案2a ＋ 案3a ＋ 案4a**（decider が 2026-09-25 に選択）。

### 決めること

#### 層と、import してよい先（案1a）

下から順に並べる。各モジュールは、自分より下の層だけを import してよい。

| 層  | モジュール                       | import してよい先                         |
| --- | -------------------------------- | ----------------------------------------- |
| 1   | `errors/`                        | なし                                      |
| 2   | `util/`                          | `errors`                                  |
| 3   | `xml/`                           | `errors` / `util`                         |
| 4   | `http/`                          | `errors` / `util` / `xml`                 |
| 5   | `auth/`                          | 1〜4                                      |
| 6   | `resources/`                     | 1〜4（`auth` は使っていないので含めない） |
| 7   | `fields/`                        | 1〜4 と `resources`                       |
| 8   | 直下（`client.ts` / `index.ts`） | すべて                                    |

- `resources/` の中では、`core/` は `resources/` 直下（リソース本体と定義表）を import しない。
- eslint の `no-restricted-imports` を、モジュールごとの設定で掛ける（新しい依存パッケージは足さない）。
- `test/` は対象にしない（テストはどの層も直接 import してよい）。

#### `http` → `auth` の逆向き（案2a）

- `AccessTokenSource` を `auth/types.ts` から `http/types.ts` に移す。`auth` の token manager は `http` から import して
  実装する（`auth` → `http` は下向き）。公開していない型なので、公開 API は変わらない。

#### `resources/` の中（案3a）

- `resources/core/` を作り、`resource.ts` / `read-core.ts` / `query.ts` / `expand.ts` / `image.ts` / `bulk-write.ts` /
  `get-many.ts` と隣のテストを移す。`core/index.ts` はバレル（[ADR-0013][adr13]）。
- リソース本体 18 ファイル・`resource-list.ts`・`field-type.ts`・`index.ts` は `resources/` 直下に残す。

#### `types/`（案4a）

- `Scheme` → `http/access-point.ts`、`Scope` → `auth/types.ts`、`PartitionId` → `client.ts` に移し、`src/types/` を消す。
  `src/index.ts` は同じ名前で export し続ける（公開 API は変わらない）。

#### あわせて変えるもの

- [基本設計][basic-design] §2 のモジュール構成を、上の層の表に合わせて書き直す。
- 過去の ADR 本文にあるパスは書き換えない。ADR README の「移設前のパス表記」に読み替えを足す
  （[ADR-0071][adr71] のときと同じ扱い）。

### 推奨案を採る理由

- **案1a**: 数えてみると、依存はすでにほぼ一方向に並んでいて、例外は型 1 本だけだった。いまの形を規則として書き、
  lint で止めれば、崩れてから気づくことが無くなる。例外を 1 本直せば、規則は例外なしで書ける。
- **案1b** は書くだけなので、崩れても気づけない（この ADR の問いが出たのも、境目が見えないことからだった）。
- **案2a**: `AccessTokenSource` は「requester がトークンを受け取る口」で、形を決めているのは使う側の `http`。
  使う側が型を持てば、`auth` → `http` の一方向になる。**案2b** は規則に例外を作り、lint の設定もその分だけ複雑になる。
- **案3a**: 共通の仕組みはすでに閉じた集まりなので、移しても依存の形は変わらない（変わるのは相対パスだけ）。
  **案3b** は、`field`（マスタ）が `resource-list` を通してデータ系に依存しているので、「マスタはデータに依存しない」と
  書けず、規則に例外が要る。
- **案4a**: 3 つの型はどれも持ち主がはっきりしていて、`types/` を経由する理由が無い。**案4b** は、型を足すたびに
  「`types/` か持ち主か」を迷う置き場を残す。

### Consequences

- Good: 依存の向きが表で読め、崩すと lint が止める。
- Good: `resources/` を開いたときに、リソース本体と共通の仕組みがフォルダで分かれて見える。
- Good: `auth` と `http` がお互いに依存する形が無くなる。
- Bad: import の書き換えが出る（`src` の中の相対パスと、`test/` の 8 行）。移したファイルの履歴は
  `git log --follow` でたどる。
- Bad: live-verification の「コード箇所」、API リファレンスの生成物、過去の ADR・レビュー記録のパスが古くなる
  （前の 2 つは実装 PR で直し、後の 2 つは README の読み替えで補う）。
- Neutral: 公開 API・import のパス以外のファイルの中身・mutation テストの対象は変わらない。

### 追記（accepted 後・マージ前 2026-09-25）: ファイル名も見直す

accept の後、この ADR の PR がマージされる前に、decider が「ファイル名は変えない」を改め、`src/` 全体でファイル名を
見直すことにした（stakeholder の意向）。決定のほか（案1a〜4a）は変えない。

#### 名前の決まり

- **ファイル名は、そのファイルの主な export の名前を kebab-case にしたもの**にする。factory の `create` は付けない。
  いまの多くのファイルがすでにこの形になっている（`token-manager.ts` ↔ `createTokenManager`、`fetch-transport.ts` ↔
  `createFetchTransport`、`define-fields.ts` ↔ `defineFields` など）。
- 主な export が 1 つに決まらないファイル（型や関数を複数持つもの）は、役割を表す名前にする。
- **フォルダ名と重なる語は付けない**（`resources/core/` の中に `-core` を付けない）。
- kebab-case・1 ファイル 1 責務は [ADR-0013][adr13] のとおり。

#### 変える名前（2026-09-25 に `src/` のバレルとテストを除く 59 ファイルを見直した結果）

| いまの名前               | 新しい名前                       | 理由                                                                                              |
| ------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `resources/read-core.ts` | `resources/core/read.ts`         | `core/` に移すと「core」が重なる。中身は Read の共通処理（ページング・デコード・送信）            |
| `http/retry.ts`          | `http/backoff.ts`                | 中身は待ち時間の計算（`Backoff` / `expoBackoff`）だけで、再試行の繰り返しは requester にある      |
| `auth/token-provider.ts` | `auth/default-token-provider.ts` | 中身は既定の取り方（`createDefaultTokenProvider`）。`TokenProvider` の型は `auth/types.ts` にある |
| `auth/memory-store.ts`   | `auth/memory-token-store.ts`     | 主な export は `createMemoryTokenStore`                                                           |

- 隣のテストも同じ名前に変える（`read-core.test.ts` → `read.test.ts` など）。
- 4 つとも公開していないファイルなので、公開 API は変わらない。
- 上の表に無いファイルは名前を変えない。名前の決まりに合っているか、役割を表す名前になっている。

#### 実装での扱い

- 名前の変更は、中身の変更と別のコミットにする（git が名前の変更として追えるようにし、`git log --follow` で履歴を
  たどれるようにする）。
- ADR README の「移設前のパス表記」の読み替えに、名前を変えたファイルも載せる。

## Pros and Cons of the Options

- 案1a — Good: 向きが崩れたら止まる。いまの形をそのまま規則にできる。Bad: eslint の設定が増える。
- 案1b — Good: 設定が増えない。Bad: 崩れても気づけない。
- 案1c — Good: 何も変えない。Bad: 向きが偶然保たれているだけ。
- 案2a — Good: 規則に例外が要らない。Bad: 型の置き場所が変わる（公開していないので利用者には影響しない）。
- 案2b — Good: 何も動かさない。Bad: 規則に例外が残る。
- 案3a — Good: 依存の規則が 1 本（`core/` は直下を import しない）。Bad: データ系とマスタ系は見分けられない。
- 案3b — Good: データ系とマスタ系も見分けられる。Bad: 規則に例外が要る。移動が多い。
- 案3c — Good: 何も変えない。Bad: 仕組みとリソースが名前でしか見分けられない。
- 案4a — Good: 型の置き場を迷わない。Bad: import の書き換えが出る（テストを含めて 6 か所）。
- 案4b — Good: 何も変えない。Bad: 持ち主のいる型が別の場所にある。

## More Information

- 実装（accepted 後・別 PR）: **移動・ファイル名・型の置き場所・import のパスの書き換えだけ**にして、それ以外の中身は変えない。
  変更の種類ごとにコミットを分ける（型の移動 → `resources/core/` への移動 → eslint の規則 → 文書）。
  eslint の規則は最後に入れ、その時点で違反が 0 件であることを確かめる。
- 順番: この ADR の実装を、[ADR-0096][adr96]（`field` で戻り値の型を絞る）の実装より先に行う。ADR-0096 は
  `core/` に移るファイルを触るので、先に移しておくと移動と変更がぶつからない。

## パスの注記

<!-- 決定の本文は書き換えない。本文に書いたパスが移ったり名前が変わったりしたら、ここに今の場所を足す。 -->

本文に書いたパスのうち、あとで移したもの・名前を変えたものの今の場所（本文は決定したときのまま）:

- `resources/core/` → `src/accessor/`（2026-09-26・ADR-0101）
- `resources/core/read.ts` → 送信は `src/accessor/read.ts`、項目の一覧の型は `src/accessor/catalog.ts`、応答の変換は `src/accessor/decoder.ts`、ページ送りは `src/accessor/paging.ts`、`field` の組み立ては `src/accessor/field-param.ts`（2026-09-26 に分けて `src/accessor/` へ移した・ADR-0101）
- `query-encode.ts` と `read.ts`（`src/accessor/`）: `query-encode.ts` は `append-read-query.ts` / `build-read-params.ts` に、`read.ts` は `page-reader.ts` / `run-read.ts` / `page-url.ts` / `resource-page.ts` に分けた（2026-09-26・ADR-0101 の追記＝1 ファイルに主な export は 1 つ）。上に書いたこの 2 つのファイルは、いまは分けた先にある

[adr13]: 0013-coding-conventions-class-vs-function.md
[adr71]: 0071-usage-docs-single-root.md
[adr96]: 0096-narrow-record-type-by-field.md
[adr98]: 0098-porters-rules-folder.md
[adr101]: 0101-accessor-layer-and-file-names.md
[basic-design]: ../design/basic-design.md
