# ドキュメント

`@joymerrevent/porters-connect` — PORTERS Connect API を TypeScript から型安全に扱う**非公式**ラッパー。

このページが**ドキュメントの目次**です（[ADR-0070][adr70]）。構成は 4 層で、上から順に
「**初めて触る → 前提を理解する → 目的を達する → 細部を引く**」になっています。

> **⚠️ 工事中です。** [ADR-0070][adr70] の 4 層はすべて埋まりました。残っているのは
> **README を入口に絞る**作業（同 ADR の論点3）です。

---

## 入門 — 順に読む

初めて使うときは上から順に読んでください。

| ページ                                      | 内容                                                  |
| ------------------------------------------- | ----------------------------------------------------- |
| [1. インストールと、最初の 1 回][s-install] | 契約なしで動かす。返ってくる型を見る                  |
| [2. 認証を通す][s-auth]                     | 初回だけブラウザで 1 回。以降は無人                   |
| [3. はじめての読み取り][s-read]             | `tenant(id)` ／ `search` ／ `get` ／ `field` の効き方 |
| [4. はじめての書き込み][s-write]            | `create` と `update`。`delete` が無いということ       |
| [5. 本番に出す前に][s-live]                 | 秘密・Partition・トークン・上限・失敗・差分取得       |

## 考え方 — PORTERS 固有の前提

このライブラリの難所は API の形ではなく、**PORTERS 側の前提**です。ここを読んでおくと
目的別の手順が短く読めます。

| ページ                                         | 内容                                                 |
| ---------------------------------------------- | ---------------------------------------------------- |
| [Partition（Company DB）とテナント][partition] | データは Partition に分かれる。`tenant(id)` で束ねる |
| [alias と Data Type][aliases]                  | `P_` / `U_` / `A_` と、値の形（読みと書きで違う）    |
| [日時は UTC][datetime]                         | ISO 8601 で入出力する。業務タイムゾーンは扱わない    |
| [削除 API が無いということ][no-delete]         | 消せない。ただし削除済みは読める                     |
| [上限][limits]                                 | 長さ・件数・レートの上限と、どこで弾かれるか         |

## 目的別 — 「〜したい」

| したいこと                                 | ページ                                |
| ------------------------------------------ | ------------------------------------- |
| **認証を通したい**（初回の権限付与まで）   | [認証][authenticate]                  |
| **条件でレコードを探したい**               | [検索][search-records]                |
| **200 件を超える書き込みをしたい**         | [一括書き込み][bulk-write]            |
| **テナント固有の項目を型付きで扱いたい**   | [カスタム項目][custom-fields]         |
| **複数テナントを 1 プロセスで扱いたい**    | [マルチテナント][multi-tenant]        |
| **失敗したときに落とす／続けるを決めたい** | [失敗の扱い][handle-failures]         |
| **添付ファイルを扱いたい**                 | [添付ファイル][attachments]           |
| **毎日同期するバッチを書きたい**           | [毎日の同期][sync-batch]              |
| **契約なしでテストを書きたい**             | [テストを書く][test-without-contract] |

## リソースと操作

`porters.tenant(id)` で束ねたスコープ（`t`）の下にあります。**メソッドは行ごとに違う**ので、
呼べるものはこの表で確かめてください。

| アクセサ           | リソース       | メソッド                                                                                       |
| ------------------ | -------------- | ---------------------------------------------------------------------------------------------- |
| `t.candidate`      | 個人連絡先     | `search` / `searchAll` / `get` / `create` / `update`                                           |
| `t.job`            | JOB            | `search` / `searchAll` / `get` / `create` / `update`                                           |
| `t.client`         | 企業           | `search` / `searchAll` / `get` / `create` / `update`                                           |
| `t.recruiter`      | 企業担当者     | `search` / `searchAll` / `get` / `create` / `update`                                           |
| `t.contact`        | コンタクト     | `search` / `searchAll` / `get` / `create` / `update`                                           |
| `t.opportunity`    | 商談管理       | `search` / `searchAll` / `get` / `create` / `update`                                           |
| `t.activity`       | アクティビティ | `search` / `searchAll` / `get` / `create` / `update`                                           |
| `t.contract`       | 契約           | `search` / `searchAll` / `get` / `create` / `update`                                           |
| `t.sales`          | 成約・売上     | `search` / `searchAll` / `get` / `create` / `update`                                           |
| `t.process`        | 選考プロセス   | `search` / `searchAll` / `get` / `create` / `update`                                           |
| `t.resume`         | レジュメ       | `search` / `searchAll` / `get` / `create` / `update`                                           |
| `t.attachment`     | 添付ファイル   | `search` / `get` / `create` / `update`（**`searchAll` なし**）                                 |
| `t.phase.of(名前)` | フェーズ履歴   | `search` / `searchAll` / `get` / `create` / `update`（**先に `of()` で上位リソースを束ねる**） |

データ系 13 種はすべて **`create` と `update` を持ち、`delete` は持ちません**（[削除 API が無いということ][no-delete]）。

マスタ 4 種は**読み取り専用**で、語彙も違います（`condition` と `get(id)` がありません）。

| アクセサ            | リソース                | メソッド                                 |
| ------------------- | ----------------------- | ---------------------------------------- |
| `porters.partition` | Partition（Company DB） | `search` / `searchAll` — **client 直下** |
| `t.user`            | User                    | `search` / `searchAll` / `current`       |
| `t.field`           | Field（項目定義）       | `search` / `searchAll`                   |
| `t.option`          | Option（選択肢）        | `search`（**`searchAll` なし**）         |

引数・戻り値・項目の一覧は [公開 API の全記号][api] が正典です。クエリの書き方は
[検索][search-records]、添付の扱いは[添付ファイル][attachments]にあります。

## リファレンス — 細部を引く

| ページ                          | 何の正典か                                           |
| ------------------------------- | ---------------------------------------------------- |
| [公開 API の全記号][api]        | このライブラリの型・関数・メソッド（JSDoc から生成） |
| [PORTERS API の事実][reference] | PORTERS 側の仕様（項目・Result Code・書式）          |

---

開発・保守のための資料（ADR・設計・ロードマップ・台帳）は [docs/README.md][docs-readme] にまとめてあります。

[adr70]: ../adr/0070-usage-documentation-architecture.md
[api]: api/index.md
[authenticate]: howto/authenticate.md
[bulk-write]: howto/bulk-write.md
[custom-fields]: howto/custom-fields.md
[handle-failures]: howto/handle-failures.md
[attachments]: howto/attachments.md
[aliases]: concepts/aliases.md
[datetime]: concepts/datetime.md
[limits]: concepts/limits.md
[no-delete]: concepts/no-delete.md
[partition]: concepts/partition.md
[multi-tenant]: howto/multi-tenant.md
[s-auth]: start/authenticate.md
[s-install]: start/install.md
[s-live]: start/going-live.md
[s-read]: start/first-read.md
[s-write]: start/first-write.md
[reference]: reference/README.md
[search-records]: howto/search-records.md
[docs-readme]: ../README.md
[sync-batch]: howto/sync-batch.md
[test-without-contract]: howto/test-without-contract.md
