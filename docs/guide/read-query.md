# Read クエリ（field / condition / order / keywords / itemstate）

データ系リソースの `search` / `searchAll` が受けるクエリの使い方です。
**演算子と対象は項目の Data Type から決まり**、型が合わないものはコンパイルエラーになります
（[ADR-0038][adr38]／公開 API の形は [ADR-0005][adr5] R-5）。

## 全体像

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
  // …
}
```

## `field` — 取得する項目

**省略が既定**です。PORTERS は `field` 未指定だと**主キーしか返さない**ため、
ライブラリがカタログ由来の既定 field を補います（[ADR-0020][adr20]）。3 通りの意味があります。

| 書き方         | 送られるもの                                                 |
| -------------- | ------------------------------------------------------------ |
| 省略           | **カタログ上の全項目**（既定・型が約束するものが実際に返る） |
| `field: []`    | **主キーのみ**（API 本来の挙動。件数だけ欲しいときに）       |
| `field: [...]` | 指定したものだけ                                             |

alias は **`condition` / `order` と同じ素の名前**（接頭辞なし）で書きます。
接頭辞はリソースごとの定数なので**ライブラリが付けます**（[ADR-0059][adr59]）。

```ts
await t.candidate.search({ field: ["P_Id", "P_Name"] });
// → field=Person.P_Id,Person.P_Name を送る（Candidate の接頭辞は Person）

await t.candidate.search({ field: [] }); // total だけ見たい
```

**間違いはコンパイル時に止まります**。`field` はカタログ済みの alias
（標準 `P_` ＋ [`defineFields`][custom-fields] で宣言したカスタム項目）か、
未宣言のカスタム項目（`U_` / `A_` で始まる名前）しか受け付けません。

```ts
await t.candidate.search({ field: ["U_memo"] }); // OK（未宣言カスタムも引ける）
await t.candidate.search({ field: ["P_Nmae"] }); // ✗ 型エラー（綴り間違い）
await t.candidate.search({ field: ["Person.P_Name"] }); // ✗ 型エラー（接頭辞は書かない）
```

綴りを間違えた alias は PORTERS に送っても**黙って無視されるだけ**で、書いた時点では気づけませんでした。
型で受けることでそこを手前に引き上げています。未宣言のカスタム項目は `U_` 以降の綴りまでは検査できないので、
よく使うものは [`defineFields`][custom-fields] で宣言してください（宣言すれば綴りも検査されます）。

> 取得しなかった項目は**キーごと存在しません**（`undefined`）。値が空なら `null` です。
> 型が `値 | null | undefined` になっているのはこのためです。

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
ライブラリが行います。JST などの業務タイムゾーン変換は**利用側の責務**です（[PRD R-10][prd]）。

### 上位リソースの絞り込み

上位階層の項目を直接 condition に使うことはできませんが、**紐づく ID の項目**でなら絞れます。

```ts
await t.resume.search({ condition: { P_Candidate: { eq: 10008 } } });
```

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

- **カンマ込みで 100 文字まで**。超えると送信前に `PortersConfigError` で落ちます。
- 電話番号はハイフンを除いた数字で照合されます。

## `itemstate` — 削除済みの取得

**PORTERS に削除 API はありません**。`delete()` を提供しないのはそのためで、
削除済みレコードを読む唯一の手段がこの `itemstate` です。

| 指定         | 意味                                 | 送信                 |
| ------------ | ------------------------------------ | -------------------- |
| **省略**     | API の既定に委ねる（現在は生存のみ） | （載せない）         |
| `"existing"` | **生存レコードのみを要求する**       | `itemstate=existing` |
| `"deleted"`  | 削除済みのみ                         | `itemstate=deleted`  |
| `"all"`      | 両方                                 | `itemstate=all`      |

```ts
await t.candidate.search({
  itemstate: "deleted",
  condition: { P_UpdateDate: { ge: "2026-07-01T00:00:00Z" } },
});
```

> **省略と `"existing"` は違います**（[ADR-0057][adr57]）。いまはどちらも生存レコードのみが返るので
> 結果は同じですが、**省略は「PORTERS の既定に従う」**、**`"existing"` は「生存のみが欲しい」**という
> 別の意思表示です。ライブラリは後者をそのまま送るので、**PORTERS が将来この既定を変えても
> `"existing"` と書いたコードは生存のみを受け取り続けます**。生存のみであることが業務上重要なら、
> 省略せず `itemstate: "existing"` と書いてください。

**`deleted` / `all` のときは制約が 2 つ**あります。どちらも送信前に検査します。

- `condition` に使えるのは **`P_Id` / `P_UpdateDate` / `P_UpdatedBy` の 3 つだけ**。
  他の項目を指定すると `PortersConfigError`（hint 付き）になります。
- **更新日は 90 日以内**。PORTERS が自動で 90 日条件を付けるため、
  91 日以前を指定すると Result Code 124 が返ります。

ここで言う `P_UpdateDate` は**削除された日時**、`P_UpdatedBy` は**最後に編集した人**です。

### `P_Deleted` — どれが削除済みか

`"all"` は生存と削除済みを混ぜて返します。**どちらかは `P_Deleted` で判別**します。

```ts
const page = await t.candidate.search({ itemstate: "all" });
const deleted = page.items.filter((c) => c.P_Deleted === "1");
```

- **値は文字列**の `"0"`（生存）／`"1"`（削除済み）です。`number` でも `boolean` でもありません。
  PORTERS がこの項目に **Data Type を与えていない**（reference の Field Type / Data Type 欄がともに「ー」）ため、
  変換の基準がありません。勝手に決めればライブラリの発明になるので、**生の値のまま**返します（[ADR-0056][adr56]）。
- **`condition` にも `order` にも指定できません**（PORTERS の制約）。型でも書けないので、
  試みるとコンパイルエラーになります。**Write もできません**（`create` / `update` の入力に現れません）。
- `field` を省略すれば**自動で要求**されます。自分で `field` を渡すときは
  `"P_Deleted"` を明示してください。

> 応答での出現条件と値域は**実機で未確認**です（[live-verification][lv] LV-14）。
> `itemstate` を省略したときも返るか、値が `0` / `1` 以外を取りうるかは契約環境で確かめます。

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

## 送信前に落ちるもの

不透明なサーバーエラーになる前に、ライブラリが `PortersConfigError` で弾きます。

| 条件                                                                 | 検査 |
| -------------------------------------------------------------------- | ---- |
| `keywords` が 100 文字超                                             | ✅   |
| `itemstate` が `deleted` / `all` で許されない項目を condition に指定 | ✅   |
| リクエスト全体が約 15000 文字超（**URL + body**）                    | ✅   |
| `count` が 1〜200 の外（整数でない場合も）                           | ✅   |

## 関連

- 決定: [ADR-0038][adr38]（Read クエリの詳細設計）／[ADR-0020][adr20]（`field` の既定挙動）／
  [ADR-0059][adr59]（`field` を接頭辞なしの型付き alias で受ける）／
  [ADR-0056][adr56]（`P_Deleted` を「型を持たない項目」として載せる）／
  [ADR-0057][adr57]（`itemstate` の明示指定はそのまま送る）
- カスタム項目を条件に使う: [カスタム項目ガイド][custom-fields]
- API 事実: [Resource API 概要][rapi]（パラメータ表・condition の suffix 一覧）

[adr5]: ../adr/0005-public-api-shape.md
[adr20]: ../adr/0020-read-field-default.md
[adr38]: ../adr/0038-read-query-surface-impl.md
[adr56]: ../adr/0056-deleted-flag-typing.md
[adr57]: ../adr/0057-itemstate-existing-explicit.md
[adr59]: ../adr/0059-read-field-bare-alias.md
[custom-fields]: custom-fields.md
[lv]: ../live-verification.md
[prd]: ../design/requirements.md
[rapi]: ../reference/resource-api/README.md
