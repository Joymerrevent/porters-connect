# 98. PORTERS が決めた値と定義表を `src/porters/` にまとめる

- Status: accepted
- Date: 2026-09-25
- Deciders: jun.shiromoto (Joymerrevent)

> 起票元は stakeholder の問い（2026-09-25）。[ADR-0097][adr97] の実装を見て「`src/resources/` の直下はリソースの
> ファイルだけになると思った」と指摘があり、続けて「`field-type.ts` / `resource-list.ts` が PORTERS の仕組みのものなら、
> PORTERS 側のルール的なコードを 1 か所にまとめるフォルダを用意し、責務で整理したい」と提案があった。
>
> [ADR-0097][adr97] の層の表に一番下の層を 1 つ足し、案3a の「定義表（resource-list / field-type）は `resources/` 直下に
> 残す」を改める。公開 API は変えない。
>
> **decider が案B を選択し `accepted`（2026-09-25）。** 実装は accept 後・別 PR（[ADR-0096][adr96] の実装より先）。

## Context and Problem Statement

### PORTERS が決めた値が散らばっている（2026-09-25 に定数を数えた）

出典（PORTERS ヘルプセンター）に書いてある数・名前・対応表が、それを使うコードの近くに 1 つずつ置かれている。

| いまの置き場所                 | PORTERS が決めた値                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `resources/resource-list.ts`   | Resource List（リソースの番号: Candidate 1・Job 3 …）                                                            |
| `resources/field-type.ts`      | Field Type と Data Type の対応表                                                                                 |
| `resources/attachment.ts`      | 添付ファイルの上限 10MB（Base64 で約 14,000,000 文字）、`requestType` の値（`0` 本体あり / `1` なし）            |
| `resources/core/read.ts`       | 1 回の Read の件数 1〜200、ユーザー型で読める 4 項目（`P_Id` / `P_Type` / `P_Name` / `P_Mail`）                  |
| `resources/core/bulk-write.ts` | 1 回の Write の件数 200                                                                                          |
| `resources/core/get-many.ts`   | 1 回の Read の件数 200（`read.ts` と同じ決まりを別の名前で持っている）                                           |
| `resources/core/query.ts`      | キーワードの上限 100 文字、削除済みを読むときに条件に使える 3 項目                                               |
| `resources/core/image.ts`      | 画像の上限 2MB、ファイル名の上限 255 バイト                                                                      |
| `http/requester.ts`            | リクエストの長さの上限 約 15000 文字、Connect API Version `2`                                                    |
| `http/throttle.ts`             | 1 分あたり Read 2000 / Write 500                                                                                 |
| `xml/decode.ts`                | Data Type の一覧（`DataType`）                                                                                   |
| `xml/encode.ts`                | 画像の形式（`IMAGE_CONTENT_TYPES`）                                                                              |
| `util/time-of-day.ts`          | 時分型の基準日（`1970/01/01` / `1970/01/02`）と時の範囲                                                          |
| `fields/define-fields.ts` ほか | カスタム項目の alias の接頭辞 `U_` / `A_`（`define-fields.ts` と `tenant-catalog.ts` に同じ正規表現が 2 つある） |

出典を取り直して変更を見つけたとき（取り直しは 2026-06-12 と 2026-09-20 に行った）、直すべき場所を
探すところから始まる。同じ決まりを 2 か所に書いているもの（Read の件数 200・カスタム alias の接頭辞）もある。

### `resources/` の直下

[ADR-0097][adr97] 案3a は、定義表 2 つを `resources/` 直下に残した。`resource-list.ts` がデータ系 11 種の定義を
import していて `core/` に置けず、`field-type.ts` は共通の仕組みではないため。その結果、直下にはリソース本体 18 と
定義表 2 とバレルが並び、「直下はリソースだけ」にはなっていない。

### 依存の向き

- `field-type.ts` は `xml/decode.ts` の `DataType`（型）だけを import する。
- `resource-list.ts` は、各リソースの定義（`CANDIDATE_DESCRIPTOR` など）の `path` をキーにしている。表と定義の名前が
  ずれるとコンパイルが止まるようにするため（名前を変えたら表が壊れる）。
- 上の表のほかの値は、どれも定数で、何も import していない。

### 問い

PORTERS が決めた値と定義表を 1 か所にまとめるか。まとめるなら、何を入れ、何を入れず、依存の向きをどうするか。

## Decision Drivers

- **出典との突き合わせを 1 か所でできる**: 出典の変更を見つけたとき、直す場所が 1 つのフォルダで済む。
- **責務で分ける**: 「PORTERS が決めた値」と「ライブラリの判断」を、フォルダで見分けられる。
- **同じ決まりを 2 か所に書かない**: 片方だけ直して、もう片方が古いまま残ることを防ぐ。
- **依存の向きを崩さない**: [ADR-0097][adr97] の層の規則に、例外なしで収める。
- **公開 API を変えない**。

## Considered Options

- 案A: 定義表 2 つ（resource-list / field-type）だけを移す
- **案B: 定義表と、上の表の上限・値・対応表（`DataType` の一覧を含む）をまとめる**（推奨）
- 案C: 案B に加えて、各リソースの項目の定義（`FIELDS` / `REQUIRED_ON_CREATE`）も移す

## Decision Outcome

採用: **案B**（decider が 2026-09-25 に選択）。

### 決めること

#### 入れるもの・入れないもの

- **入れる**: 出典に書いてある数・名前・対応表そのもの（上の表のすべて）。
- **入れない**: ライブラリの判断。例: Result Code をどの `category` にするか（`errors/classify.ts`）、安全率 0.9
  （`http/throttle.ts`）、既定のタイムアウト 30 秒（`http/fetch-transport.ts`）、トークンを期限の何秒前に取り直すか。
  判断は、それを使うコードの近くに置く。
- **入れない**: 値を使って検査・変換するコード。日時の書式を読む正規表現（`util/datetime.ts`）や、上限を超えたら
  エラーにする処理は、いまの場所に残し、値だけを `porters/` から import する。
- **入れない**: 各リソースの項目の定義（`FIELDS` など）。リソースのファイルの中身そのものなので、リソースと一緒に置く（案C を採らない）。

#### 置き場所と層

- `src/porters/` を作る。ファイルは値の種類ごとに分ける（例: `resource-list.ts` / `field-type.ts` / `data-type.ts` /
  `limits.ts`（上限の数）/ `read-rules.ts`（ユーザー型の 4 項目・削除済みの条件の 3 項目など））。分け方とファイル名は
  [ADR-0097][adr97] 追記の名前の決まり（主な export の名前を kebab-case）に従い、実装で決める。
- **`porters/` を一番下の層にする**。`porters/` は何も import しない（`errors` も import しない）。
  [ADR-0097][adr97] の層の表は `porters` → `errors` → `util` → `xml` → `http` → `auth` → `resources` → `fields` → 直下 になる。
- 同じ決まりは 1 つの名前にする。Read の件数 200 は 1 つの定数にし、`read.ts` と `get-many.ts` がそれを使う。
  カスタム alias の接頭辞も 1 つにする。1 回の Write の件数 200 は、出典で別の決まりなので別の定数にする。

#### `resource-list.ts` の向きを逆にする

- いまは表が各リソースの定義からキーを取っている（表 → リソース）。`porters/` は何も import しないので、向きを逆にする。
  表が名前（`"candidate"` など）と番号を持ち、各リソースの定義の `path` を表の名前の型（`ResourceName`）で型付けする
  （リソース → 表）。
- どちらかの名前を変えればコンパイルが止まる点は、いまと変わらない。Phase と Attachment は番号を持たないので、
  型付けしない（いまと同じく `of("phase")` は型エラー）。

#### あわせて変えるもの

- `resources/` 直下は、リソース本体 18 ファイルとバレルだけになる。
- `DataType` を `xml/decode.ts` から `porters/` に移す。`xml/`・`resources/`・`fields/` の import を書き換える。
- `src/index.ts` は同じ名前で export し続ける（`ResourceName` / `resourceValueOf` / `resourceNameOf` / `DataType` など）。
- eslint の層の規則に `porters` を足す（`porters/` から他のモジュールを import したら止める）。
- [基本設計][basic-design] §2 と、ADR README の「移設前のパス表記」を合わせる。
- [ADR-0097][adr97] には、accepted 後に「定義表の置き場所と層の表を ADR-0098 で改めた」の一行を足す（本文は書き換えない）。

### 案B を採る理由

- **案A** は `resources/` 直下の見た目は片付くが、上限や値は散らばったままで、出典との突き合わせは楽にならない。
  「PORTERS の決まりを 1 か所に」という問いに半分しか答えていない。
- **案B** は、出典に書いてある値がすべて 1 つのフォルダに並ぶ。値だけを移し、使うコードは残すので、処理の中身は変わらない。
  `porters/` は何も import しないので、層の規則にも例外なしで収まる。
- **案C** は `porters/` が出典のほぼすべてを持つことになるが、リソースのファイルが薄くなりすぎ、リソースを 1 種足すときに
  2 か所（リソースと `porters/`）を開くことになる。「リソース 1 種＝1 ファイル」で読めることを優先して採らない。

### Consequences

- Good: 出典の変更を見つけたとき、`src/porters/` を出典と突き合わせれば済む。
- Good: 同じ決まりを 2 か所に書いていたもの（Read の件数・カスタム alias の接頭辞）が 1 つになる。
- Good: `resources/` の直下がリソースだけになる。
- Bad: 値と、それを使うコードが別のファイルに分かれる（使う側は名前付きの定数を import する）。
- Bad: `DataType` の import の書き換えが広い（`xml/`・`resources/`・`fields/` とテスト）。
- Bad: `resource-list.ts` の依存の向きが逆になり、各リソースの定義に型の注記が 1 つずつ増える（11 種）。
- Neutral: 公開 API は変わらない。

## Pros and Cons of the Options

- 案A — Good: 変更が小さい。`resources/` 直下がリソースだけになる。Bad: 上限や値は散らばったまま。
- 案B — Good: 出典に書いてある値が 1 か所に並ぶ。重複が消える。Bad: 値と使うコードが分かれる。書き換えが広い。
- 案C — Good: 出典のほぼすべてが 1 か所に並ぶ。Bad: リソースを足すときに 2 か所を開く。リソースのファイルが薄くなりすぎる。

## More Information

- 実装（accepted 後・別 PR）: 値と型の移動、`resource-list.ts` の向きの反転、import の書き換え、eslint の層の規則、文書。
  処理の中身は変えない。変更の種類ごとにコミットを分ける。
- 実装は [ADR-0096][adr96]（`field` で戻り値の型を絞る）より先に行う（accepted のときに決めた）。ADR-0096 は
  `resources/core/` のファイルを触るので、値の置き場所を先に決めておくと 2 つの変更がぶつかりにくい。

## パスの注記

<!-- 決定の本文は書き換えない。本文に書いたパスが移ったり名前が変わったりしたら、ここに今の場所を足す。 -->

本文に書いたパスのうち、あとで移したもの・名前を変えたものの今の場所（本文は決定したときのまま）:

- `resources/core/` → `src/accessor/`（2026-09-26・ADR-0101）
- `resources/core/bulk-write.ts` → `src/accessor/write-many.ts`（2026-09-26 に名前を変えて `src/accessor/` へ移した）
- `resources/core/get-many.ts` → `src/accessor/read-many.ts`（2026-09-26 に名前を変えて `src/accessor/` へ移した）
- `resources/core/image.ts` → `src/accessor/image.ts`（2026-09-26・ADR-0101）
- `resources/core/query.ts` → 型は `src/accessor/query.ts`、組み立ては `src/accessor/query-encode.ts`（2026-09-26 に分けて `src/accessor/` へ移した）
- `resources/core/read.ts` → 送信は `src/accessor/read.ts`、項目の一覧の型は `src/accessor/catalog.ts`、応答の変換は `src/accessor/decoder.ts`、ページ送りは `src/accessor/paging.ts`、`field` の組み立ては `src/accessor/field-param.ts`（2026-09-26 に分けて `src/accessor/` へ移した・ADR-0101）

[adr96]: 0096-narrow-record-type-by-field.md
[adr97]: 0097-src-module-layout.md
[basic-design]: ../design/basic-design.md
