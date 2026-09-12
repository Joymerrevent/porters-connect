# 3. はじめての読み取り

- **前提**: [2. 認証を通す][s2]（トークンが取れる状態）
- **次に読む**: [4. はじめての書き込み][s4]

読み取りは 3 つ覚えれば足ります。**どの Partition か**を束ねて、**どの項目が欲しいか**を
書いて、`search` か `get` を呼ぶ。

## まず Partition を束ねる

`PortersClient` を作っただけでは、まだ何も読めません。データは Partition（Company DB）に
分かれていて、`tenant(id)` がそれを束ねます。

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

## `field` は省略しないほうがいい

**省略すると主キーしか返りません。** PORTERS の仕様で、ライブラリもそれに合わせています。

```ts
const idsOnly = await t.candidate.search(); // P_Id だけが入って返る
```

「項目が空で返ってくる」の原因はたいていこれです。欲しい項目は明示してください。

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

ページングの途中でクエリを書き換えないでください（次ページ以降の結果が変わります）。

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

**[4. はじめての書き込み][s4]** — 読めたので、次は作って更新します。

[aliases]: ../concepts/aliases.md
[custom-fields]: ../howto/custom-fields.md
[partition]: ../concepts/partition.md
[s2]: authenticate.md
[s4]: first-write.md
[search-records]: ../howto/search-records.md
