# 97. `src/resources/` の共通の仕組みを `core/` に分ける

- Status: proposed
- Date: 2026-09-25
- Deciders: jun.shiromoto (Joymerrevent)

> 起票元は stakeholder の問い（2026-09-25）:「`src/resources/*` が気になった。リソース本体とメソッドをフォルダで
> 分けるのはどうか」。[ADR-0095][adr95] の実装で `get-many.ts` を足したときに出た。
>
> [基本設計][basic-design] §2 のモジュール構成（`resources/` は 1 つのフォルダ）を改める案。公開 API と、import のパス以外の
> ファイルの中身は変えない。

## Context and Problem Statement

### いまの形

`src/resources/` はフォルダ 1 つで、テストを除いて 28 ファイル、隣のテストを合わせて 56 ファイルが並んでいる
（2026-09-25 時点）。中身は次のとおり:

| 種類                               | ファイル                                                                                                                                                                                                        | 数  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| リソース本体（アクセサ）           | データ系 13（candidate / job / client / recruiter / contact / opportunity / activity / contract / sales / process / resume / phase / attachment）、マスタ系 5（partition / user / field / option / department） | 18  |
| 共通の仕組み（メソッドの組み立て） | resource / read-core / query / expand / image / bulk-write / get-many                                                                                                                                           | 7   |
| PORTERS の定義表                   | resource-list（Resource List の番号）・field-type（Field Type と Data Type の対応）                                                                                                                             | 2   |
| バレル                             | index                                                                                                                                                                                                           | 1   |

一覧で見ても、どれがリソースでどれが仕組みかが名前からしか分からない。リソースを 1 種足すとき（[ADR-0060][adr60] の
「リソース 1 種＝1 PR」）に読むべきファイルと、触らなくてよいファイルの境目も見えない。

### 依存の向き（2026-09-25 に import を数えた）

- **共通の仕組み 7 ファイルは、お互いと `src` のほかのモジュール（`errors` / `http` / `xml` / `util`）だけを
  import している**。個別のリソースも定義表も読み込まない。
- リソース本体は共通の仕組みを import する。データ系のいくつかは、参照先の定義（`CLIENT_DESCRIPTOR` など）のために
  ほかのデータ系を import する。
- `resource-list` はデータ系 11 種の定義を import し、`field`（マスタ）・`phase`・`attachment` がそれを import する。
  つまり `resource-list` は「仕組み」ではなく、リソースの上に立つ表。
- `field-type` は `xml` だけを import し、`field`（マスタ）と `src/fields/` が使う。
- `src` の外からは、`test/fake/` と `test/integration/` が個別のファイルを直接 import している（約 60 行）。
  `src/fields/` も `field` / `field-type` / `read-core` を直接 import する。

### 移動で影響を受けないもの

- mutation テストの対象（`stryker.config.json` の `mutate`）は `src/**/*.ts` の glob なので、サブフォルダも含む。
- `scripts/`・`.github/` に `src/resources/` のパスを書いたものは無い。
- 公開 API は `src/index.ts` が `./resources`（バレル）から明示 export しているので、バレルが同じものを出せば変わらない。

### 問い

`src/resources/` をサブフォルダに分けるか。分けるなら、どの単位で分け、依存の向きをどう守るか。

## Decision Drivers

- **見て分かる**: リソース本体と共通の仕組みを、フォルダの時点で見分けられる。
- **依存の向きを仕組みで守る**: 分けたら「共通の仕組みは個別のリソースを import しない」を lint で止める。
  人の記憶に頼ると、フォルダを分けても境目が崩れる。
- **移動だけの PR にする**: ファイル名・公開 API と、import のパス以外の中身を変えない。テストがすべて通ることで、振る舞いが変わって
  いないと確かめられる形にする。
- **いまの依存の形に合わせる**: 分け方のために import を組み替えない。

## Considered Options

- **案A: 共通の仕組み 7 ファイルを `src/resources/core/` に移す。リソース本体・定義表・バレルは `src/resources/` に残す**（推奨）
- 案B: 案A に加えて、リソース本体を `data/`（データ系 13 ＋ resource-list）と `master/`（マスタ系 5 ＋ field-type）に分ける
- 案C: 分けない（いまのまま）

## Decision Outcome

**未決（proposed）**。以下は推奨案（案A）で書いた場合の形。

### 決めること（推奨案）

- `src/resources/core/` を作り、次の 7 ファイルと隣のテストを移す:
  `resource.ts` / `read-core.ts` / `query.ts` / `expand.ts` / `image.ts` / `bulk-write.ts` / `get-many.ts`。
  ファイル名は変えない（`core/read-core.ts` の重複した語も、移動だけの PR にするために残す）。
- `src/resources/core/index.ts` はバレル（[ADR-0013][adr13] の規則どおり `export *` / `export type *` だけ）。
  `src/resources/index.ts` はいまと同じ記号を出す。
- リソース本体 18 ファイル・`resource-list.ts`・`field-type.ts`・`index.ts` は `src/resources/` に残す。
- **依存の向きを eslint で止める**: `src/resources/core/**` から `src/resources/` 直下のファイル（リソース本体と
  定義表）を import したらエラーにする（`no-restricted-imports`）。
- `test/` と `src/fields/` の import は、移したファイルを指すものだけを書き換える。
- [基本設計][basic-design] §2 のモジュール構成に `resources/core/` を書き足す。
- 過去の ADR 本文にある `src/resources/resource.ts` などのパスは書き換えない。ADR README の「移設前のパス表記」に
  読み替えを 1 行足す（[ADR-0071][adr71] のときと同じ扱い）。

### 推奨案を採る理由

- **案A**: 問いの「リソース本体とメソッド（を組み立てる仕組み）を分ける」にそのまま答えている。共通の仕組み 7 ファイルは
  いまでも閉じた集まり（個別のリソースを import しない）なので、移しても依存の形は変わらず（変わるのは相対パスだけ）、境目を lint で
  止めるだけで済む。`src/resources/` 直下は 21 ファイル（テストを含めて約 41）、`core/` は 7 ファイル（約 14）になる。
- **案B** はさらに見やすいが、依存の向きが 1 本の規則にならない。`field`（マスタ）は `resource-list` を import し、
  `resource-list` はデータ系 11 種を import するので、`master/` → `data/` の依存が生まれる。「マスタはデータに
  依存しない」と書けず、例外つきの規則になる。フォルダをまたぐ import の書き換えも案A より多い。
- **案C** は何も変えないが、リソースを足すたびに 56 ファイルの一覧から仕組みを見分けることになる。

### Consequences

- Good: `src/resources/` を開いたときに、リソース本体と共通の仕組みがフォルダで分かれて見える。
- Good: 「共通の仕組みは個別のリソースを import しない」が lint で守られる。
- Bad: import の書き換えが出る（`src/resources/` の中、`src/fields/`、`test/` の約 60 行のうち移したファイルを
  指すもの）。`git log --follow` を使わないと、移したファイルの履歴がたどりにくくなる。
- Bad: 過去の ADR・レビュー記録にあるパスが古くなる（README の読み替えで補う）。
- Neutral: 公開 API・import のパス以外のファイルの中身・mutation テストの対象は変わらない。

## Pros and Cons of the Options

- 案A — Good: 問いに直接答える。依存の規則が 1 本（`core/` は直下を import しない）。移動が 7 ファイルで済む。
  Bad: 直下にはリソース本体 18 と定義表 2 が残り、データ系とマスタ系は見分けられない。
- 案B — Good: データ系とマスタ系も見分けられる。Bad: `master/` → `data/` の依存が生まれ、規則に例外が要る。移動と
  書き換えが多い。
- 案C — Good: 何も変えない。Bad: 仕組みとリソースが名前でしか見分けられない。

## More Information

- 実装（accepted 後・別 PR）: `git mv` で 7 ファイルと隣のテストを移す、import の書き換え、`core/index.ts`、eslint の
  `no-restricted-imports`、[基本設計][basic-design] §2、ADR README の読み替え。**移動と import のパスの書き換えだけ**にして、
  それ以外の中身は変えない。
- 順番: この ADR の実装を、[ADR-0096][adr96]（`field` で戻り値の型を絞る）の実装より先に行う。ADR-0096 は
  `resource.ts` / `read-core.ts` / `expand.ts` / `image.ts` を触るので、先に移しておくと移動と変更がぶつからない。

[adr13]: 0013-coding-conventions-class-vs-function.md
[adr60]: 0060-full-resource-coverage-direction.md
[adr71]: 0071-usage-docs-single-root.md
[adr95]: 0095-get-many-by-ids.md
[adr96]: 0096-narrow-record-type-by-field.md
[basic-design]: ../design/basic-design.md
