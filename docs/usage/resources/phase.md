# Phase（フェーズ履歴）

フェーズの変更履歴です。データ系リソースのレコードごとに積み上がり、レコード側の `P_Phase` を書き換えると行が増えます。

- **アクセサ**: `t.phase.of("candidate")` のように、**どのリソースの履歴かを先に束ねる**
- **画面名**: 各レコードの「フェーズ履歴」
- **スコープ**: 読み `phase_r`（＋ 束ねたリソースの `_r`）／ 書き `phase_w`
- **項目の接頭辞**: 無し（`Id` / `Resource` / `ResourceId` / `Phase` / `Date` のように裸）

## まず、どのリソースの履歴かを束ねる

PORTERS は Phase の読み書きすべてに「どのリソースか」を要求します。ライブラリはそれを `of()` で 1 回だけ受け取り、
以降の呼び出しに載せます。名前はアクセサと同じ綴りで、打ち間違いはコンパイルエラーです。

```ts
const phases = t.phase.of("candidate"); // 個人連絡先のフェーズ履歴
```

## 呼べるメソッド

このリソースで呼べるメソッドと、使い方の例です。

| 読み                           | 書き                                              |
| ------------------------------ | ------------------------------------------------- |
| `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |

```ts
const phases = t.phase.of("candidate");

const page = await phases.search({
  condition: { ResourceId: { eq: 10001 } }, // 1 レコードの履歴
  order: [{ Date: "desc" }],
});
const latest = page.items.find((p) => p.Recent === 1);
console.log(latest?.Phase, latest?.Date);
```

## 固有の注意

このリソースだけに効く注意です。共通の規則（検索・書き込み・上限）は主題別のページにあります。

- **`search` / `searchAll` に `keywords` と `itemstate` はありません**。PORTERS の Phase Read がその 2 つを受けないためです。
- **書き込みの入力に `Resource` と `Id` はありません。** `of()` で束ねた値と新規作成の印を、ライブラリが埋めます。
- **フェーズ日付・メモはフェーズとセット**で書きます。既存の履歴があるレコードでは、最新フェーズに対する条件
  （日付が最新より新しいこと、など）を満たさないと PORTERS が Result Code で返します。
- **`JobOwner` などの 4 項目は Process と Sales の履歴にだけあります**（`JobOwner` / `JobOwnerDepartment` / `ResumeOwner` / `ResumeOwnerDepartment`）。
- **`Id` はリソースごとの連番です。** 別のリソースの履歴と同じ `Id` が付くことがあります。
- **`Recent` が `1` の行が最新です**（`0` は過去）。

## 新規作成の必須項目

`create` の必須項目（無条件か、条件付きか）と、渡さないとどこで止まるかです。表にあるのは呼び出し側が渡す項目だけです。

| 項目         | 必須の種類        | どこで止まるか               |
| ------------ | ----------------- | ---------------------------- |
| `ResourceId` | ●（無条件で必須） | 渡さないとコンパイルで止まる |

●（無条件で必須）は `create` の入力型が要求し、渡さないとコンパイルで止まります。※（条件付き必須）は
他のレコードの状態に依存するため型では止めず、PORTERS の判定に委ねます（[書き込み][write]の「型で止めないもの」）。
`Id` と `Resource` も出典では必須ですが、渡しません。`Id` はライブラリが新規作成の印を、`Resource` は `of()` で束ねた値を埋めます。

このリソースに ※（条件付き必須）の項目はありません。

フェーズ・日付・メモの組み合わせに条件はありますが、それは「固有の注意」にあります。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 項目の一覧: [Phase の項目][ref]（PORTERS の事実）
- カスタム項目（`U_` / `A_`）: ありません

| 型                                       | 役割                            |
| ---------------------------------------- | ------------------------------- |
| [`Phase`][t-Phase]                       | 読み取った 1 件                 |
| [`PhaseCreateInput`][t-PhaseCreateInput] | `create` / `createMany` の入力  |
| [`PhaseUpdateInput`][t-PhaseUpdateInput] | `update` / `updateMany` の入力  |
| [`PhaseSearchQuery`][t-PhaseSearchQuery] | `search` / `searchAll` のクエリ |
| [`PhasePage`][t-PhasePage]               | `search` の戻り値（1 ページ）   |
| [`PhaseAccessor`][t-PhaseAccessor]       | `t.phase` の型（`of()` を持つ） |
| [`PhaseResource`][t-PhaseResource]       | `t.phase.of(...)` の型          |

## 関連

- 主題: [検索][query]（条件の書き方）／[書き込み][write]（必須と一括）／[削除と削除済みデータ][deleted]（`itemstate` は無い）
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/phase.md
[query]: ../topics/query.md
[write]: ../topics/write.md
[deleted]: ../topics/deleted.md
[resources]: README.md
[index]: ../index.md
[t-Phase]: ../api/type-aliases/Phase.md
[t-PhaseCreateInput]: ../api/type-aliases/PhaseCreateInput.md
[t-PhaseUpdateInput]: ../api/type-aliases/PhaseUpdateInput.md
[t-PhaseSearchQuery]: ../api/type-aliases/PhaseSearchQuery.md
[t-PhasePage]: ../api/type-aliases/PhasePage.md
[t-PhaseAccessor]: ../api/type-aliases/PhaseAccessor.md
[t-PhaseResource]: ../api/type-aliases/PhaseResource.md
