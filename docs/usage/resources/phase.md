# Phase（フェーズ履歴）

- **アクセサ**: `t.phase.of("candidate")` のように、**どのリソースの履歴かを先に束ねる**
- **画面名**: 各レコードの「フェーズ履歴」
- **スコープ**: 読み `phase_r`（＋ 束ねたリソースの `_r`）／ 書き `phase_w`
- **項目の接頭辞**: 無し（`Id` / `Resource` / `ResourceId` / `Phase` / `Date` のように裸）

フェーズの変更履歴です。データ系リソースのレコードごとに積み上がり、レコード側の `P_Phase` を書き換えると行が増えます。

## まず、どのリソースの履歴かを束ねる

PORTERS は Phase の読み書きすべてに「どのリソースか」を要求します。ライブラリはそれを `of()` で 1 回だけ受け取り、
以降の呼び出しに載せます。名前はアクセサと同じ綴りで、打ち間違いはコンパイルエラーです。

```ts
const phases = t.phase.of("candidate"); // 個人連絡先のフェーズ履歴
```

## 呼べるメソッド

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
- 書き込みの入力に `Resource` はありません。`of()` で束ねた値をライブラリが埋めます。`Id` も同じです。
- **フェーズ日付・メモはフェーズとセット**で書きます。既存の履歴があるレコードでは、最新フェーズに対する条件
  （日付が最新より新しいこと、など）を満たさないと PORTERS が Result Code で返します。
- `JobOwner` / `JobOwnerDepartment` / `ResumeOwner` / `ResumeOwnerDepartment` は **Process と Sales の履歴にだけ**あります。
- `Id` はリソースごとの連番です。別のリソースの履歴と同じ `Id` が付くことがあります。
- `Recent` が `1` の行が最新、`0` が過去のフェーズです。

## 新規作成の必須項目

| 項目         | 必須の種類        | どこで止まるか                                  |
| ------------ | ----------------- | ----------------------------------------------- |
| `ResourceId` | ●（無条件で必須） | 渡さないとコンパイルで止まる                    |
| `Id`         | ●（出典では必須） | 渡さない。ライブラリが新規作成の印を埋める      |
| `Resource`   | ●（出典では必須） | 渡さない。`of()` で束ねた値をライブラリが埋める |

●（無条件で必須）は `create` の入力型が要求し、渡さないとコンパイルで止まります。このリソースに ※（条件付き必須）の
項目はありません。フェーズ・日付・メモの組み合わせに条件はありますが、それは「固有の注意」にあります。

## 項目と型

- 項目の一覧: [Phase の項目][ref]（PORTERS の事実）
- 型: [`Phase`][t-read]（読み取り）／ [`PhaseCreateInput`][t-create] ／ [`PhaseUpdateInput`][t-update] ／
  [`PhaseSearchQuery`][t-query] ／ [`PhasePage`][t-page] ／ [`PhaseAccessor`][t-accessor] ／ [`PhaseResource`][t-resource]
- カスタム項目はありません（固定項目のみ）

## 関連

- 主題: [検索][query]／[書き込み][write]／[削除と削除済みデータ][deleted]
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/phase.md
[t-read]: ../api/type-aliases/Phase.md
[t-create]: ../api/type-aliases/PhaseCreateInput.md
[t-update]: ../api/type-aliases/PhaseUpdateInput.md
[t-query]: ../api/type-aliases/PhaseSearchQuery.md
[t-page]: ../api/type-aliases/PhasePage.md
[t-accessor]: ../api/type-aliases/PhaseAccessor.md
[t-resource]: ../api/type-aliases/PhaseResource.md
[query]: ../topics/query.md
[write]: ../topics/write.md
[deleted]: ../topics/deleted.md
[resources]: README.md
[index]: ../index.md
