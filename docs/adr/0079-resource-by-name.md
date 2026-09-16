# 79. リソースの指定を名前に揃える（`Activity.P_Resource` / `Attachment.resource`）

- Status: proposed
- Date: 2026-09-16
- Deciders: jun.shiromoto (Joymerrevent)

> [ADR-0061][adr61] が `t.phase.of("client")` を名前にしたときに残した論点。
> 起票のみ（`proposed`）。実装は accept 後・別 PR。

## Context and Problem Statement

PORTERS は「どのリソースか」を**非連続な数値**で表す（Resource List）。

| 名前      | 値  | 名前      | 値  | 名前        | 値  |
| --------- | --- | --------- | --- | ----------- | --- |
| Candidate | 1   | Recruiter | 9   | Activity    | 19  |
| Job       | 3   | Sales     | 11  | Opportunity | 25  |
| Client    | 5   | Contract  | 13  | Contact     | 27  |
| Process   | 7   | Resume    | 17  |             |     |

**同じ概念を、ライブラリは 4 箇所で受けている。そのうち 2 つは名前、2 つは数値**（実測 2026-09-16）。

| 受け口                              | いまの型                        | 由来                   |
| ----------------------------------- | ------------------------------- | ---------------------- |
| `t.field.search({ resource })`      | **名前**（`ResourceName`）      | [ADR-0022][adr22]      |
| `t.phase.of(resource)`              | **名前**（`ResourceName`）      | [ADR-0061][adr61] 案5b |
| `t.activity.create({ P_Resource })` | **数値**（カタログの `Number`） | 汎用 factory の既定    |
| `t.attachment.create({ resource })` | **数値**（bespoke の `number`） | [ADR-0018][adr18]      |

**数値のままだと、間違いがコンパイルを通る。** `6` のような欠番も、`9`（Recruiter）と `11`（Sales）の
取り違えも、`number` 型には区別が付かない。ADR-0061 が名前を選んだ理由もそこだった。

**Attachment では、その間違いが取り返しの付かない形で残る。** 付け先（`resource` / `resourceId`）は
`update` で変えられず、**削除 API も無い**。利用者向けドキュメントにもそう書いてある。

> **`resource` は数値**です。型は `number` なので、間違った番号もコンパイルは通ります…
> しかも**付け先は `update` で変えられません**。間違えたら正しい先に作り直すことになり、
> **間違えたほうは消せません**（[添付ファイル][attachments]）。

**機構は揃っている。** 名前 → 数値の対応表（`RESOURCE_VALUES`）は既にあり、`field` と `phase` が
使っている。足りないのは**カタログ項目（`Activity.P_Resource`）の書き込み値の型を、項目単位で
差し替える仕掛け**だけ — [ADR-0061][adr61] が「機構が別」と書いて先送りしたところ。

問い: **どこまで名前で受けるか。読み側はどうするか。**

## Decision Drivers

- **綴りを機械が検査する**（[ADR-0059][adr59] が `field` で、[ADR-0061][adr61] が `of()` で立てた基準）。
- **取り返しの付かない間違いを型で止める**（Attachment は作り直しても消せない）。
- **語彙が 1 つであること**: 同じ「どのリソースか」を、ある場所では名前・ある場所では数値で書かせない。
- **逃げ道**: PORTERS が将来リソースを増やしたとき、型が古くても呼べること。
- **移行コスト**: 公開型が変わる（破壊的）。

## Considered Options

**軸1: どこまで名前にするか**

- 案1a: `Activity.P_Resource` だけ（ロードマップの元の論点）
- 案1b: **`Activity.P_Resource` ＋ `Attachment.resource`**（数値で受けている残り全部）
- 案1c: 何もしない（数値のまま・ドキュメントで注意する）

**軸2: 読み側をどうするか**

- 案2a: **読みは数値のまま**（書きだけ名前）
- 案2b: 読みも名前に畳む。表に無い値は数値のまま返す（`ResourceName | number`）
- 案2c: 読みも名前だけにし、表に無い値はエラー

**軸3: 逃げ道**

- 案3a: **型は名前だけ・`as` で数値も通る**（実行時は素通り — [ADR-0074][adr74] と同じ線）
- 案3b: 型で `ResourceName | number` の両方を許す

## Decision Outcome

**未決（`proposed`）。** 起案時点の推奨は **案1b ＋ 案2a ＋ 案3a**。

理由: 数値で受けている 2 箇所を同時に直せば、**このライブラリで「どのリソースか」を書く場所は
すべて名前**になる（軸1）。読みを数値のままにするのは、**応答は PORTERS が決める値**であって
ライブラリの語彙ではないから — 表に無い値が返ってきたときに `null` にも例外にもしたくない（軸2）。
逃げ道を型ではなく `as` に置くのは、**普通に書けば正しく、外したい人だけが外せる**形を保つため（軸3）。

### Consequences

- Good: 欠番（`6`）も取り違え（Recruiter 9 / Sales 11）もコンパイルで止まる。
- Good: Attachment の**取り返しの付かない間違い**が、型で止まるようになる。
- Good: `field` / `phase` / `activity` / `attachment` の語彙が 1 つになる。
- Bad: **破壊的変更**。`P_Resource: 1` / `resource: 1` と書いているコードは名前に直す。
- Bad: 汎用 factory に**項目単位で書き込み値の型を差し替える仕掛け**が増える
  （`Activity.P_Resource` はカタログ項目なので、Phase の `of()` のようには解けない）。
- Neutral: 読み（`P_Resource` / `resource`）は数値のまま ＝ **読みと書きで形が違う**。
  Option / User / System[Reference] と同じ非対称で、[alias と Data Type][aliases] に並べる。

## 信じている入力

| 値                       | 出どころ                 | 誰が書けるか | 守り方                                                                                   | 取れなかったら       | 誤っていたら                               |
| ------------------------ | ------------------------ | ------------ | ---------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------ |
| 名前 → 数値の対応表      | PORTERS の Resource List | PORTERS 社   | 仕組み（`RESOURCE_VALUES` は descriptor の `path` をキーに書いてある＝リネームで壊れる） | —                    | 表が増えたら型も増える（追加なので非破壊） |
| 呼び出し側が書く名前     | 人                       | —            | 仕組み（型）。`as` で数値も通る                                                          | 省略＝項目を送らない | 綴り違いはコンパイルで止まる               |
| 応答の `P_Resource` の値 | PORTERS の応答           | —            | 仕組みは無い（数値のまま返す）                                                           | 欠けていれば `null`  | 表に無い値でも壊れない（案2a の利点）      |

**PORTERS がリソースを増やす**のはありうる（Contact 27 は後から増えた）。そのとき型が古くても、
案3a なら `as` で呼べる — **止まるのは型だけで、実行時は塞がない**。

## Pros and Cons of the Options

### 案1b（Activity ＋ Attachment）

- Good: 数値で書く場所が無くなる。取り返しの付かない間違いを最も減らす。
- Bad: 破壊的変更が 2 箇所に及ぶ（ただし利用者の直し方は同じ）。

### 案1a（Activity だけ）

- Good: 変更が小さい。
- Bad: **Attachment のほうが痛い間違い**（消せない）なのに、そちらが数値のまま残る。

### 案1c（何もしない）

- Good: 何も壊さない。
- Bad: 「`of()` は名前・`P_Resource` は数値」の非対称が残り、説明し続けることになる。

### 案2a（読みは数値のまま）

- Good: 表に無い値が来ても壊れない。応答の値を作り替えない。
- Bad: 読みと書きで形が違う（ドキュメントで説明が要る）。

### 案2b（読みも名前・未知は数値）

- Good: 読みも書きも名前で扱える。
- Bad: 型が `ResourceName | number` になり、**どちらが来るかは実行時にしか分からない**。
  分岐を利用者に強いるわりに、得るものは表記の統一だけ。

### 案3a（型は名前・`as` で逃げる）

- Good: 普通に書けば正しい。逃げ道は残る。
- Bad: 逃げるときの書き方が `as` で、読みやすくはない。

### 案3b（`ResourceName | number` を型で許す）

- Good: 逃げ道が型の中にある。
- Bad: **数値がいつまでも正規の書き方として残る**ので、揃えた意味が薄れる。

## More Information

- 発端: [ロードマップ][roadmap]の「要 ADR」／ [ADR-0061][adr61] 案5b（`of()` を名前にしたときの残件）
- 前提: [ADR-0022][adr22]（`field.search` の `resource` が名前）／ [ADR-0018][adr18]（Attachment の
  bespoke な入力）／ [ADR-0059][adr59]（綴りを機械が検査する）／ [ADR-0074][adr74]（型で塞ぎ、
  実行時は寛容にした先例）
- 反映（accept 後・別 PR）: `src/resources/resource.ts`（項目単位の書き込み値の差し替え）、
  `src/resources/activity.ts`、`src/resources/attachment.ts`、co-located テスト、
  `docs/usage/howto/attachments.md`（「数値です」の警告が不要になる）、
  `docs/usage/concepts/aliases.md`（読みと書きの非対称に 1 行）、CHANGELOG（**Breaking**）

[adr61]: 0061-phase-resource-surface.md
[adr22]: 0022-master-read-query-surface.md
[adr18]: 0018-attachment-design.md
[adr59]: 0059-read-field-bare-alias.md
[adr74]: 0074-custom-field-declaration-required.md
[attachments]: ../usage/howto/attachments.md
[aliases]: ../usage/concepts/aliases.md
[roadmap]: ../roadmap.md
