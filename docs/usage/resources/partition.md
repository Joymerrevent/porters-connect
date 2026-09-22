# Partition（Company DB）

Company DB の一覧です。データはすべていずれかの Partition に属し、`porters.tenant(id)` に渡す id はここで探します。

- **アクセサ**: `porters.partition`（**client 直下**。`tenant()` を通さない）
- **スコープ**: `partition_r`
- **読み取り専用**（PORTERS に Write API が無い）

## 呼べるメソッド

このリソースで呼べるメソッドと、使い方の例です。

| 読み                   | 書き              |
| ---------------------- | ----------------- |
| `search` / `searchAll` | —（読み取り専用） |

```ts
const page = await porters.partition.search(); // このトークンでアクセスできる Partition
for (const p of page.items) console.log(p.P_Id, p.P_Name);

const t = porters.tenant(page.items[0]?.P_Id ?? 0); // 以降はこのスコープで読み書き
```

マスタ 5 種は語彙が違います。`condition` と `get(id)` はありません（[検索][query]の「マスタは語彙が違う」）。

## 固有の注意

このリソースだけに効く注意です。共通の規則（検索・書き込み・上限）は主題別のページにあります。

- **`tenant()` を通さない唯一の読み取り**です。Partition を探すための呼び出しなので、Partition を要求しません。
- **ログイン中の Partition は取れません**。PORTERS の `request_type=0` はブラウザ経由の認証（`code`）でしか使えず、ライブラリの既定であるサーバ間認証（`code_direct`）では Result Code `403` になります。アクセスできる一覧（既定の `requestType: 1`）から選んでください。
- 項目は `P_Id` / `P_Name` / `P_CompanyId` の 3 つです。

## 新規作成の必須項目

このリソースは読み取り専用なので、`create` はありません。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 項目の一覧: [Partition の項目][ref]（PORTERS の事実）
- カスタム項目（`U_` / `A_`）: ありません

| 型                                               | 役割                                      |
| ------------------------------------------------ | ----------------------------------------- |
| [`Partition`][t-Partition]                       | 読み取った 1 件                           |
| [`PartitionPage`][t-PartitionPage]               | `search` の戻り値（1 ページ）             |
| [`PartitionSearchQuery`][t-PartitionSearchQuery] | `search` / `searchAll` のクエリ           |
| [`PartitionResource`][t-PartitionResource]       | `porters.partition` の型                  |
| [`PartitionId`][t-PartitionId]                   | Partition の id の型（`tenant()` の引数） |

## 関連

- 主題: [Partition とテナントスコープ][tenant]
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/partition.md
[resources]: README.md
[index]: ../index.md
[tenant]: ../topics/tenant.md
[query]: ../topics/query.md
[t-Partition]: ../api/type-aliases/Partition.md
[t-PartitionPage]: ../api/type-aliases/PartitionPage.md
[t-PartitionSearchQuery]: ../api/type-aliases/PartitionSearchQuery.md
[t-PartitionResource]: ../api/type-aliases/PartitionResource.md
[t-PartitionId]: ../api/type-aliases/PartitionId.md
