# Architecture Decision Records (ADR)

このディレクトリは `@joymerrevent/porters-connect` の設計判断を、決めた理由ごと残す場所です。
`docs/history/SPEC_v1.md` は**素案**であり、ここで議論・確定した内容が正となります。

## ADR とは

「なぜその設計にしたか」を 1 判断 1 ファイルで残す軽量な記録です。
コードを読んでも分からない「選ばなかった選択肢」と「その理由」を未来の自分／貢献者に伝えます。
形式は [MADR（Markdown Any Decision Records）][madr-markdown-any-decision-records] のフル版に準拠します。

## 運用ルール

- 1 判断 = 1 ファイル。ファイル名は `NNNN-kebab-title.md`（連番 + 内容）。
- **番号は ADR を起票する時に採番**する（その時点の最大番号 + 1）。**連番のみ・欠番や振り直し・再利用はしない**。
  バックログには番号を振らない（差し込みのたびに番号と参照を直す事故を防ぐため）。
- **未起票の ADR を参照するときは番号でなくトピック名で指す**（例: 「→ 型設計の ADR」）。起票後にリンクへ更新してよい。
- **ADR は自己完結させない**。フローは **起票（`proposed`）→ チームで議論 → 決定を反映（`accepted`）**。
  個人や AI が単独で `accepted` にしない。**決定事項の反映（`CLAUDE.md` / `SPEC` などの更新）は `accepted` 後**に行う。
- ステータスは次のいずれか：`proposed`（議論中）/ `accepted`（確定）/ `rejected`（不採用）/ `deprecated`（廃止）/ `superseded by NNNN`（後続で置換）。
- 一度 `accepted` した ADR は**書き換えず**、変えたくなったら新しい ADR を起こして旧 ADR を `superseded by NNNN` にする。
- 雛形は [`0000-template.md`][0000-template-md]（MADR フル）をコピーして使う。
- セクション構成：Context and Problem Statement → Decision Drivers → Considered Options → Decision Outcome（+ Consequences）→ Pros and Cons of the Options → More Information。

## フェーズ凡例

各 ADR / バックログ項目に**フェーズ**を付ける：**プロセス**（進め方・メタ）／ **要件定義**（何を作るか・PRD 担当）／ **基本設計**（外部仕様・全体像：公開 API・型・エラー・認証面・層責務）／ **詳細設計**（内部実装・実装フェーズで決める）。

## 一覧

| #            | タイトル                                                    | フェーズ | ステータス |
| ------------ | ----------------------------------------------------------- | -------- | ---------- |
| [0001][0001] | ADR で設計判断を記録する                                    | プロセス | accepted   |
| [0002][0002] | v1 設計を実 PORTERS API ドキュメントに接地する              | プロセス | accepted   |
| [0003][0003] | MVP の対象リソースに Attachment を加える                    | 要件定義 | accepted   |
| [0004][0004] | リソース／フィールドの型モデル（P\_ ＋ U\_/A\_）            | 基本設計 | accepted   |
| [0005][0005] | 公開 API の形（client・アクセサ・宣言 DSL・返り値/エラー）  | 基本設計 | accepted   |
| [0006][0006] | エラーモデル（PortersError・category・リトライ可否）        | 基本設計 | accepted   |
| [0007][0007] | OAuth 認証の公開面（code/code_direct・トークン管理）        | 基本設計 | accepted   |
| [0008][0008] | マルチテナント運用とパーティション選択                      | 基本設計 | accepted   |
| [0009][0009] | HTTP トランスポート（既定 fetch・注入 seam）                | 詳細設計 | accepted   |
| [0010][0010] | リトライ／スロットリングの機構                              | 詳細設計 | accepted   |
| [0011][0011] | XML パース／シリアライズ内部                                | 詳細設計 | accepted   |
| [0012][0012] | トークンのキャッシュ／更新機構（既定ストラテジ内部）        | 詳細設計 | accepted   |
| [0013][0013] | コーディング規約（クラス/関数・関数スタイル・型定義）       | プロセス | accepted   |
| [0014][0014] | テストカバレッジ方針（計測・閾値・CI 強制）                 | プロセス | accepted   |
| [0015][0015] | ミューテーションテスト（Stryker）でテスト品質を測る         | プロセス | accepted   |
| [0016][0016] | 内部 FieldType の粒度（Field Type か Data Type か）         | 詳細設計 | accepted   |
| [0017][0017] | Option の読み取り値の表現（複数選択対応）                   | 詳細設計 | accepted   |
| [0018][0018] | Attachment リソースとファイル本体（Base64）の扱い           | 詳細設計 | accepted   |
| [0019][0019] | 静的リソース型の実装（カタログ導出の Read/Write 型・SD-3）  | 詳細設計 | accepted   |
| [0020][0020] | Read の field 既定挙動（省略時はカタログ導出の既定 field）  | 詳細設計 | accepted   |
| [0021][0021] | マスタ Read の公開サーフェス（Partition/User/Field/Option） | 詳細設計 | accepted   |
| [0022][0022] | マスタ Read のクエリ面と current() を実 Read API に接地     | 詳細設計 | accepted   |
| [0023][0023] | カスタム項目宣言 DSL（`defineFields`）の詳細設計（R-16）    | 詳細設計 | accepted   |
| [0024][0024] | テスト/評価用の公開モックトランスポート（R-17/R-12）        | 詳細設計 | accepted   |
| [0025][0025] | CI/CD リリース自動化戦略（changesets・git-flow 維持）       | プロセス | accepted   |
| [0026][0026] | CHANGELOG 生成方式（手書き vs changesets）                  | プロセス | accepted   |
| [0027][0027] | リリース前ゲート（整合性・公開正当性）                      | プロセス | accepted   |

## 論点バックログ（未起票）

**番号は付けない**（起票時に採番）。前方参照はトピック名で行う。フェーズは上記凡例に従う。

### 【要件定義】

- PRD オープン論点（[requirements §8][prd]）の確定 — 成功指標の数値化タイミング・対応 PORTERS/API バージョン表記・npm/組織名最終確認 ほか

### 【基本設計】（実装前に決める・依存の浅い順）

- **ページング・検索条件の抽象化** — 公開クエリ面（`field`/`condition`/`order`/`keywords`/`itemstate`/`start`/`count`）（公開面は ADR-0005 で確定済み・詳細は実装時）

### 【詳細設計】（実装フェーズで決める）

- すべて起票済み（PoC 前に順次 accept。ステータスは上記一覧）：
  HTTP トランスポート → [0009][0009]／リトライ・スロットリング → [0010][0010]／
  XML パース・シリアライズ内部 → [0011][0011]／トークンのキャッシュ・更新（ストア含む）→ [0012][0012]。
- 内部 FieldType の粒度 → [0016][0016]（accepted・案B＝Data Type 整合。実装は #21 で反映済み）。
- Option の読み取り値の表現（複数選択の実害修正含む）→ [0017][0017]（accepted・案A＝常に string[]。コード反映は別 PR）。
- Attachment リソースとファイル本体（Base64）→ [0018][0018]（accepted・専用アクセサ＋Base64 string＋10MB ガード。コード反映は別 PR）。
- マスタ Read の公開サーフェス（Partition/User/Field/Option）→ [0021][0021]（accepted・単数形アクセサ＋スコープ関数を `tenant(id)` に改名＋`current()` 発見。コード反映は別 PR。唯一残った P0＝[R-3][prd]）。
- マスタ Read のクエリ面と current() を実 Read API に接地 → [0022][0022]（accepted・ADR-0021 軸2/軸4 を amend。各マスタ bespoke クエリ・`get(id)` 不在・Option は `searchAll` なし・`current()` は User のみ）。

### 決定済み（ADR / PRD）

- 型モデル: [ADR-0004][0004]／公開 API: [ADR-0005][0005]／エラーモデル: [ADR-0006][0006]／OAuth 公開面: [ADR-0007][0007]／マルチテナント: [ADR-0008][0008]／日時の表現: PRD R-10（ISO 8601・UTC）／MVP: [ADR-0003][0003]／接地方針: [ADR-0002][0002]

[madr-markdown-any-decision-records]: https://adr.github.io/madr/
[prd]: ../design/requirements.md
[0000-template-md]: 0000-template.md
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
