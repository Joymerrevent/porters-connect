# 104. 宣言できない項目を宣言していたら、`verifyFields` の `ok` を倒す

- Status: accepted
- Date: 2026-09-26
- Deciders: jun.shiromoto (Joymerrevent)

> 起票元は `src` 全体のレビュー（2026-09-26）の [RV-80][rv80]。[ADR-0069][adr69] が決めた突合の区分に、
> 「テナントでは宣言できない型の項目を、宣言している」場合の決めが無く、その場合 `verifyFields` は `ok: true` を返す。
> ADR-0069 の区分の表を改めるので、この ADR で決める。
>
> **decider が案A を選択し `accepted`（2026-09-26）。** 実装は accept 後・別 PR。

## Context and Problem Statement

### いまの形（ADR-0069）

`verifyFields` は宣言とテナントの項目の一覧を突き合わせ、次の区分で報告する。`ok` は `missing`・`typeMismatch`・`unverifiable` が
すべて空のときだけ `true`。

| 区分           | 意味                             | `ok` を倒すか |
| -------------- | -------------------------------- | ------------- |
| `missing`      | 宣言したがテナントに無い         | 倒す          |
| `typeMismatch` | 実在するが Data Type が違う      | 倒す          |
| `unverifiable` | そのリソースの一覧を読めなかった | 倒す          |
| `undeclared`   | テナントにあるが宣言していない   | 倒さない      |
| `undeclarable` | テナントにあるが、宣言できない型 | 倒さない      |

### 何が起きるか

`undeclarable` は「テナントにある項目の情報」として載るだけで、**その項目を宣言しているかどうかを見ていない**。
宣言していても `missing` にしない（実在するため）だけで、ほかの区分にも入らない（`src/fields/verify-fields.ts`）。

実測（[RV-80][rv80]）: Field Read が Reference 型（`P_Type` 16）の `U_ref` を返すテナントで、`U_ref` を `f.number()` と
宣言すると、`ok: true`・`missing` 0・`typeMismatch` 0 だった。起動時の `assertFieldsMatch` も通る。

Reference 型は値を持たない（参照表示専用）ので、宣言どおりに読むと常に `null` になる。ADR-0069 が「最高」の深刻度とした
`typeMismatch`（黙って `null` になる側）と同じことが起きるのに、報告されない。

### 宣言できない理由（`src/fields/read-custom-catalog.ts`）

| 理由                 | 何                                      |
| -------------------- | --------------------------------------- |
| `no-data-type`       | Data Type を持たない（Reference など）  |
| `not-declarable`     | 宣言の対象外（System 系）               |
| `unknown-field-type` | 対応表に無い型（将来 PORTERS が足す型） |

### 問い

宣言できない項目を宣言していたとき、`verifyFields` はそれをどう報告し、`ok` を倒すか。

## Decision Drivers

- **黙って `null` になる経路を、起動時に気づけるようにする**（ADR-0069 の目的）。
- **偽の警報を出さない**: 正誤を判定できないもので `ok` を倒すと、警報全体が信用されなくなる（ADR-0069 の `unverifiable` と同じ考え）。
- **公開 API を壊さない**: 報告の型には足すだけにする。

## Considered Options

- **案A: 新しい区分 `declaredUndeclarable` を足し、理由が `no-data-type` / `not-declarable` のものは `ok` を倒す**。`unknown-field-type` は区分に載せるが `ok` は倒さない。
- 案B: `typeMismatch` に入れる。
- 案C: 新しい区分に載せるだけで、`ok` は倒さない。

## Decision Outcome

採用: **案A**（decider が 2026-09-26 に選択）。

- `no-data-type` と `not-declarable` は、どう宣言しても正しく読めないと分かっている。黙って `null` になるので `ok` を倒す。
- `unknown-field-type` は、ライブラリが型を知らないだけで、宣言が正しい可能性がある。正誤を判定できないので `ok` は倒さず、区分に載せて知らせる。
- 案B は、`typeMismatch` の要素が「テナントの Data Type（`actual`）」を持つ形なので、Data Type の無い項目を入れられない。

### 決めること（案A）

- `FieldVerification` に `declaredUndeclarable`（宣言しているが、テナントでは宣言できない項目）を足す。要素は、リソース・alias・宣言した Data Type・宣言できない理由。
- `ok` は、`missing`・`typeMismatch`・`unverifiable` に加えて、`declaredUndeclarable` のうち理由が `no-data-type` / `not-declarable` のものが空のときだけ `true`。
- `assertFieldsMatch` は `ok` に従う（`ok` が `false` なら投げ、メッセージに該当の項目を並べる）。
- 利用者向けの文書（カスタム項目のガイド）の区分の表に、新しい区分を足す。

### Consequences

- Good: 宣言できない項目の宣言に、起動時に気づける。
- Bad: 今まで `ok: true` だった宣言が `false` になりうる（利用者から見ると、今まで通っていた `assertFieldsMatch` が投げる）。宣言が誤っている場合だけなので、変更の種類は不具合の修正として扱う。
- Neutral: 報告の型に区分が 1 つ増える（足すだけ）。

## 信じている入力

| 値                   | 出どころ                 | 誰が書けるか   | 守り方                                            | 取れなかったら              | 誤っていたら                                             |
| -------------------- | ------------------------ | -------------- | ------------------------------------------------- | --------------------------- | -------------------------------------------------------- |
| 項目の型（`P_Type`） | PORTERS Field Read       | テナント管理者 | 仕組み: 対応表で理由を決める（ADR-0069 論点3・4） | 読めなければ `unverifiable` | 対応表に無い型は `unknown-field-type`（`ok` を倒さない） |
| 宣言                 | 利用者（`defineFields`） | 利用者         | 仕組み: `defineFields` の検査                     | —                           | 宣言の Data Type の検査は [RV-79][rv79] で扱う           |

## Pros and Cons of the Options

### 案A

- Good: 分かっている誤りだけで `ok` を倒し、分からないものは知らせるだけにできる。
- Bad: 公開の報告の型が 1 つ増える。

### 案B

- Good: 区分が増えない。
- Bad: 要素の形（`actual` の Data Type）に合わない。「型が違う」と「型が無い」が混ざる。

### 案C

- Good: 利用者から見た `ok` の意味が変わらない。
- Bad: 黙って `null` になる経路が、起動時の検査で止まらないまま残る。

## More Information

- 改める決定: [ADR-0069][adr69] の論点5（突合の区分）。accepted になったら、ADR-0069 に改めた旨の一行を足す（本文は書き換えない）。
- 関連: [RV-79][rv79]（宣言の Data Type の検査）、[RV-80][rv80]。

[adr69]: 0069-tenant-field-catalog-tooling.md
[rv79]: ../reviews/rv/0079-define-fields-data-type-unchecked.md
[rv80]: ../reviews/rv/0080-verify-fields-undeclarable-ok.md
