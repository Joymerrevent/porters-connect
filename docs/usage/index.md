# ドキュメント

`@joymerrevent/porters-connect` — PORTERS Connect API を TypeScript から型安全に扱う**非公式**ラッパー。

このページが**ドキュメントの目次**です（[ADR-0070][adr70]）。構成は 4 層で、上から順に
「**初めて触る → 前提を理解する → 目的を達する → 細部を引く**」になっています。

> **⚠️ 工事中です。** [ADR-0070][adr70] の構成のうち、**入門・考え方・目的別**まで書きました。
> 下の表で**未着手**と書いてあるページ（目的別の 3 ページ）はまだありません。

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

| したいこと                                 | ページ                                              |
| ------------------------------------------ | --------------------------------------------------- |
| **認証を通したい**（初回の権限付与まで）   | [認証][authenticate]                                |
| **条件でレコードを探したい**               | [検索][search-records]                              |
| **200 件を超える書き込みをしたい**         | [一括書き込み][bulk-write]                          |
| **テナント固有の項目を型付きで扱いたい**   | [カスタム項目][custom-fields]                       |
| **複数テナントを 1 プロセスで扱いたい**    | [マルチテナント][multi-tenant]                      |
| **失敗したときに落とす／続けるを決めたい** | [失敗の扱い][handle-failures]                       |
| 添付ファイルを扱いたい                     | **未着手**（[README][readme] に最小の例）           |
| 毎日同期するバッチを書きたい               | **未着手**                                          |
| テストを書きたい（契約なし）               | **未着手**（[フェイクサーバー手順書][fake] が近い） |

## リファレンス — 細部を引く

| ページ                          | 何の正典か                                           |
| ------------------------------- | ---------------------------------------------------- |
| [公開 API の全記号][api]        | このライブラリの型・関数・メソッド（JSDoc から生成） |
| [PORTERS API の事実][reference] | PORTERS 側の仕様（項目・Result Code・書式）          |

---

## この下は開発者向け

利用者向けではありません。

| ページ                         | 内容                                   |
| ------------------------------ | -------------------------------------- |
| [ADR][adr]                     | 設計判断の記録（なぜそうなっているか） |
| [基本設計・要件][design]       | モジュール構成・要件定義               |
| [ロードマップ][roadmap]        | 次に何をやるか                         |
| [レビュー指摘台帳][findings]   | 指摘と処置の記録                       |
| [ライブ検証][lv]               | 契約後に実機で確かめる仮定             |
| [フェイクサーバー手順書][fake] | 契約なしで動かす仕組み                 |
| [リリース手順][release]        | 公開の手順                             |

[adr]: ../adr/index.md
[adr70]: ../adr/0070-usage-documentation-architecture.md
[api]: api/index.md
[authenticate]: howto/authenticate.md
[bulk-write]: howto/bulk-write.md
[custom-fields]: howto/custom-fields.md
[design]: ../design/basic-design.md
[fake]: ../fake-server-runbook.md
[findings]: ../reviews/findings.md
[handle-failures]: howto/handle-failures.md
[aliases]: concepts/aliases.md
[datetime]: concepts/datetime.md
[limits]: concepts/limits.md
[no-delete]: concepts/no-delete.md
[partition]: concepts/partition.md
[lv]: ../live-verification.md
[multi-tenant]: howto/multi-tenant.md
[readme]: ../README.md
[s-auth]: start/authenticate.md
[s-install]: start/install.md
[s-live]: start/going-live.md
[s-read]: start/first-read.md
[s-write]: start/first-write.md
[reference]: reference/README.md
[release]: ../release-runbook.md
[roadmap]: ../roadmap.md
[search-records]: howto/search-records.md
