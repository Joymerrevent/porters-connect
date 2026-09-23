# 削除と削除済みデータ

PORTERS Connect API に削除はありません。その代わり、画面で消されたデータは読めます。このページを読むと、
消せない前提で二重登録を避ける書き方と、削除済みを `itemstate` で読むときの規則、どれが削除済みかを
見分ける方法が分かります。

## まず知ること

- **削除 API はありません。** データも添付も、API から消す方法は提供されていません（PORTERS 自身が
  「提供予定なし」と書いています）。このライブラリも `delete()` を**型の上でも持ちません**。
- **画面で消されたデータは読めます。** `itemstate` で生存／削除済み／両方を選びます。
- **`itemstate` の省略と `"existing"` は別の意味です。** 省略は PORTERS の既定に従い、`"existing"` は生存のみを
  要求します。今はどちらも同じ結果ですが、既定が変わったときに違いが出ます。
- **消せない前提で書きます。** 二重に作らない工夫、`create` を自動で再送しない、テストデータも残る。

## `delete()` は生えていません

「実行すると失敗するメソッド」を置くと、**呼べると思わせてしまう**からです。無い操作は無いままにしてあります。

<!-- doccheck: expect-error -->

```ts
// ✗ そんなメソッドは無い（コンパイルが通らない）
await t.candidate.delete(10001);
```

消す必要があるときは PORTERS の画面で操作します。API の役目ではありません。

## `itemstate` — 削除済みを読む

`itemstate` に渡す値と、それぞれ何が返るかです。

| 指定         | 意味                                 | 送信                 |
| ------------ | ------------------------------------ | -------------------- |
| **省略**     | API の既定に委ねる（現在は生存のみ） | （載せない）         |
| `"existing"` | **生存レコードのみを要求する**       | `itemstate=existing` |
| `"deleted"`  | 削除済みのみ                         | `itemstate=deleted`  |
| `"all"`      | 両方                                 | `itemstate=all`      |

```ts
const gone = await t.candidate.search({
  itemstate: "deleted",
  condition: { P_UpdateDate: { ge: "2026-07-01T00:00:00Z" } },
});
```

> **省略と `"existing"` は違います**<!-- 根拠: ADR-0057 -->。いまはどちらも生存レコードのみが返るので
> 結果は同じですが、**省略は「PORTERS の既定に従う」**、**`"existing"` は「生存のみが欲しい」** という
> 別の意思表示です。ライブラリは後者をそのまま送るので、**PORTERS が将来この既定を変えても
> `"existing"` と書いたコードは生存のみを受け取り続けます**。生存のみであることが業務上重要なら、
> 省略せず `itemstate: "existing"` と書いてください。

### `"deleted"` / `"all"` のときの制約

どちらも送信前に検査します（PORTERS に送れば 400 になるので、待たずに落とします）。

- `condition` に使えるのは **`P_Id` / `P_UpdateDate` / `P_UpdatedBy` の 3 つだけ**です。他の項目を指定すると
  `PortersConfigError`（hint 付き）になります。生きているデータが混ざる `"all"` でも同じです。
- **更新日は 90 日以内**です。PORTERS が自動で 90 日条件を付けるため、91 日以上前の更新日を指定すると Result Code `124` が
  返ります。つまり古い削除は引けません。

このとき 2 つの項目の意味が変わります。**`P_UpdateDate` は削除された日時**、**`P_UpdatedBy` は最後に編集した人**です。

## `P_Deleted` — どれが削除済みか

`"all"` は生存と削除済みを混ぜて返します。**どちらかは `P_Deleted` で判別**します<!-- 根拠: ADR-0056 -->。

```ts
const page = await t.candidate.search({
  itemstate: "all",
  field: ["P_Id", "P_Name", "P_Deleted"],
});
const deleted = page.items.filter((c) => c.P_Deleted === "1");
```

- **値は文字列**の `"0"`（生存）／`"1"`（削除済み）です。`number` でも `boolean` でもありません。
  PORTERS がこの項目に **Data Type を与えていない**（reference の Field Type / Data Type 欄がともに「ー」）ため、
  変換の基準がありません。勝手に決めればライブラリの発明になるので、**生の値のまま**返します。
- **`condition` にも `order` にも指定できません**（PORTERS の制約）。型でも書けないので、試みると
  コンパイルエラーになります。**書き込みもできません**（`create` / `update` の入力に現れません）。
- `field` を省略すれば**自動で要求**されます。自分で `field` を渡すときは `"P_Deleted"` を明示してください。

> 応答での出現条件と値域は**実機で未確認**です<!-- 根拠: LV-14 -->。
> `itemstate` を省略したときも返るか、値が `0` / `1` 以外を取りうるかは契約環境で確かめます。

## 消せないことが使い方に効くところ

- **同じデータを二重に作らない工夫が要ります。** 作ってしまっても消せません。`create` は非冪等なので、
  ライブラリは**結果が不明な場合に自動で再送しません**（[エラーと再試行][errors]）。
- **Process は JOB × レジュメで一意**です。重複して作ろうとすると PORTERS が Result Code `301` を返します
  （消せないので、弾かれるほうが安全です。[Process][r-process]）。
- **差分取得で「消えたレコード」は追えません。** 削除は `itemstate: "deleted"` で別に読みます
  （[毎日の差分同期][sync-batch]）。
- **テスト環境のデータも消せません。** 契約なしで動かす[契約なしでテストする][testing]が用意してあるのは、
  これも理由の 1 つです。

## 関連

- 主題: [検索][query]（クエリの他の要素）／[書き込み][write]（`create` は再送されない）／[エラーと再試行][errors]
- リソース別: [Process][r-process]（JOB × レジュメで一意。重複は `301`）
- 実践例: [毎日の差分同期][sync-batch]
- リファレンス: [運用上の落とし穴][gotchas]（削除 API は無い）／[Result Code][codes]（`301` 重複・`124` 期間）
- ほかの目的から探す: [目次][index]

<!-- 根拠:
- 決定: ADR-0056（`P_Deleted` の型）／ADR-0057（`itemstate` の明示送信）／
  ADR-0063（冪等性ガードの範囲）
-->

[codes]: ../reference/resource-api/result-codes.md
[testing]: testing.md
[gotchas]: ../reference/gotchas.md
[errors]: errors.md
[query]: query.md
[write]: write.md
[sync-batch]: ../recipes/sync-batch.md
[r-process]: ../resources/process.md
[index]: ../index.md
