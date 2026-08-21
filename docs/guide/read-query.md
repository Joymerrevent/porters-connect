# Read クエリ（field / condition / order / keywords / itemstate）

データ系リソースの `search` / `searchAll` が受けるクエリの使い方です。
**演算子と対象は項目の Data Type から決まり**、型が合わないものはコンパイルエラーになります
（[ADR-0038][adr38]／公開 API の形は [ADR-0005][adr5] R-5）。

## 全体像

```ts
const page = await t.candidate.search({
  field: ["Person.P_Id", "Person.P_Name"], // 取得する項目（省略可）
  condition: { P_Name: { part: "山田" } }, // 検索条件（複数項目は AND）
  order: [{ P_UpdateDate: "desc" }], // 並び順
  keywords: ["東京", "営業"], // キーワード AND 検索
  itemstate: "existing", // 削除状態（既定）
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
| `field: [...]` | 指定したものだけ（そのまま送る）                             |

alias は**接頭辞付き**で書きます（Candidate は `Person.`、他はリソース名）。

```ts
await t.candidate.search({ field: [] }); // total だけ見たい
```

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

| 値           | 意味                         |
| ------------ | ---------------------------- |
| `"existing"` | 生存レコードのみ（**既定**） |
| `"deleted"`  | 削除済みのみ                 |
| `"all"`      | 両方                         |

```ts
await t.candidate.search({
  itemstate: "deleted",
  condition: { P_UpdateDate: { ge: "2026-07-01T00:00:00Z" } },
});
```

**`deleted` / `all` のときは制約が 2 つ**あります。どちらも送信前に検査します。

- `condition` に使えるのは **`P_Id` / `P_UpdateDate` / `P_UpdatedBy` の 3 つだけ**。
  他の項目を指定すると `PortersConfigError`（hint 付き）になります。
- **更新日は 90 日以内**。PORTERS が自動で 90 日条件を付けるため、
  91 日以前を指定すると Result Code 124 が返ります。

ここで言う `P_UpdateDate` は**削除された日時**、`P_UpdatedBy` は**最後に編集した人**です。

> **どれが削除済みかは現時点では判別できません。** 削除状態を表す標準項目 `P_Deleted` が
> まだカタログに載っていないためです（[findings RV-26][rv26]）。`"all"` は生存と削除済みを
> 混ぜて返すので、当面は `"deleted"` と `"existing"` を分けて呼ぶのが確実です。

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

- 決定: [ADR-0038][adr38]（Read クエリの詳細設計）／[ADR-0020][adr20]（`field` の既定挙動）
- カスタム項目を条件に使う: [カスタム項目ガイド][custom-fields]
- API 事実: [Resource API 概要][rapi]（パラメータ表・condition の suffix 一覧）

[adr5]: ../adr/0005-public-api-shape.md
[adr20]: ../adr/0020-read-field-default.md
[adr38]: ../adr/0038-read-query-surface-impl.md
[custom-fields]: custom-fields.md
[prd]: ../design/requirements.md
[rapi]: ../reference/resource-api/README.md
[rv26]: ../reviews/rv/0026-deleted-flag-unsupported.md
