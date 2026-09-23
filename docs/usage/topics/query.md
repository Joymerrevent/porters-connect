# 検索（`search` / `searchAll` とクエリ）

条件でレコードを探すときに読むページです。取る項目・参照先の項目・条件・並び順・キーワード・ページングを
どう書くかと、マスタ 5 種で指定できるものが違う理由が分かります。読み終えると、欲しいレコードを必要な項目だけで取り出せます。

## まず知ること

- **PORTERS の Read は `field` を指定しないと主キーしか返しません**。ライブラリは省略時に、知っている項目
  （標準項目と宣言済みのカスタム項目）を補って要求します。
- **`condition` に書ける演算子は項目の Data Type で決まります**（文字列に `part` / `full`、数値や日時に
  `ge` / `le` など）。型が合わないものはコンパイルエラーです<!-- 根拠: ADR-0038・ADR-0005 R-5（公開 API の形） -->。
- **1 ページは最大 200 件**です。全件が要るときは `searchAll` が 200 件刻みで辿ります。
- **削除済みのレコードは既定では返りません**。含めるかどうかは `itemstate` で選びます
  （[削除と削除済みデータ][deleted]）。
- **マスタ 5 種は指定できるものが違います**（`condition` と `get(id)` が無い）。このページの終わりにまとめてあります。

## 全体像

1 回の `search` に書ける要素をすべて載せた例です。それぞれの要素は、以降の節で説明します。

```ts
const page = await t.candidate.search({
  field: ["P_Id", "P_Name"], // 取得する項目（省略可）
  condition: { P_Name: { part: "山田" } }, // 検索条件（複数項目は AND）
  order: [{ P_UpdateDate: "desc" }], // 並び順
  keywords: ["東京", "営業"], // キーワード AND 検索
  itemstate: "existing", // 削除状態（省略可。省略との違いは後述）
  count: 50, // 1〜200・既定 10
  start: 0, // 0 始まり
});
// → { items, total, count, start }
```

全件を辿るなら `searchAll`（`count` / `start` は自分で持たず、200 件刻みで yield します）。

```ts
for await (const c of t.candidate.searchAll({
  condition: { P_Name: { part: "山田" } },
})) {
  console.log(c.P_Id, c.P_Name);
}
```

## `field` — 取得する項目

**省略が既定**です。PORTERS は `field` 未指定だと**主キーしか返さない**ため、
ライブラリが[知っている項目の一覧][aliases]から既定の field を補います<!-- 根拠: ADR-0020 -->。
3 通りの意味があります。

| 書き方         | 送られるもの                                                                 |
| -------------- | ---------------------------------------------------------------------------- |
| 省略           | **ライブラリが知っている全項目**（既定・型に定義されている項目が実際に返る） |
| `field: []`    | **主キーのみ**（API 本来の挙動。件数だけ欲しいときに）                       |
| `field: [...]` | 指定したものだけ                                                             |

alias は **`condition` / `order` と同じ素の名前**（接頭辞なし）で書きます。
接頭辞はリソースごとの定数なので**ライブラリが付けます**<!-- 根拠: ADR-0059 -->。

```ts
await t.candidate.search({ field: ["P_Id", "P_Name"] });
// → field=Person.P_Id,Person.P_Name を送る（Candidate の接頭辞は Person）

await t.candidate.search({ field: [] }); // total だけ見たい
```

**間違いはコンパイル時に止まります**。`field` が受け付けるのは**ライブラリが知っている alias** だけです
（標準 `P_` ＋ [`defineFields`][custom-fields] で宣言したカスタム項目）。

<!-- doccheck: expect-error -->

```ts
await t.candidate.search({ field: ["P_Nmae"] }); // ✗ 型エラー（綴り間違い）
await t.candidate.search({ field: ["Person.P_Name"] }); // ✗ 型エラー（接頭辞は書かない）
await t.candidate.search({ field: ["U_memo"] }); // ✗ 型エラー（宣言していないカスタム項目）
```

綴りを間違えた alias は PORTERS に送っても**黙って無視されるだけ**で、書いた時点では気づけませんでした。
型で検査することで、書いた時点で分かるようにしています。**カスタム項目も同じ扱い**で、宣言すれば `U_` 以降の
綴りまで検査されます<!-- 根拠: ADR-0074 -->。宣言せずに触る必要があるときの方法は
[カスタム項目][custom-fields]にあります。

> 取得しなかった項目は**キーごと存在しません**（`undefined`）。値が空なら `null` です。
> 型が `値 | null | undefined` になっているのはこのためです。

## `expand` — 参照先の項目も読む

`P_Client` や `P_Candidate` のような**参照型**（`System[Reference]`）の項目は、
既定では**参照先の ID** しか返りません。`expand` を書くと、参照先の項目そのものが返ります<!-- 根拠: ADR-0058 -->。

```ts
const page = await t.job.search({
  expand: { P_Client: ["P_Id", "P_Name"] },
});

page.items[0]?.P_Client; // { P_Id: number | null; P_Name: string | null } | null
```

書かなければ従来どおりです。**`expand` を書いた項目だけ**型が変わるので、
参照を ID として使っているコードは何も影響を受けません。

```ts
const plain = await t.job.search();
plain.items[0]?.P_Client; // number | null
```

- **参照先の接頭辞は書きません**。`condition` / `order` / `field` と同じく素の alias で指定し、
  ライブラリが `field=Job.P_Client(Client.P_Id,Client.P_Name)` を組み立てます。
  Candidate を参照するときの `Person.` もライブラリが付けます。
- `search` / `searchAll` / `get` で使えます（`get` は `get(id, { expand })`）。
- 1 回の呼び出しで済みます。参照先を別途 `client.get(id)` で引く必要はありません。

```ts
const p = await t.process.get(id, {
  expand: { P_Client: ["P_Name"], P_Candidate: ["P_Name", "P_Mail"] },
});
p?.P_Job; // 展開しなかった参照は ID のまま
```

**展開できる項目は決まっています**。参照先のリソースをライブラリが実装している必要があるためで、
書けないものは型エラーになります。

| リソース      | 展開できる                                                                       |
| ------------- | -------------------------------------------------------------------------------- |
| `job`         | `P_Client` / `P_Recruiter`                                                       |
| `client`      | —（参照型の項目を持ちません）                                                    |
| `recruiter`   | `P_Client`                                                                       |
| `contact`     | `P_Client`                                                                       |
| `opportunity` | `P_Client` / `P_Recruiter`                                                       |
| `contract`    | `P_Client`                                                                       |
| `sales`       | `P_Client` / `P_Recruiter` / `P_Job` / `P_Contract` / `P_Candidate` / `P_Resume` |
| `process`     | `P_Client` / `P_Recruiter` / `P_Job` / `P_Candidate` / `P_Resume`                |
| `resume`      | `P_Candidate`                                                                    |
| `phase`       | —（参照型の項目を持ちません）                                                    |

- **`Activity.P_ResourceId` は展開できません**。参照先が `P_Resource`（Resource List の数値 ID）で
  実行時に決まるため、どのリソースの項目として読むかを型では決められないからです。ID として読めるので、
  `P_Resource` を見て対応するアクセサから取得してください。
- **`Phase` は参照型の項目を持ちません**（`ResourceId` は `Number`）。対象リソースは `of(...)` で指定します。
- **カスタム項目（`U_` / `A_`）の参照型は対象外**です。ライブラリが知っている項目に載らないため展開できません
  （宣言できるようになるまでの穴です）<!-- 根拠: ADR-0023 -->。
- `field` に `"Job.P_Client(Client.P_Id)"` のような展開文字列を書くことはできません
  （型エラー。cast で通しても送信前に `PortersConfigError` で止まり、`expand` を案内します）。

> 参照先の入れ子の形と、`()` の中に付ける接頭辞は**実機で未確認**です<!-- 根拠: LV-10・LV-16 -->。
> 応答の解釈はタグ名に依存しない実装なので、
> 外れた場合に直すのは要求側の文字列だけです。

### ユーザー型は `expand` に書きません

`P_Owner` のような**ユーザー型**（Data Type は `User`）は、`field` に名前を書くだけで
**最初から入れ子**で返ります。括弧はライブラリが付けるので、書き方を覚える必要はありません。

```ts
const page = await t.job.search({ field: ["P_Position", "P_Owner"] });
const owner = page.items[0]?.P_Owner;
console.log(owner?.P_Id, owner?.P_Name, owner?.P_Mail);
```

送られるのはこの形です（`field` を省略したときの既定でも同じ形で要求されます）。

```text
field=Job.P_Position,Job.P_Owner(User.P_Id,User.P_Type,User.P_Name,User.P_Mail)
```

参照型との違いは 3 つです。

|          | ユーザー型（`P_Owner`）  | 参照型（`P_Client`）                |
| -------- | ------------------------ | ----------------------------------- |
| 既定     | **最初から入れ子**で返る | **ID だけ**返る                     |
| 書き方   | `field` に名前を書くだけ | `expand` に欲しい項目を書く         |
| 部分指定 | **できない**（4 つ固定） | できる（`["P_Id", "P_Name"]` など） |

**4 つ固定**は PORTERS の制約です（`User.P_Id` / `P_Type` / `P_Name` / `P_Mail` 以外は参照
できません — [Resource API 概要][rapi]）。`expand` に書こうとすると型エラーになります。

<!-- doccheck: expect-error -->

```ts
await t.job.search({ expand: { P_Owner: ["P_Id", "P_Name"] } }); // ✗ expand は参照型だけ
```

## `image` — 画像の中身も読む

`Image` 型の項目は、**素で要求すると `FileName` だけ**が返ります（PORTERS の既定）。
`ContentType` / `Content`（Base64 の本体）が要るときに `image` で明示します。

<!-- doccheck: fields -->

```ts
const page = await t.resume.search({
  image: { U_photo: ["FileName", "Content"] },
});
page.items[0]?.U_photo; // { FileName: string | null; Content: string | null }
```

- **選んだサブタグだけが戻り型に出ます**。書かなければ `{ FileName?, ContentType?, Content? }` のまま
  （どれも「要求していない」ので optional）。`expand` と同じく、**転送量と型の複雑さが増えるのは、要求した人だけ**です。
- **既定が軽いことが大事です**。1 件 2MB の画像を持つ項目を一覧で 200 件取ると、既定で本体まで
  返す設計なら 1 回の応答で数百 MB になります。だから既定は `FileName` のみに委ねています。
- `Content` が要るのはたいてい 1 件のときなので、`get(id, { image: … })` が素直です。
- `Image` 型の項目にしか書けません（`Link` 型やテキスト項目を書くと**コンパイルエラー**）。
- **`Image` は `condition` に使えません**（reference が明記）。`Link` は記載が無いため、
  安全側に倒して同じく対象外にしています（使えると分かれば緩めます）<!-- 根拠: LV-21 -->。

> `field` に括弧でサブタグを並べる記法（`U_photo(FileName,Content)`）は**実機で未確認**です<!-- 根拠: LV-20 -->。
> 応答は**返ってきたサブタグを読む**実装なので、
> 外れた場合に直すのは要求側の文字列だけです。

## `condition` — 検索条件

`{ 項目: { 演算子: 値 } }` の形で、**複数項目は AND** で結合されます。
使える演算子は**項目の Data Type ごとに決まっています**。

| Data Type                                                         | 演算子                                  | 値                                     |
| ----------------------------------------------------------------- | --------------------------------------- | -------------------------------------- |
| `System[Id]`                                                      | `eq` / `gt` / `ge` / `le` / `lt` / `or` | `number`（`or` は `number[]`）         |
| `Number`                                                          | `eq` / `gt` / `ge` / `le` / `lt`        | `number`                               |
| `Date` / `DateTime` / `Age` / `System[DateTime]`                  | `eq` / `gt` / `ge` / `le` / `lt`        | **ISO 8601 の文字列**                  |
| `SinglelineText` / `MultilineText` / `Mail` / `Telephone` / `URL` | `part`（部分一致）/ `full`（完全一致）  | `string`                               |
| `Option`                                                          | `or` / `and`                            | `string[]`（選択肢の alias）           |
| `User` / `System[Reference]`                                      | `eq` / `or` / `and`                     | `number`（`or` / `and` は `number[]`） |

```ts
await t.candidate.search({
  condition: {
    P_Name: { part: "山田" }, // テキストは部分一致
    P_UpdateDate: { ge: "2026-08-01T00:00:00Z" }, // ISO 8601（UTC）で渡す
    P_Owner: { or: [101, 102] }, // ユーザー型は ID
  },
});
```

**日時は ISO 8601（UTC `…Z`）で渡してください。** PORTERS 形式（`yyyy/mm/dd HH:MM:SS`）への変換は
ライブラリが行います。JST などの業務タイムゾーン変換は**利用側の責務**です<!-- 根拠: PRD R-10 -->。

### 上位リソースの絞り込み

上位階層の項目を直接 condition に使うことはできませんが、**紐づく ID の項目**でなら絞れます。

```ts
await t.resume.search({ condition: { P_Candidate: { eq: 10008 } } });
```

### リソース種別で絞る（`resourceValueOf`）

アクティビティのように「どのリソースに付いているか」を持つ項目は、**数値**で絞ります。
値は非連続（Candidate `1` / Job `3` / Client `5` / Recruiter `9` / Sales `11` …）で、
数値リテラルだと欠番や取り違えに気づけないので、**名前から引いてください**<!-- 根拠: ADR-0079 -->。

```ts
import { resourceNameOf, resourceValueOf } from "@joymerrevent/porters-connect";

const page = await t.activity.search({
  condition: { P_Resource: { eq: resourceValueOf("candidate") } },
});
resourceNameOf(page.items[0]?.P_Resource ?? 0); // "candidate" | … | number
```

`resourceNameOf` は**知らない数値をそのまま返します**。Resource List は PORTERS のもので増えるため、
知らない値をエラーにせずデータとして通します。

考え方は[項目と値のかたち][aliases]の「どのリソースか」の節にまとめてあります。

## `order` — 並び順

`[{ 項目: "asc" | "desc" }]` の配列で、**先頭から優先**されます。
並べ替えられるのは**数値・日時・System 系**だけで、テキストや Option を指定すると型エラーになります。

```ts
await t.job.search({
  order: [{ P_UpdateDate: "desc" }, { P_Id: "asc" }],
});
```

## `keywords` — キーワード検索

テキスト項目を横断する **AND 検索**です（OR はできません）。

```ts
await t.candidate.search({ keywords: ["東京", "営業"] });
```

- **カンマ込みで 100 文字まで**。超えると送信前に `PortersConfigError` になります。
- 電話番号はハイフンを除いた数字で照合されます。

## `itemstate` — 削除済みを含めるか

PORTERS に削除 API はありませんが、画面で消されたレコードは `itemstate` で読めます。
省略（PORTERS の既定に従う）と `"existing"`（生存のみを要求する）は別の意思表示で、`"deleted"` / `"all"` のときは
`condition` に使える項目と期間に制限があります。表と制約は[削除と削除済みデータ][deleted]にまとめてあります。

```ts
await t.candidate.search({
  itemstate: "deleted",
  condition: { P_UpdateDate: { ge: "2026-07-01T00:00:00Z" } },
});
```

## `count` / `start` — ページング

オフセット式です。`count` は **1〜200（既定 10）**、`start` は 0 始まり。

```ts
const page = await t.candidate.search({ count: 200, start: 0 });
page.total; // 条件に合う総件数
page.count; // 今回返った件数
page.start; // 今回の開始インデックス
```

全件が必要なら `searchAll` を使ってください（200 件刻みで自動的に辿り、
`total` に達するか空ページで停止します）。

## マスタは指定できるものが違う

Partition / User / Department / Field / Option の 5 つは**読み取り専用のマスタ**で、データ系リソースとは
指定できるものが別です。**`condition` と `get(id)` はありません** — 実 API が受けるクエリだけを
公開しているためです。

| アクセサ            | リソース           | メソッド                           | 主なクエリ                                    |
| ------------------- | ------------------ | ---------------------------------- | --------------------------------------------- |
| `porters.partition` | Partition          | `search` / `searchAll`             | `requestType`（1 = アクセス可能な一覧・既定） |
| `t.user`            | User               | `search` / `searchAll` / `current` | `requestType` / `userType` / `field`          |
| `t.department`      | Department（部署） | `search` / `searchAll`             | `field` だけ（絞り込みは無い）                |
| `t.field`           | Field（項目定義）  | `search` / `searchAll`             | `active`（先に `of("candidate")` で指定する） |
| `t.option`          | Option（選択肢）   | `search`                           | `alias` / `level` / `enabled`                 |

```ts
// アクセスできる Partition（Company DB）を探す。client 直下なので tenant() を通さない
const partitions = await porters.partition.search();

// 現在の API ユーザー（code_direct ではアプリ自身の User）＝自分が誰か
const me = await t.user.current();

// 部署マスタ（ユーザー部署型の項目や User.P_Department が指す先）。非表示の部署は P_Hidden で見分ける
const departments = await t.department.search();

// Job の項目定義（U_ / A_ のカスタム項目を含む）
const fields = await t.field.of("job").search();

// 選択肢マスタ。入れ子のツリーを深さ優先でフラットにして返す
const options = await t.option.search({ alias: "Option.P_Gender" });
```

- `t.option.search()` に `searchAll` はありません（API に `start` が無いため）。階層は
  `P_ParentId` / `P_Order` で復元します。
- `porters.partition.current()` は**提供していません**。`request_type=0` は既定の `code_direct`
  認証では 403 になるためです（[Partition とテナントスコープ][partition]）。

## 送信前にエラーになるもの

不透明なサーバーエラーになる前に、ライブラリが `PortersConfigError` で弾きます。

| 条件                                                                 | 検査 |
| -------------------------------------------------------------------- | ---- |
| `keywords` が 100 文字超                                             | ✅   |
| `itemstate` が `deleted` / `all` で許されない項目を condition に指定 | ✅   |
| リクエスト全体が約 15000 文字超（**URL + body**）                    | ✅   |
| `count` が 1〜200 の外（整数でない場合も）                           | ✅   |

## 関連

- 主題: [削除と削除済みデータ][deleted]（`itemstate` と `P_Deleted`）／[項目と値のかたち][aliases]（alias と読みのかたち）／
  [カスタム項目][custom-fields]（`U_` / `A_` を条件に使う）／[書き込み][write]
- リソース別: [リソースと操作][resources]（呼べるメソッドはリソースごとに違う）
- 実践例: [毎日の差分同期][sync-batch]（`P_UpdateDate` の条件で差分を取る）
- リファレンス: [Resource API 概要][rapi]（パラメータ表・condition の suffix 一覧）
- ほかの目的から探す: [目次][index]

<!-- 根拠:
- 決定: ADR-0038（Read クエリの詳細設計）／ADR-0020（`field` の既定挙動）／
  ADR-0059（`field` を接頭辞なしの型付き alias で受ける）／
  ADR-0058（`expand` で参照先の項目を読む）／
  ADR-0056（`P_Deleted` を「型を持たない項目」として載せる）／
  ADR-0057（`itemstate` の明示指定はそのまま送る）
-->

[aliases]: fields.md
[custom-fields]: custom-fields.md
[rapi]: ../reference/resource-api/README.md
[partition]: tenant.md
[index]: ../index.md
[deleted]: deleted.md
[write]: write.md
[resources]: ../resources/README.md
[sync-batch]: ../recipes/sync-batch.md
