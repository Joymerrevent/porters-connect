# ドキュメント

`@joymerrevent/porters-connect` — PORTERS Connect API を TypeScript から型安全に扱う**非公式**ラッパー。

このページが**ドキュメントの目次**です<!-- 根拠: ADR-0070・ADR-0072 -->。構成は 4 層で、
上から順に「**繋ぐ → やりたいことをやる → 前提を深く知る → 細部を引く**」になっています。

---

## 入門 — 順に読む

**PORTERS と契約済み**の人が、自分のアプリを繋ぐまでの順路です。上から順に読んでください。

| ページ                                            | 内容                                                    |
| ------------------------------------------------- | ------------------------------------------------------- |
| [始める前に — PORTERS 側で用意するもの][s-prereq] | 契約・アプリ登録・3 つの値・Company DB・スコープ        |
| [インストールと、クライアントの構築][s-install]   | `npm i` と、受け取った 3 つの値の渡し方                 |
| [認証を通して、疎通を確認する][s-auth]            | 初回だけブラウザで 1 回。以降は無人。**繋がった**の確認 |
| [はじめての読み取り][s-read]                      | `tenant(id)` ／ `search` ／ `get` ／ `field` の効き方   |
| [はじめての書き込み][s-write]                     | `create` と `update`。`delete` が無いということ         |
| [本番に出す前に][s-live]                          | 機密情報・Partition・トークン・上限・失敗・差分取得     |

契約や権限付与を待っている間に書き始めたいなら、[契約なしでテストを書きたい][test-without-contract]
から入れます。

## 目的別 — 「〜したい」

| ページ                                                    | 内容                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [認証を通したい][authenticate]                            | 初回の権限付与（ブラウザで 1 回）→ `tokenStore` での永続化 → 権限の削除                  |
| [条件でレコードを探したい][search-records]                | `field` ／ `expand` ／ `condition` ／ `order` ／ `keywords` ／ `itemstate` ／ ページング |
| [200 件を超える書き込みをしたい][bulk-write]              | `createMany` ／ `updateMany`。自動分割と、部分成功の戻り値                               |
| [テナント固有の項目を型付きで扱いたい][custom-fields]     | `defineFields` で `U_` ／ `A_` を宣言する。自動生成と、テナントとの突合                  |
| [複数テナントを 1 プロセスで扱いたい][multi-tenant]       | `porters.tenant(id)` で束ねる。認証を分ける場合と、partition の発見                      |
| [失敗したときに落とす／続けるを決めたい][handle-failures] | エラーの型と `category`。症状 → 原因 → 対処の早見表                                      |
| [添付ファイルを扱いたい][attachments]                     | `t.attachment.of(...)` で束ねる。本体は `get` でしか取れない。10MB が上限                |
| [毎日同期するバッチを書きたい][sync-batch]                | 差分を取る → 書き戻す → 失敗からの再開。レートは自制される                               |
| [契約なしでテストを書きたい][test-without-contract]       | トランスポートを 1 箇所差し替える。モックし忘れは黙って通らない                          |

## 考え方 — PORTERS 固有の前提

このライブラリの難所は API の形ではなく、**PORTERS 側の前提**です。目的別より後ろに置いて
ありますが、**一度読んでおくと上の手順が短く読めます**（詰まってから読む節ではありません）。

| ページ                                         | 内容                                                 |
| ---------------------------------------------- | ---------------------------------------------------- |
| [Partition（Company DB）とテナント][partition] | データは Partition に分かれる。`tenant(id)` で束ねる |
| [alias と Data Type][aliases]                  | `P_` / `U_` / `A_` と、値の形（読みと書きで違う）    |
| [日時は UTC][datetime]                         | ISO 8601 で入出力する。業務タイムゾーンは扱わない    |
| [削除 API が無いということ][no-delete]         | 消せない。ただし削除済みは読める                     |
| [上限][limits]                                 | 長さ・件数・レートの上限と、どこで弾かれるか         |

## リソース別 — 1 リソース 1 ページ

`porters.tenant(id)` で束ねたスコープ（`t`）の下にある 18 リソースを、**同じ節構成**（呼べるメソッド →
固有の注意 → 新規作成の必須項目 → 項目と型）で 1 ページずつ置いています。**呼べるメソッドは行ごとに違う**ので、
まず [リソースと操作][resources] の表で確かめてください。

| データ系（読み書き）                                                                                                                                                                                                                                                                                                       | マスタ系（読み取り専用）                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [Candidate][r-candidate] ／ [Job][r-job] ／ [Client][r-client] ／ [Recruiter][r-recruiter] ／ [Contact][r-contact] ／ [Opportunity][r-opportunity] ／ [Activity][r-activity] ／ [Contract][r-contract] ／ [Sales][r-sales] ／ [Process][r-process] ／ [Resume][r-resume] ／ [Phase][r-phase] ／ [Attachment][r-attachment] | [Partition][r-partition] ／ [User][r-user] ／ [Department][r-department] ／ [Field][r-field] ／ [Option][r-option] |

## リファレンス — 細部を引く

| ページ                          | 何の正典か                                           |
| ------------------------------- | ---------------------------------------------------- |
| [公開 API の全記号][api]        | このライブラリの型・関数・メソッド（JSDoc から生成） |
| [PORTERS API の事実][reference] | PORTERS 側の仕様（項目・Result Code・書式）          |

---

開発・保守のための資料（ADR・設計・ロードマップ・台帳）は [docs/README.md][docs-readme] にまとめてあります。

[api]: api/index.md
[authenticate]: topics/auth.md
[bulk-write]: topics/write.md
[custom-fields]: topics/custom-fields.md
[handle-failures]: topics/errors.md
[attachments]: resources/attachment.md
[aliases]: topics/fields.md
[datetime]: topics/datetime.md
[limits]: topics/limits.md
[no-delete]: topics/deleted.md
[partition]: topics/tenant.md
[multi-tenant]: recipes/multi-tenant.md
[s-auth]: start/authenticate.md
[s-install]: start/install.md
[s-live]: start/going-live.md
[s-prereq]: start/prerequisites.md
[s-read]: start/first-read.md
[s-write]: start/first-write.md
[reference]: reference/README.md
[search-records]: topics/query.md
[docs-readme]: ../README.md
[sync-batch]: recipes/sync-batch.md
[test-without-contract]: topics/testing.md
[resources]: resources/README.md
[r-candidate]: resources/candidate.md
[r-job]: resources/job.md
[r-client]: resources/client.md
[r-recruiter]: resources/recruiter.md
[r-contact]: resources/contact.md
[r-opportunity]: resources/opportunity.md
[r-activity]: resources/activity.md
[r-contract]: resources/contract.md
[r-sales]: resources/sales.md
[r-process]: resources/process.md
[r-resume]: resources/resume.md
[r-phase]: resources/phase.md
[r-attachment]: resources/attachment.md
[r-partition]: resources/partition.md
[r-user]: resources/user.md
[r-department]: resources/department.md
[r-field]: resources/field.md
[r-option]: resources/option.md
