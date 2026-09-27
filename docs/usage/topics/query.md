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
- **ID が分かっているなら `get` / `getMany` で読みます**（ページの後半）。
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

全件を辿るなら `searchAll`（`count` / `start` は指定せず、200 件ずつ順に返します）。

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
| `field: []`    | **主キーのみ**（PORTERS 本来の挙動。件数だけ欲しいときに）                   |
| `field: [...]` | 指定したものだけ                                                             |

alias は **`condition` / `order` と同じく、接頭辞を付けない名前**で書きます。
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

綴りを間違えた alias は PORTERS に送っても**黙って無視されるだけ**で、書いた時点では気づけません。
型で検査することで、書いた時点で分かるようにしています。**カスタム項目も同じ扱い**で、宣言すれば `U_` 以降の
綴りまで検査されます<!-- 根拠: ADR-0074 -->。宣言せずに使う必要があるときの方法は
[カスタム項目][custom-fields]にあります。

<!-- 根拠: ADR-0096 -->

**戻り値の型は、要求した項目だけを持ちます**。要求した項目とは、`field` に書いた項目と、`expand` / `image` で
選んだ項目です（`get` / `getMany` では ID も）。読んでいない項目に触ると型エラーになるので、`field` に足し忘れた
項目にコンパイル時に気づけます。

```ts
const page = await t.candidate.search({ field: ["P_Name"] });
const name = page.items[0]?.P_Name; // string | null | undefined
```

<!-- doccheck: expect-error -->

```ts
const page = await t.candidate.search({ field: ["P_Name"] });
page.items[0]?.P_Mail; // ✗ 型エラー（読んでいない項目）
```

- `field` を省略したとき、または中身をコンパイラが読めない配列（`string[]` の変数など）を渡したときは、知っている
  項目すべてを持つ型になります。
- `search` / `searchAll` に `field: []` を渡すと、項目を 1 つも持たない型になります（件数だけを見るとき）。このとき `expand` / `image` も送られません（足す先の `field` が無いため）。
- 読んだ項目も、値が空なら `null`、PORTERS が返さなければキーごと無い（`undefined`）ので、型は
  `値 | null | undefined` です。
- 型に無い項目を読む必要があるときは [`rawValue`][f-rawValue] を使います。

## `expand` — 参照先の項目も読む

`P_Client` や `P_Candidate` のような**参照型**（`System[Reference]`）の項目は、
既定では**参照先の ID** しか返りません。`expand` を書くと、参照先の項目そのものが返ります<!-- 根拠: ADR-0058 -->。

```ts
const page = await t.job.search({
  expand: { P_Client: ["P_Id", "P_Name"] },
});

page.items[0]?.P_Client; // { P_Id: number | null; P_Name: string | null } | null
```

書かなければ、参照先の ID だけが返ります。**`expand` を書いた項目だけ**型が変わるので、
参照を ID として使っているコードは何も影響を受けません。

```ts
const plain = await t.job.search();
plain.items[0]?.P_Client; // number | null
```

- **参照先の接頭辞は書きません**。`condition` / `order` / `field` と同じく接頭辞なしの alias で指定し、
  ライブラリが `field=Job.P_Client(Client.P_Id,Client.P_Name)` を組み立てます。
  Candidate を参照するときの `Person.` もライブラリが付けます。
- `search` / `searchAll` / `get` / `getMany` で使えます（`get` は `get(id, { expand })`、`getMany` は `getMany(ids, { expand })`）。
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
  （宣言できるようになるまでの制限です）<!-- 根拠: ADR-0023 -->。
- `field` に `"Job.P_Client(Client.P_Id)"` のような展開文字列を書くことはできません
  （型エラー。cast（`as`）で通しても送信前に `PortersConfigError` で止まり、`expand` を案内します）。

> 参照先の入れ子の形と、`()` の中に付ける接頭辞は**実機で未確認**です<!-- 根拠: LV-10・LV-16 -->。
> 応答の解釈はタグ名に依存しない実装なので、
> 想定と違っていた場合に直すのはライブラリが送る要求の文字列だけで、利用側のコードは変わりません。

### ユーザー型は `expand` に書きません

`P_Owner` のような**ユーザー型**（Data Type は `User`）は、`field` に名前を書くだけで
**最初から入れ子**で返ります。括弧はライブラリが付けるので、書き方を覚える必要はありません。

```ts
const page = await t.job.search({ field: ["P_Position", "P_Owner"] });
const owner = page.items[0]?.P_Owner;
console.log(owner?.P_Id, owner?.P_Name, owner?.P_Mail);
```

PORTERS に送られる要求は、上のコードのとおりです（`field` を省略したときの既定でも同じ形で要求されます）。

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

`Image` 型の項目は、**そのまま要求すると `FileName` だけ**が返ります（PORTERS の既定）。
`ContentType` / `Content`（Base64 の本体）が要るときに `image` で明示します。

<!-- doccheck: fields -->

```ts
const page = await t.resume.search({
  image: { U_photo: ["FileName", "Content"] },
});
page.items[0]?.U_photo; // { FileName: string | null; Content: string | null }
```

- **選んだサブタグだけが戻り型に出ます**。書かなければ `{ FileName?, ContentType?, Content? }` のまま
  （どれも「要求していない」ので optional）。`expand` と同じく、**転送量と型の複雑さが増えるのは、要求したときだけ**です。
- **既定が軽いことが大事です**。1 件 2MB の画像を持つ項目を一覧で 200 件取ると、既定で本体まで
  返す設計なら 1 回の応答で数百 MB になります。だから既定は `FileName` のみにしています。
- `Content` が要るのはたいてい 1 件のときなので、`get(id, { image: … })` が簡単です。
- `Image` 型の項目にしか書けません（`Link` 型やテキスト項目を書くと**コンパイルエラー**）。
- **`Image` は `condition` に使えません**（PORTERS のリファレンスに明記されています）。`Link` は記載が無いため、
  安全側に倒して同じく対象外にしています（使えると分かれば緩めます）<!-- 根拠: LV-21 -->。

> `field` に括弧でサブタグを並べる記法（`U_photo(FileName,Content)`）は**実機で未確認**です<!-- 根拠: LV-20 -->。
> 応答は**返ってきたサブタグを読む**実装なので、
> 想定と違っていた場合に直すのはライブラリが送る要求の文字列だけで、利用側のコードは変わりません。

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

### カンマを含む値では検索できません

<!-- 根拠: ADR-0105 -->

PORTERS は条件どうしをカンマで、`or` / `and` の値どうしをコロンで区切り、値の中にそれらを書く方法を用意していません。
そのため次の値は、送る前に `PortersConfigError` になります（そのまま送ると、値の途中から別の条件として読まれるためです）。

- 条件の値に**カンマ**が入っているもの（例 `P_Name: { part: "株式会社A,B" }`）
- `or` / `and` の値の 1 つに**カンマかコロン**が入っているもの
- `or` / `and` に**空の配列**を渡したもの

カンマを含む値で探したいときは、カンマを含まない部分で検索し、結果を手元で絞ってください。
テキストや日時の値の**コロン**は、ライブラリは拒否しません（`P_Name: { part: "12:00" }` など）。

### 上位リソースの絞り込み

親にあたるリソース（Resume なら Candidate）の項目を直接 condition に使うことはできませんが、**紐づく ID の項目**でなら絞れます。

```ts
await t.resume.search({ condition: { P_Candidate: { eq: 10008 } } });
```

### リソース種別で絞る（`resourceValueOf`）

アクティビティのように「どのリソースに付いているか」を持つ項目は、**数値**で絞ります。
値は非連続（Candidate `1` / Job `3` / Client `5` / Recruiter `9` / Sales `11` …）で、
数値をそのまま書くと欠番や取り違えに気づけないので、**名前から引いてください**<!-- 根拠: ADR-0079 -->。

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
- **キーワードの 1 つにカンマを入れることはできません**（キーワードどうしの区切りとして読まれるため）。送る前に
  `PortersConfigError` になります。
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

オフセット方式（何件目から何件取るか）です。`count` は **1〜200（既定 10）**、`start` は **0 以上の整数**（0 始まり）。

```ts
const page = await t.candidate.search({ count: 200, start: 0 });
page.total; // 条件に合う総件数
page.count; // 今回返った件数
page.start; // 今回の開始インデックス
```

全件が必要なら `searchAll` を使ってください（200 件刻みで自動的に辿り、
`total` に達するか空ページで停止します）。応答が頼んだページと合わないとき（応答の `start` が頼んだ位置と違うときなど）は、
同じレコードを繰り返し返したり抜かしたりせずに、`PortersResourceError`（`category` は `"unknown"`）で止まります。

`searchAll` は「何件目から」でページを辿るので、辿っている途中で条件に合うレコードが減ると（削除・更新で条件から外れるなど）、
その件数だけ後ろのレコードが前のページへずれ、**取りこぼします**。途中で増えたときは、同じレコードを 2 回受け取ることがあります。
取りこぼしは、後から件数を比べても見つけられません（減った後の `total` と、受け取った件数が一致するため）。

辿っている間にレコードが減りうるときは、`searchAll` の代わりに、`P_Id` の昇順で「前のページの最後の `P_Id` より大きいもの」を
読み続けてください。何件目かではなく `P_Id` で続きを指すので、途中で減っても、残っているレコードは取りこぼしません。
`field` を指定するときは、`P_Id` を必ず含めてください（含めないと、1 ページ目の後で続きが分からずに止まります）。

```ts
let lastId = 0;
for (;;) {
  const page = await t.candidate.search({
    condition: { P_Id: { gt: lastId } },
    order: [{ P_Id: "asc" }],
    count: 200,
  });
  for (const c of page.items) console.log(c.P_Id);
  const last = page.items.at(-1)?.P_Id;
  if (last === undefined || last === null) break;
  lastId = last;
}
```

<!-- 根拠: ADR-0099 -->

`count` / `start` は、何を探すかを表す型（`CandidateSearchQuery` など）とは別の型
[`Paging`][t-Paging] です。`search` はクエリと一緒に `Paging` を受け取り、`searchAll` はページを自分で辿るので
受け取りません。そのため、同じクエリを `search` と `searchAll` の両方に渡せます。

```ts
import type { CandidateSearchQuery } from "@joymerrevent/porters-connect";

const query: CandidateSearchQuery = { condition: { P_Name: { part: "山田" } } };

const first = await t.candidate.search({ ...query, count: 50 }); // 最初の 50 件
for await (const c of t.candidate.searchAll(query)) {
  console.log(c.P_Id); // 条件に合うすべて
}
```

クエリの変数に `count` / `start` も入れておきたいときは、型を `CandidateSearchQuery & Paging` にします。

宣言したカスタム項目も `condition` や `order` に書くときは、`CandidateSearchQuery` の型引数に、宣言から取り出した
その 1 リソース分の項目を渡します。取り出すには [`CustomFor`][t-CustomFor] を使います。

```ts
import { defineFields } from "@joymerrevent/porters-connect";
import type {
  CandidateSearchQuery,
  CustomFor,
} from "@joymerrevent/porters-connect";

const fields = defineFields({
  candidate: (f) => ({ U_score: f.number() }),
});
type CandidateCustom = CustomFor<typeof fields, "candidate">;

const highScore: CandidateSearchQuery<CandidateCustom> = {
  condition: { U_score: { ge: 80 } },
  order: [{ U_score: "desc" }],
};

const scope = porters.tenant(123, { fields });
for await (const c of scope.candidate.searchAll(highScore)) {
  console.log(c.P_Id);
}
```

## `get` / `getMany` — ID で読む

ID が分かっているレコードは、`get`（1 件）か `getMany`（複数）で読みます。どちらも `field` / `expand` / `image` を
`search` と同じ書き方で指定できます。

```ts
const one = await t.candidate.get(1234); // 見つからなければ undefined
const named = await t.candidate.get(1234, { field: ["P_Name"] }); // P_Id と P_Name だけ

const many = await t.candidate.getMany([1234, 5678, 9999], {
  field: ["P_Name"],
});
// → [レコード, レコード, undefined]（渡した順。見つからない ID の位置は undefined）
```

<!-- 根拠: ADR-0095 -->

- **ID の項目は必ず読みます**。`field` に `P_Id` を入れなくても、返るレコードには `P_Id` が入ります。
- **`getMany` の戻り値は、渡した ID と同じ長さ・同じ順の配列です**。同じ ID を 2 回渡すと、両方の位置に同じレコードが
  入ります。空の配列を渡すと、リクエストを送らずに `[]` を返します。
- **`getMany` は ID をまとめて送ります**。1 回のリクエストは最大 200 件で、リクエストの長さの上限に収まるように
  ライブラリが分けて順に送ります。`field` で項目を絞ると、1 回に送れる ID が増えます。
- **ID は 1 以上の整数です**。`0`・負の数・小数・`NaN` を渡すと、送る前に `PortersConfigError` になります。
- **返ってきたレコードは、渡した ID と突き合わせます**。渡していない ID のレコードが返ってきたとき、同じレコードが
  2 件返ってきたとき、返ってきた件数が応答の総件数と合わないときは、何も返さずに `PortersResourceError`（`category` は
  `"unknown"`）になります。PORTERS が ID の条件どおりに絞らなかったか、応答が途中で切れたことを表すので、
  `getMany` のときは `get` で 1 件ずつ読んでください。`get` も同じように突き合わせ、別の ID のレコードは返しません。
  途中のリクエストが失敗したときも、それまでの結果は返さずにエラーになります。
- **`getMany` は Attachment にはありません**。ファイルの本体は `get` で 1 件ずつ取ります。マスタ 5 種には `get` も
  `getMany` もありません。

## マスタは指定できるものが違う

Partition / User / Department / Field / Option の 5 つは**読み取り専用のマスタ**で、データ系リソースとは
指定できるものが別です。**`condition` と `get(id)` はありません** — PORTERS の API が受け付けるクエリだけを
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

// 選択肢マスタ。階層を親から順に 1 つの配列で返す
const options = await t.option.search({ alias: "Option.P_Gender" });
```

- `t.option.search()` に `searchAll` はありません（PORTERS の Option Read に `start` が無いため）。階層は
  `P_ParentId` / `P_Order` で復元します。受け取るページ送りは件数の上限 `count` だけで、型は
  [`Limit`][t-Limit] です（省略すると全件）。
- `porters.partition.current()` は**提供していません**。`request_type=0` は既定の `code_direct`
  認証では 403 になるためです（[Partition とテナントスコープ][partition]）。

## 送信前にエラーになるもの

原因の分かりにくいサーバーエラーになる前に、ライブラリが `PortersConfigError` で弾きます。

- `keywords` が 100 文字超
- `itemstate` が `deleted` / `all` で許されない項目を condition に指定
- リクエスト全体が約 15000 文字超（**URL + body**）
- `count` が 1〜200 の外（整数でない場合も）
- `start` が 0 以上の整数でない
- 条件の値にカンマ、`or` / `and` の値にカンマかコロン、キーワードにカンマ（上の「カンマを含む値では検索できません」）
- `or` / `and` が空の配列
- `get` / `getMany` の ID が 1 以上の整数でない

## 関連

- ガイド: [削除と削除済みデータ][deleted]（`itemstate` と `P_Deleted`）／[項目と値のかたち][aliases]（alias と読みのかたち）／
  [カスタム項目][custom-fields]（`U_` / `A_` を条件に使う）／[書き込み][write]
- リソース: [リソースと操作][resources]（呼べるメソッドはリソースごとに違う）
- 実践例: [毎日の差分同期][sync-batch]（`P_UpdateDate` の条件で差分を取る）
- リファレンス: [Resource API 概要][rapi]（パラメータ表・condition の演算子（suffix）の一覧）
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
[t-Paging]: ../api/type-aliases/Paging.md
[t-CustomFor]: ../api/type-aliases/CustomFor.md
[t-Limit]: ../api/type-aliases/Limit.md
[f-rawValue]: ../api/functions/rawValue.md
