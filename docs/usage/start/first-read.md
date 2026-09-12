# はじめての読み取り

- **前提**: [認証を通して、疎通を確認する][s2]（Company DB の一覧が返る状態）
- **次に読む**: [はじめての書き込み][s4]

読み取りは 3 つ覚えれば足ります。**どの Partition か**を束ねて、**どの項目が欲しいか**を
書いて、`search` か `get` を呼ぶ。

## まず Partition を束ねる

`PortersClient` を作っただけでは、まだ何も読めません。データは Partition（Company DB）に
分かれていて、`tenant(id)` がそれを束ねます。**前ページの一覧に出た `P_Id`** を渡します。

```ts
const t = porters.tenant(123); // 以降 `t` をクライアントのように使う
```

**id を知らないところから始めるなら**、Partition マスタを読みます。これが唯一
`partition` を送らない読み取りです（Partition を探すためのものだから）。

```ts
const partitions = await porters.partition.search();
for (const p of partitions.items) console.log(p.P_Id, p.P_Name);
```

なぜ client に既定の Partition を持たせないのかは [Partition とテナント][partition] にあります。
短く言うと、**どこに書いたか分からない書き込み**を起こさないためです。

## 条件で探す

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
数値や日時に `ge` / `le` のように、型が許すものだけが補完に出ます。書き方の全体像は
[検索][search-records] にあります。

### いま何が起きたか

短いコードですが、このライブラリの性格がほぼ出ています。

- **XML は外に漏れません。** PORTERS の応答は XML ですが、返るのは型の付いたオブジェクトです。
  `page.items[0]?.P_Name` は `string | null` で、`P_Nmae` と書けばコンパイルが通りません。
- **`Person.` を書いていません。** wire 上の項目名は `Person.P_Name` ですが、書くのは
  `P_Name` だけです（接頭辞はライブラリが付けます）。**Candidate の接頭辞は `Person`** で、
  リソース名と一致しません — 覚えなくて済むようにしてあります（[alias と Data Type][aliases]）。

## `field` は省略してよい

**PORTERS は `field` 未指定だと主キーしか返しません。** 型が全項目を約束しているのに中身が
`P_Id` だけ、という乖離が起きるので、**ライブラリがカタログ由来の既定 field を補います**
（[ADR-0020][adr20]）。3 通りの意味があります。

| 書き方         | 返ってくるもの                                     |
| -------------- | -------------------------------------------------- |
| 省略           | **カタログ上の全項目**（既定）                     |
| `field: [...]` | 指定したものだけ（**転送量が減るので、慣れたら**） |
| `field: []`    | **主キーのみ**（API 本来の挙動。件数だけ欲しい）   |

```ts
const all = await t.candidate.search(); // カタログ上の全項目が入って返る
const idsOnly = await t.candidate.search({ field: [] }); // P_Id だけ
```

**例外はテナント固有の項目（`U_` / `A_`）です。** 宣言していないものはカタログに無いので、
既定にも含まれません（後述）。

## 1 件だけ取る

```ts
const one = await t.candidate.get(10001);
console.log(one?.P_Name); // 見つからなければ null
```

## 全件を回す

1 ページ 200 件が上限です。`searchAll` は次ページの取得を自分でやってくれます。

```ts
for await (const c of t.candidate.searchAll({
  field: ["P_Id", "P_Name"],
  condition: { P_Prefecture: { full: "東京都" } },
})) {
  console.log(c.P_Name);
}
```

渡したクエリは**最初のページを取るときに 1 度だけ**組み立てられます。反復中に元のオブジェクトを
書き換えても、**後続のページは最初の条件のまま**です（[RV-32][rv32]）— 「全件取ったつもりが
途中から別条件の全件」にならないようにしてあります。

## 返ってくる値の形

3 つだけ、先に知っておくと驚きません。

| 見え方                     | 例                                             |
| -------------------------- | ---------------------------------------------- |
| **日時は ISO 8601（UTC）** | `P_UpdateDate` → `"2026-09-11T12:00:00Z"`      |
| **選択肢は常に配列**       | `P_Phase` → `["Option.P_PersonPhase_Applied"]` |
| **User や参照は入れ子**    | `P_Owner` → `{ P_Id, P_Type, P_Name, P_Mail }` |

**書くときは形が変わります**（`P_Owner` は数値の id だけを送る）。読みと書きの非対称は
このAPI の癖で、[alias と Data Type][aliases] にまとめてあります。

テナント固有の項目（`U_` / `A_`）も読めますが、**宣言しないと型が付かず、`field` に書かないと
そもそも要求されません**。宣言のしかたは[カスタム項目][custom-fields]にあります。

## 次に読む

**[はじめての書き込み][s4]** — 読めたので、次は作って更新します。

[adr20]: ../../adr/0020-read-field-default.md
[aliases]: ../concepts/aliases.md
[custom-fields]: ../howto/custom-fields.md
[partition]: ../concepts/partition.md
[rv32]: ../../reviews/rv/0032-searchall-query-mutation.md
[s2]: authenticate.md
[s4]: first-write.md
[search-records]: ../howto/search-records.md
