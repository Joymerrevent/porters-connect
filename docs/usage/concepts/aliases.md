# alias と Data Type

PORTERS の項目は**名前（alias）**と**型（Data Type）**の 2 つで決まります。ここが分かると、
読み書きで出てくる型のほとんどが説明できます。

## alias は 3 種類ある

| 接頭辞 | 何           | 誰が作るか         | このライブラリでの扱い                               |
| ------ | ------------ | ------------------ | ---------------------------------------------------- |
| `P_`   | 標準項目     | PORTERS            | **同梱の静的な型**（何もしなくても型が付く）         |
| `U_`   | カスタム項目 | テナントの利用者   | [`defineFields`][custom-fields] で宣言すると型が付く |
| `A_`   | カスタム項目 | アプリ（API 経由） | 同上                                                 |

`P_` はどのテナントでも同じなので、ライブラリがカタログを持っています（[ADR-0019][adr19]）。
`U_` / `A_` は**テナントごとに違う**ので、同梱できません。だから宣言する仕組みがあります
（[ADR-0004][adr4]）。

> **`U_` / `A_` は宣言しなくても動きます。** ただし型が付かず、`field` を明示しないと
> **要求すらされません**。詳しくは[カスタム項目][custom-fields]にあります。

## 接頭辞は書かない

PORTERS の wire 上では項目名が `Person.P_Name` のように**リソースの接頭辞つき**になります。
このライブラリでは**接頭辞を書きません**（[ADR-0059][adr59]）。ライブラリが付けます。

<!-- doccheck: expect-error -->

```ts
await t.candidate.search({ field: ["P_Name"] }); // OK
await t.candidate.search({ field: ["Person.P_Name"] }); // ✗ 型エラー
```

理由は 2 つあります。**接頭辞はリソース名と一致しないことがある**ので覚えられません。そして
綴りを間違えた alias は **PORTERS に送っても黙って無視されるだけ**で、実行しても気づけません。
型で受けると書いた時点で止まります。

一致しない例が実際にあります。

| リソース   | 接頭辞       | 注意                         |
| ---------- | ------------ | ---------------------------- |
| Candidate  | **`Person`** | リソース名と違う             |
| Phase      | **なし**     | `Id` / `Resource` のように裸 |
| Attachment | **なし**     | `FileName` のように裸        |
| その他     | リソース名   | `Job.P_Position` など        |

`field` / `condition` / `order` はすべて**同じ語彙（接頭辞なしの alias）**で書けます。

## Data Type が「値の形」を決める

PORTERS は項目ごとに **Field Type**（画面上の種類）を持ち、それが **Data Type**（値の形）に
対応します。このライブラリが型として扱うのは **Data Type** のほうです（[ADR-0016][adr16]）。

Field Type は 21 種ありますが、Data Type は 17 種に畳まれます。たとえば
`Option[Checkbox]` / `Option[Radiobutton]` / `Option[Dropdown]` の 3 つは、値の形としては
どれも `Option` です。`Currency` の Data Type は `Number` です。

読み書きで現れる代表的な形:

| Data Type           | 読むと                             | 書くとき                     |
| ------------------- | ---------------------------------- | ---------------------------- |
| `Number`            | `number`                           | `number`                     |
| `SinglelineText` 他 | `string`                           | `string`                     |
| `Option`            | **`string[]`**（選択された alias） | `string[]`                   |
| `DateTime` / `Date` | **ISO 8601**（[日時][datetime]）   | ISO 8601                     |
| `User`              | `{ P_Id, P_Type, P_Name, P_Mail }` | **`User.P_Id` だけ**（数値） |
| `System[Reference]` | 参照先の id（数値）                | **参照先の `P_Id` だけ**     |
| `Image`             | 要求したサブ項目だけ               | 3 つとも必須                 |
| `Link`              | Contact id ／ User ／ Department   | id だけ（数値）              |

**読みと書きで形が違う**のがこの API の癖です。`User` や参照は読むと入れ子で返り、書くときは
id だけを送ります。ライブラリはそれを型で分けています（`Candidate` と `CandidateUpdateInput` が
別の型なのはこのためです）。

`Option` が常に配列なのは、単一選択でも複数選択でも PORTERS が同じ形で返すからです
（[ADR-0017][adr17]）。選択が無ければ `null` です。

## 型が無い項目もある

PORTERS が Data Type を与えていない項目があります。reference で `ー` と書かれているもので、
今は `P_Deleted` だけです。変換の基準が無いので**生の文字列のまま返します**（[ADR-0056][adr56]）。

この項目は `field` でしか使えません（`condition` / `order` / 書き込みでは PORTERS が拒否します）。
型の上でもそうなっていて、書こうとするとコンパイルが通りません。

## alias はテナントと環境で変わる

PORTERS 自身が注意している点です。

> Alias は環境・テナント依存。本番と開発用テスト環境で項目・選択肢の Alias がズレると連携が壊れる
>
> — [gotchas][gotchas]（出典記事からの転記）

つまり**宣言した alias が今のテナントに実在するとは限りません**。宣言と実物を突き合わせる
手段があります（[`verifyFields`][custom-fields]）。ずれていると読み取りが黙って `null` を
返す形で壊れるので、ここは機械に確かめさせてください。

## 関連

- 決定: [ADR-0004][adr4]（`P_` は静的・`U_`/`A_` は宣言）／[ADR-0016][adr16]（Data Type の粒度）／
  [ADR-0017][adr17]（Option は常に配列）／[ADR-0019][adr19]（静的カタログ）／
  [ADR-0056][adr56]（型が無い項目）／[ADR-0059][adr59]（接頭辞を書かない）
- 手順: [カスタム項目][custom-fields]（宣言・生成・突合）／[検索][search-records]（`field` の書き方）
- API 事実: [Field Type / Data Type][fdt]（対応表）／[リソース一覧][res-list]（接頭辞の一覧）

[adr4]: ../../adr/0004-field-type-model.md
[adr16]: ../../adr/0016-field-type-granularity.md
[adr17]: ../../adr/0017-option-read-shape.md
[adr19]: ../../adr/0019-static-resource-types.md
[adr56]: ../../adr/0056-deleted-flag-typing.md
[adr59]: ../../adr/0059-read-field-bare-alias.md
[custom-fields]: ../howto/custom-fields.md
[datetime]: datetime.md
[fdt]: ../reference/resource-api/field-data-types.md
[gotchas]: ../reference/gotchas.md
[res-list]: ../reference/resource-api/resources-list.md
[search-records]: ../howto/search-records.md
