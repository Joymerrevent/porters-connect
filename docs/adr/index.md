# ADR 索引

`@joymerrevent/porters-connect` の設計判断（ADR）の一覧です。**運用ルール・書き方・論点バックログは
[README][readme]** にあります。本ファイルは**一覧テーブルだけ**を置く場所で、散文は書きません
（[ADR-0053][0053]）。

- **ステータス**の正は各 ADR 本文の `- Status:`、**実装**の正は各 ADR 本文の `- Implemented:` です。
  本表とのズレは `pnpm check:index` が検出し、CI で落とします。
- **実装** 列は「その決定がどの版で世に出たか」。`—` は**特定の版に紐づけていない**ことを表します
  （プロセス決定で実装の概念が無いもの、または MVP 期に段階的に実装され CHANGELOG が版を明示していないもの）。
  記入は [CHANGELOG][changelog] が版を明示している分に限っています。

| #            | タイトル                                                         | フェーズ | ステータス | 実装  |
| ------------ | ---------------------------------------------------------------- | -------- | ---------- | ----- |
| [0001][0001] | ADR で設計判断を記録する                                         | プロセス | accepted   | —     |
| [0002][0002] | v1 設計を実 PORTERS API ドキュメントに接地する                   | プロセス | accepted   | —     |
| [0003][0003] | MVP の対象リソースに Attachment を加える                         | 要件定義 | accepted   | —     |
| [0004][0004] | リソース／フィールドの型モデル（P\_ ＋ U\_/A\_）                 | 基本設計 | accepted   | —     |
| [0005][0005] | 公開 API の形（client・アクセサ・宣言 DSL・返り値/エラー）       | 基本設計 | accepted   | —     |
| [0006][0006] | エラーモデル（PortersError・category・リトライ可否）             | 基本設計 | accepted   | —     |
| [0007][0007] | OAuth 認証の公開 API（code/code_direct・トークン管理）           | 基本設計 | accepted   | —     |
| [0008][0008] | マルチテナント運用とパーティション選択                           | 基本設計 | accepted   | —     |
| [0009][0009] | HTTP トランスポート（既定 fetch・注入 seam）                     | 詳細設計 | accepted   | —     |
| [0010][0010] | リトライ／スロットリングの機構                                   | 詳細設計 | accepted   | —     |
| [0011][0011] | XML パース／シリアライズ内部                                     | 詳細設計 | accepted   | —     |
| [0012][0012] | トークンのキャッシュ／更新機構（既定ストラテジ内部）             | 詳細設計 | accepted   | —     |
| [0013][0013] | コーディング規約（クラス/関数・関数スタイル・型定義）            | プロセス | accepted   | —     |
| [0014][0014] | テストカバレッジ方針（計測・閾値・CI 強制）                      | プロセス | accepted   | —     |
| [0015][0015] | ミューテーションテスト（Stryker）でテスト品質を測る              | プロセス | accepted   | —     |
| [0016][0016] | 内部 FieldType の粒度（Field Type か Data Type か）              | 詳細設計 | accepted   | —     |
| [0017][0017] | Option の読み取り値の表現（複数選択対応）                        | 詳細設計 | accepted   | —     |
| [0018][0018] | Attachment リソースとファイル本体（Base64）の扱い                | 詳細設計 | accepted   | —     |
| [0019][0019] | 静的リソース型の実装（カタログ導出の Read/Write 型・SD-3）       | 詳細設計 | accepted   | —     |
| [0020][0020] | Read の field 既定挙動（省略時はカタログ導出の既定 field）       | 詳細設計 | accepted   | —     |
| [0021][0021] | マスタ Read の公開サーフェス（Partition/User/Field/Option）      | 詳細設計 | accepted   | —     |
| [0022][0022] | マスタ Read のクエリと current() を実 Read API に接地            | 詳細設計 | accepted   | —     |
| [0023][0023] | カスタム項目宣言 DSL（`defineFields`）の詳細設計（R-16）         | 詳細設計 | accepted   | 0.1.0 |
| [0024][0024] | テスト/評価用の公開モックトランスポート（R-17/R-12）             | 詳細設計 | accepted   | 0.1.0 |
| [0025][0025] | CI/CD リリース自動化戦略（changesets・git-flow 維持）            | プロセス | accepted   | —     |
| [0026][0026] | CHANGELOG 生成方式（手書き vs changesets）                       | プロセス | accepted   | —     |
| [0027][0027] | リリース前ゲート（整合性・公開正当性）                           | プロセス | accepted   | 0.2.1 |
| [0028][0028] | CI のパスベース最適化（docs skip）                               | プロセス | accepted   | 0.2.1 |
| [0029][0029] | リリースのタグ付け・back-merge 自動化                            | プロセス | accepted   | 0.2.1 |
| [0030][0030] | back-merge 方式の改訂（ADR-0029 案F）                            | プロセス | accepted   | —     |
| [0031][0031] | リリース版番号の自動検証（semver・単調増加）                     | プロセス | accepted   | 0.2.1 |
| [0032][0032] | 単調増加検証を base=main の PR に限定（ADR-0031 (2) 改訂）       | プロセス | accepted   | 0.2.1 |
| [0033][0033] | ポスト MVP の次の注力領域（v0.2 以降）                           | 要件定義 | superseded | —     |
| [0034][0034] | OAuth 公開 API porters.auth.\* の詳細設計（F-1）                 | 詳細設計 | accepted   | 0.3.0 |
| [0035][0035] | 利用ドキュメントの構成（README と docs/guide の役割分担）        | プロセス | accepted   | —     |
| [0036][0036] | refresh 失効時は code_direct 自動再取得（0007/0012 amend）       | 詳細設計 | accepted   | —     |
| [0037][0037] | commitlint CI をフィーチャー PR に限定（base=main を除外）       | プロセス | superseded | —     |
| [0038][0038] | Read クエリ condition/order/keywords/itemstate（F-2）            | 詳細設計 | accepted   | 0.4.0 |
| [0039][0039] | commitlint scope 改訂：release 範囲限定＋PR タイトル lint        | プロセス | accepted   | —     |
| [0040][0040] | マルチテナント tenant(id) スコープ（F-3）                        | 詳細設計 | accepted   | 0.5.0 |
| [0041][0041] | 一括書き込み createMany / updateMany（F-4）                      | 詳細設計 | accepted   | 0.6.0 |
| [0042][0042] | 対応 PORTERS/API バージョン表記方針（v2 を契約の正）             | 要件定義 | accepted   | —     |
| [0043][0043] | ローカル フェイクサーバー（忠実度ポリシー・提供形態）            | 詳細設計 | accepted   | —     |
| [0044][0044] | HTTP ステータスをエラーモデルに配線する（RV-13）                 | 詳細設計 | accepted   | 0.7.0 |
| [0045][0045] | Write 応答のルート `<Code>` の扱い（RV-14）                      | 詳細設計 | accepted   | 0.7.0 |
| [0046][0046] | 送信前ガードの例外契約（同期 throw か reject か・RV-15）         | 基本設計 | accepted   | 0.7.0 |
| [0047][0047] | アクセスポイント / scheme 設定（http を許す条件）                | 基本設計 | accepted   | 0.7.0 |
| [0048][0048] | アクセスポイント `host` の書式検証（RV-17）                      | 基本設計 | accepted   | 0.7.0 |
| [0049][0049] | `host` 書式検証で既定ポートを落とさない（RV-21）                 | 基本設計 | accepted   | 0.7.0 |
| [0050][0050] | 認証 API 経路にも HTTP ステータスを配線（RV-19）                 | 詳細設計 | accepted   | 0.7.0 |
| [0051][0051] | Read 応答を PORTERS の envelope と同定する（RV-20）              | 詳細設計 | accepted   | 0.8.0 |
| [0052][0052] | レビュー指摘台帳の構成（単一ファイル vs 1 件 1 ファイル）        | プロセス | accepted   | —     |
| [0053][0053] | ADR 索引の分離と実装状態の列化                                   | プロセス | accepted   | —     |
| [0054][0054] | スナップショットと台帳の役割分担（内容重複の解消）               | プロセス | accepted   | —     |
| [0055][0055] | `partition` が束ねられていない呼び出しの扱い（RV-25）            | 基本設計 | accepted   | —     |
| [0056][0056] | `P_Deleted`（削除フラグ）の扱い（RV-26）                         | 詳細設計 | accepted   | —     |
| [0057][0057] | `itemstate: "existing"` の明示指定を送るか（0038 SD-4 の amend） | 詳細設計 | accepted   | —     |
| [0058][0058] | `System[Reference]` を展開して読むときの扱い（RV-31）            | 基本設計 | accepted   | —     |
| [0059][0059] | Read の `field` を接頭辞なしの alias で受ける                    | 基本設計 | accepted   | —     |
| [0060][0060] | 次の主軸を「全リソース網羅 ＋ ドキュメント充実」に変える         | 要件定義 | accepted   | —     |
| [0061][0061] | Phase の公開サーフェス（接頭辞なし・resource 必須）              | 詳細設計 | accepted   | —     |
| [0062][0062] | back-merge も PR を通す（ADR-0030 の実行方式を改訂）             | プロセス | accepted   | —     |

[readme]: README.md
[changelog]: ../../CHANGELOG.md
[0001]: 0001-record-architecture-decisions.md
[0002]: 0002-ground-design-in-live-api-docs.md
[0003]: 0003-add-attachment-to-mvp.md
[0004]: 0004-field-type-model.md
[0005]: 0005-public-api-shape.md
[0006]: 0006-error-model.md
[0007]: 0007-oauth-public-surface.md
[0008]: 0008-multitenancy-partition.md
[0009]: 0009-http-transport.md
[0010]: 0010-retry-throttle.md
[0011]: 0011-xml-parse-serialize.md
[0012]: 0012-token-cache-refresh.md
[0013]: 0013-coding-conventions-class-vs-function.md
[0014]: 0014-test-coverage-policy.md
[0015]: 0015-mutation-testing.md
[0016]: 0016-field-type-granularity.md
[0017]: 0017-option-read-shape.md
[0018]: 0018-attachment-design.md
[0019]: 0019-static-resource-types.md
[0020]: 0020-read-field-default.md
[0021]: 0021-master-read-resources.md
[0022]: 0022-master-read-query-surface.md
[0023]: 0023-custom-field-declaration-dsl.md
[0024]: 0024-mock-transport.md
[0025]: 0025-release-automation.md
[0026]: 0026-changelog-format.md
[0027]: 0027-release-readiness-gate.md
[0028]: 0028-ci-path-filtering.md
[0029]: 0029-release-tag-automation.md
[0030]: 0030-backmerge-method.md
[0031]: 0031-version-number-validation.md
[0032]: 0032-monotonic-check-release-scope.md
[0033]: 0033-post-mvp-direction.md
[0034]: 0034-oauth-public-surface-impl.md
[0035]: 0035-usage-documentation-structure.md
[0036]: 0036-refresh-expiry-reacquire.md
[0037]: 0037-commitlint-pr-scope.md
[0038]: 0038-read-query-surface-impl.md
[0039]: 0039-commitlint-release-range.md
[0040]: 0040-multitenancy-surface-impl.md
[0041]: 0041-bulk-write-surface-impl.md
[0042]: 0042-supported-version-policy.md
[0043]: 0043-local-fake-server.md
[0044]: 0044-http-status-handling.md
[0045]: 0045-write-response-root-code.md
[0046]: 0046-guard-error-contract.md
[0047]: 0047-access-point-scheme.md
[0048]: 0048-access-point-host-validation.md
[0049]: 0049-host-port-roundtrip.md
[0050]: 0050-auth-http-status-handling.md
[0051]: 0051-read-envelope-identification.md
[0052]: 0052-findings-register-layout.md
[0053]: 0053-adr-index-split.md
[0054]: 0054-snapshot-ledger-role-split.md
[0055]: 0055-partition-binding-guard.md
[0056]: 0056-deleted-flag-typing.md
[0057]: 0057-itemstate-existing-explicit.md
[0058]: 0058-reference-expansion-read.md
[0059]: 0059-read-field-bare-alias.md
[0060]: 0060-full-resource-coverage-direction.md
[0061]: 0061-phase-resource-surface.md
[0062]: 0062-backmerge-via-pull-request.md
