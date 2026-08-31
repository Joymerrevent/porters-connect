# レビュー指摘台帳（findings register）

このファイルは `/project-review` が更新する、全レビュー横断の指摘台帳の**索引**です。
**各指摘の本体は [`rv/`][rv] に 1 件 1 ファイル**で置きます（[ADR-0052][adr52]）。

- **ID は不変・ファイルは消さない**。確定したら各ファイルの「状態」と「処置」を更新します
  （運用は [docs/live-verification.md][lv] と同じ思想＝処置が追える）。
- **状態・重要度・観点の正は各ファイル**で、本表はその写しです。
  ズレは **`pnpm check:index`** が検出して CI で落とします（人の注意でなく仕組みで守る）。
- **新しい指摘を起票したら、本表にも 1 行足す**（行が無いと検査が落ちます）。

凡例 — 重要度: 🔴 High（実用ブロッカー級）/ 🟡 Medium / 🟢 Low ・ 状態: open / fixed / wontfix / deferred

## 一覧

| ID            | 重要度 | 観点                        | 状態  | 概要                                                              |
| ------------- | ------ | --------------------------- | ----- | ----------------------------------------------------------------- |
| [RV-1][rv1]   | 🔴     | API 忠実性                  | fixed | field 省略時の Read が主キーしか返さない                          |
| [RV-2][rv2]   | 🟡     | テスト厳密性                | fixed | field 無し search の fixture が本番と乖離                         |
| [RV-3][rv3]   | 🟡     | エラーモデル                | fixed | ErrorCategory の rateLimit が到達不能                             |
| [RV-4][rv4]   | 🟡     | リリース準備                | fixed | publishConfig.access と npm メタデータが未設定                    |
| [RV-5][rv5]   | 🟡     | API 忠実性                  | fixed | 送信前ガードの非対称                                              |
| [RV-6][rv6]   | 🟢     | テスト厳密性                | fixed | mock transport の既定 status 経路が未テスト                       |
| [RV-7][rv7]   | 🟢     | ドキュメント / DX           | fixed | 未モック時エラーメッセージが冗長                                  |
| [RV-8][rv8]   | 🟢     | アーキテクチャ              | fixed | 依存方向：resources → fields                                      |
| [RV-9][rv9]   | 🟡     | アーキテクチャ / リリース   | fixed | 単調増加チェックの baseline が back-merge ラグで誤検知            |
| [RV-10][rv10] | 🟡     | アーキテクチャ / DX         | fixed | per-call partition の JSDoc 偽宣言                                |
| [RV-11][rv11] | 🟡     | 認証                        | fixed | refresh 失効時の挙動が doc と乖離                                 |
| [RV-12][rv12] | 🟢     | ドキュメント                | fixed | roadmap/PRD の coverage 過大主張                                  |
| [RV-13][rv13] | 🟡     | エラーモデル / API 忠実性   | fixed | HTTP ステータスを一切見ていない                                   |
| [RV-14][rv14] | 🟡     | エラーモデル / API 忠実性   | fixed | Write のルート `<Code>` を読まない                                |
| [RV-15][rv15] | 🟢     | エラーモデル / DX           | fixed | 送信前ガードが同期 throw する経路がある                           |
| [RV-16][rv16] | 🟢     | ドキュメント                | fixed | 月次クォータを内蔵スロットルが守るかのような記述                  |
| [RV-17][rv17] | 🟡     | フェイルセーフ / 設定検証   | fixed | `host` の書式を検証せず、設定ミスが別ホストへの実リクエストになる |
| [RV-18][rv18] | 🟢     | ドキュメント / 計画         | fixed | accepted 済み ADR-0044〜0046 の実装が roadmap に現れない          |
| [RV-19][rv19] | 🟡     | エラーモデル / 認証         | fixed | 認証 API 経路が HTTP ステータスを見ない                           |
| [RV-20][rv20] | 🟡     | フェイルセーフ / API 忠実性 | fixed | HTTP 200 ＋ 非 PORTERS ボディが「空ページ」として通る             |
| [RV-21][rv21] | 🟢     | 設定検証 / 後方互換         | fixed | 既定ポート `:443` 付きの `host` が弾かれる                        |
| [RV-22][rv22] | 🟢     | リトライ / DX               | open  | HTTP 429 の後、非冪等な `create` が自動再送されない               |
| [RV-23][rv23] | 🔴     | API 忠実性 / 型安全         | fixed | Candidate の静的カタログが標準項目 4 件を欠く                     |
| [RV-24][rv24] | 🟡     | ドキュメント / DX           | fixed | `defineFields` の使い方がどこにも無い                             |
| [RV-25][rv25] | 🟡     | フェイルセーフ / 設定検証   | fixed | `partition` 未設定で無言のうちに `partition=0` を送る             |
| [RV-26][rv26] | 🟡     | API 忠実性                  | fixed | `P_Deleted` 未対応 ＝ 削除済みかを判別できない                    |
| [RV-27][rv27] | 🟢     | ドキュメント / DX           | fixed | F-2 だけトピック ガイドが無い                                     |
| [RV-28][rv28] | 🟢     | API 忠実性 / フェイルセーフ | fixed | `count` の範囲を送信前に検証しない                                |
| [RV-29][rv29] | 🟢     | テスト厳密性 / プロセス     | fixed | reference ↔ カタログの突合が自動化されていない                    |
| [RV-30][rv30] | 🟢     | 型安全 / 公開サーフェス     | fixed | 公開ジェネリクスの制約型が未 export                               |
| [RV-31][rv31] | 🟡     | API 忠実性 / 型安全         | fixed | System[Reference] を展開して要求しても ID 以外が捨てられる        |
| [RV-32][rv32] | 🟢     | フェイルセーフ / DX         | fixed | searchAll のクエリを反復中に書き換えると次ページ以降が変わる      |
| [RV-33][rv33] | 🟡     | プロセス / フェイルセーフ   | open  | back-merge が develop の保護ルールをバイパスして通る              |

> RV-10〜12 は横断監査（[2026-06-22-03][run3]）で検出したドリフト群。受け入れ済み ADR が定めた v1 公開 API の**未実装サーフェス**（OAuth `porters.auth.*` / Read クエリ `order`・`keywords`・`itemstate` / `tenant(id)`＋per-call `partition` / 200 件一括書き込み）は finding 化せず [ADR-0033][adr33] 案F（先行フェーズ）で扱う。

[adr52]: ../adr/0052-findings-register-layout.md
[rv]: rv
[adr33]: ../adr/0033-post-mvp-direction.md
[lv]: ../live-verification.md
[run3]: 2026-06-22-03.md
[rv1]: rv/0001-read-field-default-missing.md
[rv2]: rv/0002-fieldless-search-fixture-drift.md
[rv3]: rv/0003-unreachable-ratelimit-category.md
[rv4]: rv/0004-npm-publish-metadata.md
[rv5]: rv/0005-request-size-guard-read-url.md
[rv6]: rv/0006-mock-transport-default-status.md
[rv7]: rv/0007-mock-transport-route-message.md
[rv8]: rv/0008-resources-fields-dependency.md
[rv9]: rv/0009-monotonic-baseline-backmerge-lag.md
[rv10]: rv/0010-per-call-partition-jsdoc.md
[rv11]: rv/0011-refresh-expiry-behavior-drift.md
[rv12]: rv/0012-coverage-overclaim-docs.md
[rv13]: rv/0013-http-status-ignored.md
[rv14]: rv/0014-write-root-code-ignored.md
[rv15]: rv/0015-sync-throw-guards.md
[rv16]: rv/0016-monthly-quota-wording.md
[rv17]: rv/0017-host-format-unvalidated.md
[rv18]: rv/0018-roadmap-missing-adr-impl.md
[rv19]: rv/0019-auth-path-http-status.md
[rv20]: rv/0020-non-porters-body-empty-page.md
[rv21]: rv/0021-default-port-rejected.md
[rv22]: rv/0022-ratelimit-create-no-retry.md
[rv23]: rv/0023-candidate-catalog-missing-fields.md
[rv24]: rv/0024-define-fields-undocumented.md
[rv25]: rv/0025-partition-default-zero.md
[rv26]: rv/0026-deleted-flag-unsupported.md
[rv27]: rv/0027-read-query-guide-missing.md
[rv28]: rv/0028-count-range-unvalidated.md
[rv29]: rv/0029-reference-catalog-check-missing.md
[rv30]: rv/0030-generic-constraint-types-unexported.md
[rv31]: rv/0031-reference-expansion-discarded.md
[rv32]: rv/0032-searchall-query-mutation.md
[rv33]: rv/0033-backmerge-bypasses-branch-protection.md
