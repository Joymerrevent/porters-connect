# 79. リソースの指定は数値のまま、名前との変換を公開する

- Status: accepted
- Date: 2026-09-16
- Deciders: jun.shiromoto (Joymerrevent)
- Implemented: 0.18.0

> [ADR-0061][adr61] が `t.phase.of("client")` を名前にしたときに残した論点。
>
> **decider が案1c ＋ 変換関数の公開を選択し `accepted`（2026-09-16）。** 実装は accept 後・別 PR。
>
> 起案時の推奨は「名前に揃える」だったが、**議論の中で退けた**。理由は Decision Outcome に書いた。

## Context and Problem Statement

PORTERS は「どのリソースか」を**非連続な数値**で表す（Resource List）。

| 名前      | 値  | 名前      | 値  | 名前        | 値  |
| --------- | --- | --------- | --- | ----------- | --- |
| Candidate | 1   | Recruiter | 9   | Activity    | 19  |
| Job       | 3   | Sales     | 11  | Opportunity | 25  |
| Client    | 5   | Contract  | 13  | Contact     | 27  |
| Process   | 7   | Resume    | 17  |             |     |

**同じ概念を、ライブラリは 4 箇所で受けている。そのうち 2 つは名前、2 つは数値**（実測 2026-09-16）。

| 受け口                              | いまの型                        | 何か                           |
| ----------------------------------- | ------------------------------- | ------------------------------ |
| `t.field.search({ resource })`      | **名前**（`ResourceName`）      | **パラメータ**（`?resource=`） |
| `t.phase.of(resource)`              | **名前**（`ResourceName`）      | **パラメータ**（`?resource=`） |
| `t.activity.create({ P_Resource })` | **数値**（カタログの `Number`） | **項目の値**                   |
| `t.attachment.create({ resource })` | **数値**（bespoke の `number`） | **項目の値**                   |

**数値のままだと、間違いがコンパイルを通る。** `6` のような欠番も、`9`（Recruiter）と `11`（Sales）の
取り違えも、`number` 型には区別が付かない。**Attachment ではその間違いが取り返しの付かない形で残る** —
付け先は `update` で変えられず、削除 API も無い（[添付ファイル][attachments]）。

問い: **項目の値も名前で受けるか。受けないなら、間違いをどう減らすか。**

## Decision Drivers

- **宣言が嘘をつかないこと**: このライブラリは「宣言してから使う・**宣言した Data Type どおりの値**に
  なる」で通してきた（[ADR-0004][adr4] / [ADR-0023][adr23] / [ADR-0074][adr74]）。
- **PORTERS に無い型を発明しないこと**（[ADR-0016][adr16] / [ADR-0060][adr60] D3 の型集合突合）。
- **綴りを機械が検査する**（[ADR-0059][adr59] / [ADR-0061][adr61] が立てた基準）。
- **取り返しの付かない間違いを減らす**（Attachment は作り直しても消せない）。
- **PORTERS の更新で利用者を止めないこと**: 値の集合は PORTERS が持っていて、増える。

## Considered Options

- 案1a: `Activity.P_Resource` だけ名前で受ける
- 案1b: `Activity.P_Resource` ＋ `Attachment.resource` を名前で受ける
- 案1c: **項目の値は数値のまま。名前 ⇄ 数値の変換関数を公開する**
- 案1d: 案1c ＋ **Resource List に無い値を送信前に弾く**

## Decision Outcome

採用: **案1c**。`Activity.P_Resource` と `Attachment.resource` は**数値のまま**にし、
**`resourceValueOf(name)` / `resourceNameOf(value)` を両方向とも公開する**。
`t.field.search({ resource })` と `t.phase.of()` は**名前のまま**変えない。

境界は 1 文で言える。

> **パラメータは名前で受ける。項目の値は、宣言した Data Type どおり（数値）。**

`field.search` / `phase.of` が受けるのは URL に載る**パラメータ**（`?resource=1`）で、Data Type を
持たない ＝ 突き合わせる宣言が無いので、名前にしても矛盾しない。`Activity.P_Resource` と
`Attachment.resource` は**項目の値**で、前者はカタログが `Number` と宣言している。

### なぜ「名前に揃える」を退けたか

起案時は名前を推し、decider も一度は選んだ。次の 3 点で覆した。

1. **宣言が嘘をつく。** カタログは `P_Resource: "Number"` と書いてある。そこへ名前を受ける特例を
   足すと、**宣言と実際の値の形が食い違う**。このライブラリの土台（宣言してから使う）と衝突する。
2. **カスタム項目と割れる。** テナントが自前で登録先を持つとき、宣言できるのは `Number` だけ
   （`defineFields({ activity: { U_target: "Number" } })`）。標準項目だけ名前にすると、
   **同じ「`Number` と宣言した項目」で挙動が割れる**。利用者はその非対称を選べない。
3. **一律の変換ではなく、項目単位の特例になる。** 日時（`DateTime` → ISO 8601）や Option
   （入れ子 → alias の配列）は **Data Type 単位の規則**で例外が無い。今回は「`Number` は数値。
   ただしこの 2 項目だけ名前」＝**規則ではなく特例**で、性質が違う。
   きちんと表すなら `"Resource"` のような Data Type が要るが、それは PORTERS に無く、
   D3 の型集合突合とも噛み合わない（`null` は「PORTERS が型を与えていない」**事実の記録**であって、
   ライブラリ発の型ではない）。

### なぜ「無い値を弾く」を採らなかったか（案1d）

**値の集合は PORTERS が持っていて、増える**（Contact `27` は後から増えた）。ライブラリが持つのは
その**スナップショット**なので、allowlist で弾くと「PORTERS が追加 → **ライブラリが追随するまで
利用者が使えない**」になる。塞いでいる側が悪い止め方で、未知の Result Code を捨てない
（[ADR-0044][adr44]）・未宣言の項目も実行時は素通り（[ADR-0074][adr74]）と同じ線に反する。

加えて、案1c の眼目は「この項目をただの `Number` に戻す」ことなので、**この項目だけ値の範囲を見る
ガード**を足すと、取り除いたはずの特例を別の形で持ち込むことになる（他の `Number` 項目は誰も
検証していない）。

### Consequences

- Good: 宣言（`Number`）と値の形が一致する。**カスタム項目と標準項目が同じ規則**で動く。
- Good: PORTERS に無い型を足さない。D3 の型集合突合もそのまま。
- Good: PORTERS がリソースを増やしても、利用者は**その日から**新しい番号を渡せる。
- Good: 名前で書きたい場面は関数で書ける。`condition` でもそのまま使える
  （`{ P_Resource: { eq: resourceValueOf("candidate") } }`）。
- Bad: **型では間違いを止められない**。`P_Resource: 6` も `resource: 9`（Recruiter のつもりで
  Sales）もコンパイルを通る。Attachment では取り返しが付かないままになる。
- Neutral: 「どのリソースか」を書く場所が、パラメータ（名前）と項目の値（数値）で分かれる。
  上の 1 文の規則をドキュメントに書いて説明する。

**Bad をどう埋めるか**: 型でもガードでもなく**書き方**で埋める。利用者向けドキュメントの例を
すべて `resourceValueOf("candidate")` にし、素の数値リテラルを例示しない。添付ファイルのページには
「間違えると消せない」という既存の警告を残す。

## 信じている入力

| 値                       | 出どころ                 | 誰が書けるか | 守り方                                                                             | 取れなかったら       | 誤っていたら                  |
| ------------------------ | ------------------------ | ------------ | ---------------------------------------------------------------------------------- | -------------------- | ----------------------------- |
| 名前 → 数値の対応表      | PORTERS の Resource List | PORTERS 社   | 仕組み（`RESOURCE_VALUES` は descriptor の `path` をキーに書く＝リネームで壊れる） | —                    | 表が増えたら足す（非破壊）    |
| 呼び出し側が書く数値     | 人                       | —            | **仕組みは無い**（散文＝ドキュメントの書き方で誘導する）                           | 省略＝項目を送らない | PORTERS が Result Code で返す |
| 応答の `P_Resource` の値 | PORTERS の応答           | —            | 仕組みは無い（数値のまま返す）                                                     | 欠けていれば `null`  | 表に無い値でも壊れない        |

**「守り方が散文だけ」の行が 1 つ残る**のは、この決定が引き受けたものである。機械で守るには
allowlist か独自 Data Type が要り、どちらも上記の理由で採らなかった。

## Pros and Cons of the Options

### 案1c（数値のまま ＋ 変換関数）

- Good: 宣言と一致。カスタム項目と同じ規則。新しい型が要らない。PORTERS の更新で止まらない。
- Good: 実装が小さい（関数 2 つの公開と、公開 API への追加）。
- Bad: 型では間違いを止められない。関数を使うかは利用者次第。

### 案1b（Activity ＋ Attachment を名前に）

- Good: 欠番も取り違えもコンパイルで止まる。取り返しの付かない間違いを型で防げる。
- Bad: 宣言（`Number`）と値の形が食い違う。カスタム項目は同じにできない。
- Bad: 項目単位の特例が増え、`condition` は数値のままなので**同じ項目で語彙が割れる**。

### 案1a（Activity だけ）

- Good: 変更が小さい。
- Bad: 1b の欠点をそのまま抱えたうえ、**痛い間違いが起きる Attachment が数値のまま残る**。

### 案1d（1c ＋ 無い値を弾く）

- Good: 欠番（`6`）は送信前に止まる。
- Bad: **PORTERS が増やした番号も止まる**。ライブラリが追随するまで利用者が使えない。
- Bad: 取り除いたはずの「項目単位の特例」を、ガードという別の形で持ち込む。

## More Information

- 発端: [ロードマップ][roadmap]の「要 ADR」／ [ADR-0061][adr61] 案5b（`of()` を名前にしたときの残件）
- 前提: [ADR-0022][adr22]（`field.search` の `resource` が名前）／ [ADR-0018][adr18]（Attachment の
  bespoke な入力）／ [ADR-0004][adr4]・[ADR-0023][adr23]・[ADR-0074][adr74]（宣言してから使う）／
  [ADR-0016][adr16]・[ADR-0060][adr60] D3（Data Type の集合は PORTERS と一致）／
  [ADR-0044][adr44]（未知の値を捨てない）
- 反映（accept 後・別 PR）: `src/resources/resource-list.ts`（`resourceValueOf` / `resourceNameOf`）、
  `src/index.ts`（公開）、co-located テスト、`docs/usage/howto/attachments.md` と
  `docs/usage/concepts/aliases.md`（**パラメータは名前・項目の値は数値**という規則と、
  例を関数で書く形に）、CHANGELOG（minor・**追加のみ**）

## パスの注記

<!-- 決定の本文は書き換えない。本文に書いたパスが移ったり名前が変わったりしたら、ここに今の場所を足す。 -->

本文に書いたパスのうち、あとで移したもの・名前を変えたものの今の場所（本文は決定したときのまま）:

- `src/resources/resource-list.ts` → `src/porters/resource-list.ts`（2026-09-25・ADR-0098）
- `docs/usage/howto/attachments.md` → `docs/usage/resources/attachment.md`（2026-09-23・ADR-0088）
- `docs/usage/concepts/aliases.md` → `docs/usage/topics/fields.md`（2026-09-23・ADR-0088）

[adr61]: 0061-phase-resource-surface.md
[adr22]: 0022-master-read-query-surface.md
[adr18]: 0018-attachment-design.md
[adr59]: 0059-read-field-bare-alias.md
[adr74]: 0074-custom-field-declaration-required.md
[adr23]: 0023-custom-field-declaration-dsl.md
[adr4]: 0004-field-type-model.md
[adr16]: 0016-field-type-granularity.md
[adr44]: 0044-http-status-handling.md
[adr60]: 0060-full-resource-coverage-direction.md
[attachments]: ../usage/resources/attachment.md
[roadmap]: ../roadmap.md
