# 項目と値のかたち（alias と Data Type）

検索や書き込みで、返ってきた値や渡す値のかたちに戸惑ったときに読むページです。項目の**名前（alias）** と
**型（Data Type）** が値のかたちをどう決めているかが分かり、なぜ読みと書きでかたちが違うのか、なぜ接頭辞を書かないのかを
説明できるようになります。

## まず知ること

- **alias は 3 種類**です。標準項目 `P_` はライブラリが型を同梱し、カスタム項目 `U_` / `A_` は `defineFields` で宣言すると型が付きます。
- **接頭辞は書きません。** PORTERS との通信では `Person.P_Name` ですが、書くのは `P_Name` だけで、接頭辞はライブラリが付けます。
- **Data Type が値のかたちを決めます。** 選択肢は常に配列、ユーザー型は読むと入れ子、参照型は既定では参照先の id（`expand` で参照先の項目も読める）で、書くときはどちらも id だけです。
- **型が無い項目もあります**（`P_Deleted`）。生の文字列のまま返します。
- **alias はテナントと環境で変わります。** カスタム項目は本番と開発環境でずれることがあり、突き合わせる道具があります。

## alias は 3 種類ある

接頭辞で、誰が作った項目かと、このライブラリでどう型が付くかが決まります。

| 接頭辞 | 何           | 誰が作るか         | このライブラリでの扱い                                             |
| ------ | ------------ | ------------------ | ------------------------------------------------------------------ |
| `P_`   | 標準項目     | PORTERS            | **ライブラリがあらかじめ型を持っている**（何もしなくても型が付く） |
| `U_`   | カスタム項目 | テナントの利用者   | [`defineFields`][custom-fields] で宣言すると型が付く               |
| `A_`   | カスタム項目 | アプリ（API 経由） | 同上                                                               |

`P_` はどのテナントでも同じなので、**ライブラリが項目の一覧を持っています**<!-- 根拠: ADR-0019 -->。
リソースごとに、alias と Data Type が載っています。型が付くのも、`field` を省略したときに項目が返るのも、これが元になっています。

`U_` / `A_` は**テナントごとに違う**ので、ライブラリがあらかじめ型を持つことはできません。だから宣言する仕組みがあります<!-- 根拠: ADR-0004 -->。
**宣言したものが、ライブラリが知っている項目に加わる**、という関係です。

> **`U_` / `A_` は宣言してから使います。** 宣言していない alias は `field` / `condition` /
> `order` / 書き込みのどこに書いても型エラーです<!-- 根拠: ADR-0074 -->。実行時は検査しないので、
> cast（`as`）で型を外せば呼べます。詳しくは[カスタム項目][custom-fields]にあります。

## 接頭辞は書かない

PORTERS との通信（送る URL や XML）では項目名が `Person.P_Name` のように**リソースの接頭辞つき**になります。
このライブラリでは**接頭辞を書きません**<!-- 根拠: ADR-0059 -->。ライブラリが付けます。

<!-- doccheck: expect-error -->

```ts
await t.candidate.search({ field: ["P_Name"] }); // OK
await t.candidate.search({ field: ["Person.P_Name"] }); // ✗ 型エラー
```

理由は 2 つあります。**接頭辞はリソース名と一致しないことがある**ので覚えられません。そして
綴りを間違えた alias は **PORTERS に送っても黙って無視されるだけ**で、実行しても気づけません。
型で検査すると、書いた時点で止まります。

一致しない例が実際にあります。

| リソース   | 接頭辞       | 注意                                 |
| ---------- | ------------ | ------------------------------------ |
| Candidate  | **`Person`** | リソース名と違う                     |
| Phase      | **なし**     | `Id` / `Resource` のように接頭辞なし |
| Attachment | **なし**     | `FileName` のように接頭辞なし        |
| その他     | リソース名   | `Job.P_Position` など                |

`field` / `condition` / `order` はすべて**同じ書き方（接頭辞なしの alias）** で書けます。

## Data Type が「値のかたち」を決める

PORTERS は項目ごとに **Field Type**（画面上の種類）を持ち、それが **Data Type**（値のかたち）に
対応します。このライブラリが型として扱うのは **Data Type** のほうです<!-- 根拠: ADR-0016 -->。

Field Type は 21 種ありますが、Data Type は 17 種にまとまります。たとえば
`Option[Checkbox]` / `Option[Radiobutton]` / `Option[Dropdown]` の 3 つは、値のかたちとしては
どれも `Option` です。`Currency` の Data Type は `Number` です。

読み書きで現れる代表的な形:

| Data Type           | 読むと                             | 書くとき                                               |
| ------------------- | ---------------------------------- | ------------------------------------------------------ |
| `Number`            | `number`                           | `number`                                               |
| `SinglelineText` 他 | `string`                           | `string`                                               |
| `Option`            | **`string[]`**（選択された alias） | `string[]`                                             |
| `DateTime` / `Date` | **ISO 8601**（[日時][datetime]）   | ISO 8601                                               |
| `User`              | `{ P_Id, P_Type, P_Name, P_Mail }` | **`User.P_Id` だけ**（数値）                           |
| `System[Reference]` | 参照先の id（数値）                | **参照先の `P_Id` だけ**                               |
| `Image`             | 要求したサブ項目だけ               | `FileName` / `ContentType` / `Content` の 3 つとも必須 |
| `Link`              | Contact id ／ User ／ Department   | 参照先の id だけ（数値）                               |

**読みと書きでかたちが違う**のが PORTERS Connect API の性質です。`User` は読むと入れ子で返り、参照は既定では参照先の id で返り
（`expand` で入れ子にできる）、書くときはどちらも id だけを送ります。ライブラリはそれを型で分けています（`Candidate` と `CandidateUpdateInput` が
別の型なのはこのためです）。

`Option` が常に配列なのは、単一選択でも複数選択でも PORTERS が同じ形で返すからです<!-- 根拠: ADR-0017 -->。
選択が無ければ `null` です。

## 「どのリソースか」は 2 通りで現れる

PORTERS は「どのリソースか」を**非連続な数値**で表します（Candidate `1` / Job `3` / Client `5` /
Process `7` / Recruiter `9` / Sales `11` / Contract `13` / Resume `17` / Activity `19` /
Opportunity `25` / Contact `27`）。この値は**2 つの場所**で出てきて、ライブラリでの書き方が違います。

| どこに現れるか                                 | 例                                            | ライブラリ                                  |
| ---------------------------------------------- | --------------------------------------------- | ------------------------------------------- |
| **呼び出し全体**が何の話か（URL パラメータ）   | Phase / Field / Attachment の `resource=`     | **名前で指定する** — `t.phase.of("client")` |
| **そのレコード**が何に付いているか（項目の値） | `Activity.P_Resource`、`Field.P_ResourceType` | **数値**（宣言した Data Type どおり）       |

分かれ目は「**1 回の呼び出しで 1 つに決まるか**」です。Phase の履歴は「どのリソースのものか」を
決めてから読みますが、アクティビティの一覧は**求職者のものと JOB のものが混ざる**のが普通なので、
レコードごとの値になります。

**数値を書く／読むときは、変換関数を使ってください**<!-- 根拠: ADR-0079 -->。欠番（`6`）や
取り違え（Recruiter `9` と Sales `11`）は数値をそのまま書くと気づけません。

```ts
import { resourceNameOf, resourceValueOf } from "@joymerrevent/porters-connect";

await t.activity.create({
  P_Owner: 5,
  P_Title: "一次面談",
  P_Resource: resourceValueOf("candidate"), // 1
  P_ResourceId: 10001,
});

const found = await t.activity.search({
  condition: { P_Resource: { eq: resourceValueOf("candidate") } },
});
resourceNameOf(found.items[0]?.P_Resource ?? 0); // "candidate" | … | number
```

`resourceNameOf` は、**知らない数値をそのまま返します**。Resource List は PORTERS のもので増える
ので（Contact `27` は後から増えました）、知らない値はデータとして通します。

## 型が無い項目もある

PORTERS が Data Type を与えていない項目があります。reference で `ー` と書かれているもので、
今は `P_Deleted` だけです。変換の基準が無いので**生の文字列のまま返します**<!-- 根拠: ADR-0056 -->。

この項目は `field` でしか使えません（`condition` / `order` / 書き込みでは PORTERS が拒否します）。
型の上でもそうなっていて、書こうとするとコンパイルが通りません。

## alias はテナントと環境で変わる

PORTERS 自身が注意している点です。

> Alias は環境・テナント依存。本番と開発用テスト環境で項目・選択肢の Alias がズレると連携が壊れる
>
> — [gotchas][gotchas]（出典記事からの転記）

つまり**宣言した alias が今のテナントに実在するとは限りません**。宣言と実際の項目を突き合わせる
手段があります（[`verifyFields`][custom-fields]）。Data Type がずれていると読み取りは
`PortersResourceError`（`category: "validation"`）になります（形の違い、または日時・数値に
読めない値）。エラーにならないずれ方（`Number` の項目を `SinglelineText` と宣言した、など）は値が
文字列のまま入るだけで気づけません。ここは `verifyFields` で確かめてください。

## 関連

- 主題: [カスタム項目][custom-fields]（宣言・生成・突き合わせ）／[検索][search-records]（`field` の書き方）／[書き込み][write]（書くときのかたち）／
  [日時と時分型][datetime]／[削除と削除済みデータ][deleted]（`P_Deleted`）
- リソース別: [User][r-user]／[Department][r-department]（参照値のかたち）／[Option][r-option]（選択肢の alias）
- リファレンス: [Field Type / Data Type][fdt]（対応表）／[リソース一覧][res-list]（接頭辞の一覧）
- ほかの目的から探す: [目次][index]

<!-- 根拠:
- 決定: ADR-0004（`P_` はライブラリが型を持ち、`U_`/`A_` は宣言する）／ADR-0016（Data Type の粒度）／
  ADR-0017（Option は常に配列）／ADR-0019（標準項目の一覧を同梱）／
  ADR-0056（型が無い項目）／ADR-0059（接頭辞を書かない）
-->

[custom-fields]: custom-fields.md
[datetime]: datetime.md
[fdt]: ../reference/resource-api/field-data-types.md
[gotchas]: ../reference/gotchas.md
[res-list]: ../reference/resource-api/resources-list.md
[search-records]: query.md
[index]: ../index.md
[write]: write.md
[deleted]: deleted.md
[r-user]: ../resources/user.md
[r-department]: ../resources/department.md
[r-option]: ../resources/option.md
