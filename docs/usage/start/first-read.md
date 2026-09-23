# はじめての読み取り

- **前提**: [認証を通して、疎通を確認する][s2]（Company DB の一覧が返る状態）
- **次に読む**: [はじめての書き込み][s4]

このページでは、Company DB を指定し、条件で探し、1 件を取り、全件を読みます。読み取りは 3 つ覚えれば足ります。
**どの Partition か**を指定して、**どの項目が欲しいか**を書いて、`search` か `get` を呼ぶ、の 3 つです。終わると、返ってくる値の
かたちも分かります。

## まず Partition を指定する

`PortersClient` を作っただけでは、まだ何も読めません。データは Partition（Company DB）に
分かれていて、`tenant(id)` でそれを指定します。**前ページの一覧に出た `P_Id`** を渡します。

```ts
const t = porters.tenant(123); // 以降 `t` をクライアントのように使う
```

**id を知らないところから始めるなら**、Partition マスタを読みます。これが唯一
`partition` を送らない読み取りです（Partition を探すためのものだから）。

```ts
const partitions = await porters.partition.search();
for (const p of partitions.items) console.log(p.P_Id, p.P_Name);
```

なぜ client に既定の Partition を持たせないのかは [Partition とテナントスコープ][partition] にあります。
短く言うと、**どこに書いたか分からない書き込み**を起こさないためです。

## 条件で探す

条件を付けて、1 ページ分を取ります。

```ts
const page = await t.candidate.search({
  field: ["P_Id", "P_Name", "P_Mail", "P_UpdateDate"],
  condition: { P_Name: { part: "山田" } }, // part = 部分一致 / full = 完全一致
  order: [{ P_UpdateDate: "desc" }],
  count: 50, // 1 ページ最大 200
});

console.log(page.total); // 条件に合う総件数
console.log(page.items.length); // このページの件数
```

`condition` に書ける演算子は**項目の Data Type ごとに違います**。文字列に `part` / `full`、
数値や日時に `ge` / `le` のように、型が許すものだけがエディタの補完候補に出ます。書き方の全体像は
[検索][search-records] にあります。

### いま何が起きたか

短いコードですが、このライブラリの特徴がほぼ入っています。

- **XML は外に漏れません。** PORTERS の応答は XML ですが、返るのは型の付いたオブジェクトです。
  `page.items[0]?.P_Name` は `string | null` で、`P_Nmae` と書けばコンパイルが通りません。
- **`Person.` を書いていません。** PORTERS との通信では項目名は `Person.P_Name` ですが、書くのは
  `P_Name` だけです（接頭辞はライブラリが付けます）。**Candidate の接頭辞は `Person`** で、
  リソース名と一致しません — 覚えなくて済むようにしてあります（[項目と値のかたち][aliases]）。

## `field` で取る項目を選ぶ

**省略すると、そのリソースの標準項目（`P_`）が全部返ります。**

PORTERS 自体は `field` を指定しないと主キーしか返しません。それでは型に定義されている項目が
ひとつも入らないので、**ライブラリが既定の項目を補っています**<!-- 根拠: ADR-0020 -->。補う元は
[ライブラリが知っている項目の一覧][aliases]です。

| 書き方         | 返ってくるもの                                           |
| -------------- | -------------------------------------------------------- |
| 省略           | ライブラリが知っている**全項目**                         |
| `field: [...]` | 挙げたものだけ                                           |
| `field: []`    | **主キーのみ**（PORTERS 本来の挙動。件数だけ欲しいとき） |

```ts
const all = await t.candidate.search(); // ライブラリが知っている全項目
const idsOnly = await t.candidate.search({ field: [] }); // P_Id だけ
```

慣れてきたら**使う項目だけ**挙げてください。転送量が減り、リクエスト長の上限にも余裕が出ます。

テナント固有の項目（`U_` / `A_`）は**既定に入りません**。宣言したものだけが、ライブラリが知っている項目に加わるからです
（後述）。

## 1 件だけ取る

id が分かっているなら、`get` で 1 件だけ取れます。

```ts
const one = await t.candidate.get(10001);
console.log(one?.P_Name); // 見つからなければレコードごと undefined
```

## 全件を読む

1 ページ 200 件が上限です。`searchAll` は次のページの取得を自動で行います。

```ts
for await (const c of t.candidate.searchAll({
  field: ["P_Id", "P_Name"],
  condition: { P_Prefecture: { full: "東京都" } },
})) {
  console.log(c.P_Name);
}
```

渡したクエリは、**最初のページを取るときに 1 度だけ**組み立てられます。反復中に元のオブジェクトを
書き換えても、**後続のページは最初の条件のまま**です<!-- 根拠: RV-32 -->。「全件取ったつもりが、
途中から別条件の全件」になるのを防ぐためです。

## 返ってくる値のかたち

先に知っておくべきことが 3 つあります。

| 見え方                       | 例                                                                   |
| ---------------------------- | -------------------------------------------------------------------- |
| **日時は ISO 8601（UTC）**   | `P_UpdateDate` → `"2026-09-11T12:00:00Z"`                            |
| **選択肢は常に配列**         | `P_Phase` → `["Option.P_PersonPhase_Applied"]`                       |
| **User は入れ子、参照は id** | `P_Owner` → `{ P_Id, P_Type, P_Name, P_Mail }`、`P_Client` → `20001` |

**書くときはかたちが変わります**（`P_Owner` は数値の id だけを送る）。読みと書きでかたちが違うのは
**PORTERS Connect API の性質**で、[項目と値のかたち][aliases] にまとめてあります。

テナント固有の項目（`U_` / `A_`）も読めますが、**宣言しないと `field` に書けず（コンパイルエラー）、
要求もされません**。宣言のしかたは[カスタム項目][custom-fields]にあります。

## 次に読む

**[はじめての書き込み][s4]** — 読めたので、次は作成して更新します。

[aliases]: ../topics/fields.md
[custom-fields]: ../topics/custom-fields.md
[partition]: ../topics/tenant.md
[s2]: authenticate.md
[s4]: first-write.md
[search-records]: ../topics/query.md
