---
"@joymerrevent/porters-connect": minor
---

**削除済みかどうかが分かるようになりました**。データ系 5 リソース（Candidate / Job / Client /
Process / Resume）の公開型に **`P_Deleted`** が加わります（[ADR-0056][adr56]）。

`itemstate: "all"` は生存レコードと削除済みレコードを**混ぜて**返しますが、これまでは
どれが削除済みかを判別する手段がありませんでした。**削除 API が無い PORTERS では
「削除済みを読む」こと自体が運用手段**（同期・監査・復元の判断材料）なので、
読めるのに解釈できない状態は機能が半分でした。

```ts
const page = await t.candidate.search({ itemstate: "all" });
const deleted = page.items.filter((c) => c.P_Deleted === "1");
```

### 値は文字列です

`"0"`（生存）／`"1"`（削除済み）の**文字列**で、`number` でも `boolean` でもありません。
PORTERS がこの項目に **Data Type を与えていない**（reference の Field Type / Data Type 欄が
ともに「ー」）ため、変換の基準がこちらにありません。`0` や `false` にするのは
**ライブラリが決めること＝発明**になるので、生の値のまま返します。

### 書けません・条件にも並べ替えにも使えません

PORTERS は `P_Deleted` を「**Read の `field` でのみ指定可**」と定めています。同じ制約が型にも出ます。

```ts
await t.candidate.search({ condition: { P_Deleted: { full: "1" } } }); // 型エラー
await t.candidate.search({ order: [{ P_Deleted: "asc" }] }); // 型エラー
await t.candidate.update(id, { P_Deleted: "0" }); // 型エラー
```

`field` を省略すれば自動で要求されます。自分で `field` を渡すときは
`"Person.P_Deleted"` のように接頭辞付きで明示してください。

### 既存コードへの影響

ありません。公開型に読み取り項目が 1 つ増えるだけで、既存の呼び出しは変わりません。

なお**応答での出現条件と値域は実機で未確認**です（[live-verification][lv] LV-14）。
`itemstate` を省略したときも返るか、値が `0` / `1` 以外を取りうるかは契約環境で確かめます。

[adr56]: docs/adr/0056-deleted-flag-typing.md
[lv]: docs/live-verification.md
