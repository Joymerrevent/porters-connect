# 80. URL パラメータのリソースは `of()` で束ねる（[ADR-0022][adr22] の Field の形を改訂）

- Status: accepted
- Date: 2026-09-16
- Deciders: jun.shiromoto (Joymerrevent)

> [ADR-0079][adr79]（項目の値は数値のまま）の議論から分かれた論点。あちらは**値の型**、
> こちらは**受け口の形**を決める。
>
> **decider が案A を選択し `accepted`（2026-09-16）。** 実装は accept 後・別 PR（0.18.0）。

## Context and Problem Statement

PORTERS が **`resource` を URL パラメータで要求する**エンドポイントは 3 つある。
ライブラリの受け口は、そのどれも形が違う（実測 2026-09-16）。

| エンドポイント   | 出典                  | ライブラリの受け口               | 形                                        |
| ---------------- | --------------------- | -------------------------------- | ----------------------------------------- |
| `/v1/phase`      | `resource` **必須 ●** | `t.phase.of("client")` が束ねる  | **`of()`**（[ADR-0061][adr61] 案2a）      |
| `/v1/field`      | `resource` **必須 ●** | `t.field.search({ resource })`   | **クエリの必須項目**（[ADR-0022][adr22]） |
| `/v1/attachment` | `resource` **必須 ●** | **受け口が無い**（送っていない） | —（[live-verification][lv] LV-24）        |

**安全性の差はない。** `t.field.search({})` は型エラーになるので、`resource` を忘れることは
どちらの形でもできない。違うのは**書き方**と、**同じ概念が 2 つの形で現れること**である。

**「リソースを指す」場所は 3 種類ある**（[ADR-0079][adr79] の棚卸しと合わせて洗い出した）。

1. **URL パラメータ**（`?resource=`）— 本 ADR の対象
2. **項目の値**（`Activity.P_Resource` / `Attachment.Resource` / `Field.P_ResourceType` /
   `Phase.Resource`）— [ADR-0079][adr79] が「宣言した Data Type どおり（数値）」と決めた
3. **ライブラリ自身の語彙**（`defineFields` のキー、`readCustomCatalog` の引数、アクセサ名、
   `ResourceName` 型）— PORTERS に送らないので、元から名前で一貫している

**`ResourceId` は 1 にも 2 にも入らない。** `Activity.P_ResourceId` / `Phase.ResourceId` は
「**どのレコードか**」であって「どのリソース種別か」ではない。混同しやすいので分けて扱う。

問い: **URL パラメータのリソースを、`of()` で束ねる形に揃えるか。**

## Decision Drivers

- **同じ概念を 1 つの形で書けること**（いまは `of()` とクエリ項目の 2 通り）。
- **性質に合わせること**: マスタ 4 種がフラットに揃っているのは**見た目**で、Field だけが
  PORTERS 側で必須の `resource` を持つという**性質の差**がある。どちらに合わせるか。
- **束ねたものが何回効くか**: Phase の `of()` は読みの `resource=` と書きの `Resource` 項目の
  **両方**を埋める。Field は読み取り専用なのでクエリパラメータ 1 つだけ。
- **移行コスト**: 公開型が変わる（破壊的）。
- **未確定を抱え込まないこと**: Attachment の受け口は [LV-24][lv] が決まるまで作れない。

## Considered Options

- 案A: **URL パラメータのリソースは `of()` で束ねる**（Field を `t.field.of(name).search()` に）
- 案B: 現状維持（Phase は `of()`、Field はクエリの必須項目）
- 案C: 逆に揃える（Phase をフラットにし、`t.phase.search({ resource })` にする）

## Decision Outcome

採用: **案A**（ライブラリが URL パラメータとして送るリソースは `of()` で束ねる）。

理由: 規則が「**ライブラリが URL パラメータとして送るリソースは `of()` で束ねる**」の 1 文になり、
マスタ 4 種の見た目が割れる理由も**性質の差**で説明できる（必須の `resource` を持つのは Field だけ）。

**Attachment はこの規則で自然に外れる。** 規則の基準が「**送っているかどうか**」なので、
いま送っていない Attachment は対象外のまま。[LV-24][lv] が「出典どおり必須」と確定して送るように
なった時点で、**自動的に規則の対象に入る**（そのとき改めて決め直す必要がない）。

[ADR-0079][adr79] と並べると、リソースの扱いは 3 行で言い切れる。

> - **URL パラメータのリソース** → `of()` で束ねる（**名前**）
> - **項目の値のリソース** → 宣言した Data Type どおり（**数値**）。名前で書くなら `resourceValueOf()`
> - **ライブラリ自身が指すリソース**（宣言・ツール・アクセサ） → **名前**（規則の外・PORTERS に触れない）

### 束ねた値は**権威**であり、上書きできない

`of()` は「このアクセサはどのリソースの話か」を決める。だから**束ねた値と矛盾する書き込みは
受け付けない** — 入力の型から外し、キャストで渡されたら `PortersConfigError` で弾く。

**いまの Phase はそうなっていない**（[RV-47][rv47]・実測 2026-09-16）。`Resource` は書き込み可能な
カタログ項目として入力型に残っており、実行時も `{ ...writeDefaults, ...item }` の順で
**呼び出し側が勝つ**。`t.phase.of("client")` から Job（`3`）の Phase が書けてしまう。
[ADR-0061][adr61] 案2a が約束したのは「忘れられない」で、「**矛盾させられない**」は未達だった。
本 ADR の実装でここも塞ぐ。

### Scope — 項目の値としてのリソースは対象にしない

規則は **URL パラメータのリソース**に効く。`Activity.P_Resource` のように**レコードごとに違う値**は
対象外で、[ADR-0079][adr79] のとおり項目の値（数値）のまま扱う。

理由は「**1 回の呼び出しで 1 つに決まるか**」。Phase / Attachment は決まる（PORTERS がパラメータで
要求している）。Activity は決まらない — 1 回の検索で**求職者のアクティビティと JOB のものが混ざる**のが
普通で、アクセサ単位で束ねる前提が成り立たない。`t.activity.of("candidate")` を作ると、
PORTERS に無い絞り込みをライブラリが発明することにもなる。

書式もその区別に沿っている。**接頭辞なしの `Resource`**（Phase / Attachment）は呼び出し全体の文脈で、
**`Activity.P_Resource`** はレコードのデータである。

### Consequences

- Good: 同じ概念が 1 つの形になる。`t.phase.of("client")` と `t.field.of("candidate")` が並ぶ。
- Good: 束ねれば使い回せる（`const f = t.field.of("candidate"); await f.search(); await f.searchAll();`）。
- Good: Attachment が確定したときに、**形を決め直さずに済む**。
- Bad: **破壊的変更**。`t.field.search({ resource })` を書いているコードは直す。
- Bad: マスタ 4 種の見た目が割れる（Field だけ `of()`）。理由は説明できるが、覚えることは増える。
- Neutral: `readCustomCatalog` / `generateFieldDecls` の**公開シグネチャは変わらない**
  （リソース名を受けるのは同じで、内部の呼び方だけ変わる）。
- Neutral: `of()` が効く**場所の数**はエンドポイントで違う — Phase は読みの `?resource=` と書きの
  `<Resource>` の **2 か所**、Field は読みのパラメータ **1 か所**、Attachment は確定すれば 2 か所。
  これは不揃いではなく、**PORTERS がその値を要求する場所の数**がそのまま出たもの。`of()` の意味を
  「このアクセサはどのリソースの話か。PORTERS がその値を要る所すべてに使う」と読めば、差は結果になる。

## 信じている入力

| 値                                    | 出どころ                  | 誰が書けるか | 守り方                                                                       | 取れなかったら | 誤っていたら                     |
| ------------------------------------- | ------------------------- | ------------ | ---------------------------------------------------------------------------- | -------------- | -------------------------------- |
| 「`resource` は必須」という出典の記載 | PORTERS の記事            | PORTERS 社   | 仕組み（[エンドポイント × 機能][coverage] 表 C が reference と両方向で突合） | —              | 記事が変われば表の検査が落ちる   |
| 束ねたリソース名                      | 呼び出し側（人）          | —            | 仕組み（`ResourceName` の型）                                                | 省略＝型エラー | 綴り違いはコンパイルで止まる     |
| Attachment が `resource` を要るか     | **未確認**（[LV-24][lv]） | —            | 散文。契約環境でしか分からない                                               | 送らないまま   | 確定したら規則が自動で適用される |

## Pros and Cons of the Options

### 案A（URL パラメータは `of()`）

- Good: 規則が 1 文。Attachment が確定したときに迷わない。
- Good: 束ねて使い回せる。
- Bad: 破壊的変更。マスタの見た目が割れる。

### 案B（現状維持）

- Good: 何も壊さない。マスタ 4 種の見た目が揃ったまま。
- Bad: 同じ概念が 2 つの形のまま残り、Attachment が確定したときに**どちらに寄せるかを改めて決める**
  ことになる。
- Bad: 「`of()` は Phase だけの特殊な形」という説明を続けることになる。

### 案C（Phase をフラットに戻す）

- Good: マスタもデータ系も同じフラットな形になる。
- Bad: [ADR-0061][adr61] 案2a の決定を覆す。**`resource` を忘れられない**という性質を、
  クエリの必須項目で代替することになる（型では同じでも、書き込み側の `Resource` 項目を
  埋める仕組みが失われる）。
- Bad: Phase は読み書き両方で `resource` を使うので、フラットにすると**書くたびに指定**することになる。

## More Information

- 発端: [ADR-0079][adr79] の議論（リソースの指定をどう受けるか）／ [ロードマップ][roadmap]
- 前提: [ADR-0022][adr22]（マスタ Read の公開サーフェス — **本 ADR は Field の形だけを改訂**し、
  Partition / User / Option の決定はそのまま。[ADR-0049][adr49] が [ADR-0048][adr48] の機構 2 だけを
  改訂した先例と同じ形）／ [ADR-0061][adr61] 案2a（`of()` の先例）
- 未確定: [LV-24][lv]（Attachment の `resource` は必須か）。確定すれば本 ADR の規則が自動で適用される
- 反映（accept 後・別 PR）: `src/resources/field.ts`（`of()` の追加と `FieldSearchQuery` から
  `resource` を外す）、`src/fields/tenant-catalog.ts`（内部呼び出し 1 箇所）、co-located テスト、
  `docs/usage/index.md` のメソッド表、`docs/usage/howto/custom-fields.md`、[ADR-0022][adr22] への
  改訂注記、CHANGELOG（**Breaking**）

[adr79]: 0079-resource-by-name.md
[adr22]: 0022-master-read-query-surface.md
[adr61]: 0061-phase-resource-surface.md
[adr48]: 0048-access-point-host-validation.md
[adr49]: 0049-host-port-roundtrip.md
[coverage]: ../design/endpoint-coverage.md
[lv]: ../live-verification.md
[rv47]: ../reviews/rv/0047-phase-binding-overridable.md
[roadmap]: ../roadmap.md
