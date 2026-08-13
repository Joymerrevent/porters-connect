# ロードマップ / 現況棚卸し

- ステータス: living（随時更新）
- 最終更新: 2026-08-13
- 位置づけ: **「次に何をやるか」を確認する入口**。プロジェクト横断の「着手可能 / 待ち / 完了 / 将来」を 1 枚で見渡す。
  要件の正は [requirements][prd]（PRD）、決定の正は [docs/adr][adr]、レビュー指摘の正は [findings][findings]、
  契約後に確定する仮定は [live-verification][lv]。本書はそれらへの**インデックス＋進捗ビュー**であり、
  詳細・根拠は各正典を参照する（重複させない）。

---

## ▶️ いま何をやるか

### 着手可能（ブロック無し・上から順に）

| #   | やること                                  | 根拠                       | semver | 備考                                           |
| --- | ----------------------------------------- | -------------------------- | ------ | ---------------------------------------------- |
| 1   | **案A 第2層 MCP サーバー** の詳細設計 ADR | [ADR-0033][adr33]          | —      | **戦略ゴール**。パッケージ構成・ツール表面から |
| 2   | **RV-20 の是正 ADR** を起票               | [findings][findings] RV-20 | 未確定 | 0.7.0 が出たので着手できる。影響範囲が広い     |

- **0.7.0 を公開済み**（2026-08-13）。ADR-0044・0045・0046・0047・0048・0049・0050 の 7 本が世に出た
  （RV-13/14/15/17/19/21 は `fixed`）。**accept 済みで実装待ちの ADR も、proposed の ADR も無い**。
- 1 が本命（[ADR-0033][adr33] の主軸）。評価基盤（フェイクサーバー）が揃っているので、e2e の足場は追加不要。
- 2 は **RV-20**（HTTP 200 ＋ 非 PORTERS ボディが「空ページ」として通る）。決めるべきこと
  （`<Code>` の不在を envelope でないと見なすか／ルート要素名を検証するか）が全 Read 経路・fixture・
  既存テストの寛容な既定に触れるため、0.7.0 を出してから腰を据える整理にしていた。
- **RV-22**（429 後に `create` を再送しない）は**まだ着手しない** — 実 PORTERS では発火しない（レート超過は強制切断）。
  429 が観測できるか自体が LV-9 の確認事項なので、契約後に判断する。

### 随時・任意（急がない）

- [ ] **R-4 の積み残し: Link / Image 型の正規化**（[PRD R-4][prd] で **v1 未対応・deferred** と明記。P0 要件で唯一残っている穴。
      需要が出たら詳細設計 ADR から。カスタム項目側の Image 対応は下の案D に含む＝別物）
- [ ] 案D `defineFields` 深掘り（値レベルの実行時検証・テナント実在チェック・Field Read からの宣言生成。[ADR-0023][adr23]）
- [ ] 案B MVP 外リソースの R/W（需要に応じ機会的に）→ 後述「🚀 将来の機能アップ」
- [ ] （任意）README 英語版（日本語ファースト → 英語）

### 待ち（自分では進められない）

| 待ちの種類   | 中身                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| **契約待ち** | ライブ検証 **LV-1〜13**（[live-verification][lv]）。リリースのブロッカーではない                             |
| **需要待ち** | フェイクサーバー **フェーズ7**（package 昇格・配布。[実装計画][fake-plan]・stakeholder 2026-08-09）          |
| **判断待ち** | PRD [§8][prd] オープン論点 **2 件** — 成功指標の数値化タイミング[stakeholder]／v1 で CJS 出力まで出すか[eng] |

### TODO の見取り図（どこを見れば何が分かるか）

TODO は役割ごとに分かれている。**本書が入口**で、詳細は各正典にある。

| ファイル                      | 何の TODO か                                 | いまの状態                               |
| ----------------------------- | -------------------------------------------- | ---------------------------------------- |
| **本書**（roadmap）           | **次に何をやるか**（着手可能 / 随時 / 待ち） | 着手可能 2 件                            |
| [findings][findings]          | レビュー指摘の処置台帳（RV-N）               | open 2 件 = RV-20/22（RV-22 は契約待ち） |
| [docs/adr][adr]               | 【accept 済み・実装待ち】＋論点バックログ    | proposed なし／実装待ち **なし**         |
| [live-verification][lv]       | 契約取得後に実機確認する仮定（LV-N）         | LV-1〜13 が未確認（契約待ち）            |
| [フェイク実装計画][fake-plan] | フェイクサーバーのフェーズ別チェックリスト   | フェーズ0〜6 完了・フェーズ7 のみ未着手  |
| [release-runbook][rb]         | リリース手順のチェックリスト                 | 毎回使う手順書（常時 unchecked）         |

> GitHub Issues は使っていない（現在 0 件）。TODO の正典は上記のとおり `docs/` 配下にある。

---

## 🧭 方針（[ADR-0033][adr33]・stakeholder 2026-06-22）

**案F（v1 公開 API の積み残し）を先行 → 案A（第2層 MCP）を主軸**。各群は実装前に個別 ADR（詳細設計）へ分岐する。

| 案  | 内容                      | 状態                                                    |
| --- | ------------------------- | ------------------------------------------------------- |
| F   | v1 公開 API の積み残し    | ✅ **完了**（F-1〜F-4。下記）                           |
| C   | ローカル フェイクサーバー | ✅ フェーズ0〜6 完了（フェーズ7 は需要待ち）            |
| A   | 第2層 MCP サーバー        | ▶️ **これが主軸**（詳細設計 ADR から）                  |
| B   | MVP 外リソース R/W        | 随時（需要に応じ機会的に）                              |
| D   | `defineFields` 深掘り     | 随時                                                    |
| E   | 対応バージョン表記        | ✅ [ADR-0042][adr42] で確定（残るは README 英語版のみ） |

**案F の内訳（すべて完了）**: F-1 OAuth 公開 API `porters.auth.*`（[ADR-0007][p7] SD-3/SD-6・[ADR-0034][adr34] ／ 0.3.0・`docs/guide/oauth.md`）／
F-2 Read クエリ（`order`/`keywords`/`itemstate` ＋ typed `condition`・[ADR-0038][adr38] ／ 0.4.0）／
F-3 マルチテナント（`porters.tenant(id)` ＋ `TenantScope`・[ADR-0040][adr40] 案1c ／ 0.5.0・`docs/guide/multi-tenancy.md`）／
F-4 一括書き込み（`createMany` / `updateMany` ＋ `BulkWriteResult`・[ADR-0041][adr41] 案1a/案2a ／ 0.6.0・`docs/guide/bulk-write.md`）。

横断監査 [2026-06-22-03][rv3] の検出ドリフト RV-10〜12 はすべて `fixed`（RV-11 は [ADR-0036][adr36] で refresh 挙動を amend）。

---

## ✅ 完了

### コア層

- HTTP transport（fetch 既定＋注入 seam）／requester（スロットル・認証・指数バックオフ・送信前サイズガード = URL+body 合算）
- **URL 組立を 1 関数に集約**（`apiUrl`）＋ アクセスポイント / scheme 設定（[ADR-0047][adr47]・既定 https・http は明示＋警告）
- XML parse/encode（Option・User/Reference・DateTime/Date を正規化）／datetime（ISO ⇄ PORTERS）
- OAuth（`code_direct`・トークン ms 単位・キャッシュ＋自動リフレッシュ・差し替え可能ストア）＋ **公開 API `porters.auth.*`**（初回ブラウザ付与 `authorizationUrl`/`exchangeAuthorizationCode`・利用終了 `revokeUrl`/`clearTokens`・`ensureAuthenticated`/`getToken`・F-1 / [ADR-0034][adr34]）
- エラーモデル（基底 `PortersError` ＋ 系統別 4 サブクラス ＋ `category` 11 種・未知は `unknown`）
  - **HTTP ステータスも分類**（[ADR-0044][adr44]・envelope 優先／status 由来は `code: null` ＋ `httpStatus`。`rateLimit` を解禁）
  - **Write のルート `<Code>`** を先読みしてリクエスト単位の失敗を保全（[ADR-0045][adr45]・仮定は LV-11）
  - **例外は常に reject で届く**（[ADR-0046][adr46]・Promise を返す公開メソッドは同期 throw しない）
  - **認証経路も同じ判定**（[ADR-0050][adr50]・トークン取得中のゲートウェイ 5xx も分類され自動回復しうる）
  - **アクセスポイントの書式検証**（[ADR-0048][adr48]・構築時に `PortersConfigError`。誤設定で別ホストへ繋がない。
    ポートはどれでも書ける＝[ADR-0049][adr49]）

### リソース（MVP 完了 = [R-3][prd]）

- データ R/W: Candidate / Job / Client / Process / Resume ＋ Attachment（Base64）
- マスタ Read: Partition / User（`current()`）/ Field / Option

### 要件（[PRD §6][prd]）

- P0 = R-1〜R-15（**大半を実装。一部に積み残しあり**＝下記 ※）（OAuth・型付き client・リソース・XML 隠蔽・型付きクエリ・自動ページング・
  レート市民＋リトライ・サイズガード・構造化エラー・日時 ISO・秘匿非漏洩・モック transport・型安全・配布・言語方針）
  - ※ 横断監査で一部に**積み残し**判明。**R-5 の `order`/`keywords`/`itemstate` は F-2（0.4.0）で是正済み**、**マルチテナント（`tenant(id)`）は F-3（[ADR-0040][adr40]・0.5.0）で公開済み**。残るは **R-4 の Link / Image 正規化のみ**（PRD で deferred 明記済み・上記「随時・任意」に掲載）。
- P1 = **すべて実装**: R-16 `defineFields`（[ADR-0023][adr23]）／ R-17 `createMockTransport`＋サンドボックス（[ADR-0024][adr24]）／ R-18 エラー対処ガイド

### 評価基盤（[ADR-0043][adr43]・フェーズ0〜6）

- in-repo フェイクサーバー（`test/fake/`・dev-only＝tarball 非同梱）: 独自 OAuth・状態あり CRUD 往復・
  Read クエリ・マスタ Read・制約（~15000字/200件/レート）・注入（result code / per-item / auth / network / HTTP）
- `pnpm fake:serve` で **ローカル HTTP 起動**（curl・別プロセスから叩ける）＋ 転送 Transport（ライブラリ非依存）
- **アプリ無改造で接続**: `host` ＋ `scheme: "http"` のみ（[ADR-0047][adr47]）。http は毎プロセス 1 回警告・抑止は専用 env
- L1 結合テストが契約なしで回る（`PortersClient` をそのまま駆動）
- **curl だけで叩く手順書**（[fake-server-runbook][fake-runbook]）— 認証 → CRUD → マスタ → 制約・注入まで実測検証済み

### 基盤・記録

- ADR 0001〜0050 accepted（0037 は 0039 で superseded・proposed は現在なし）。**実装待ちは無し**（[索引][adr]）
- CI（ci / mutation / codeql / commitlint / test / scorecard）＋ eslint / prettier / markdownlint ＋ vitest coverage（perFile stmts/funcs/lines=100・branch≥90）＋ Stryker ＋ pre-commit（simple-git-hooks ＋ lint-staged ＋ commitlint）
- 品質ゲート green・554 tests／project-review プロセス＋台帳（[findings][findings]：RV-1〜18 は `fixed`／
  **RV-20/22 は open**＝実装の過程で判明した積み残し）
- 初期 scaffold 資料を [docs/history][history] へ移設（ルート直下を利用者向けに整理）

## 🔜 リリースに向けた残タスク

手順は [release-runbook][rb]。リリースは**半自動**（main マージで `tag.yml` が自動タグ → 人/CC が GitHub Release 作成 → `release.yml` が **OIDC Trusted Publishing** で npm 公開・NPM_TOKEN 不要）。決定は [ADR-0025][adr25]〜[0032][adr32]（commitlint は [ADR-0039][adr39] で改訂：リリース PR は lint 範囲を限定して実行＋feature PR は PR タイトルも検査。旧 ADR-0037 のスキップは superseded）。

- [x] `version` 0.1.0 確定 ／ CHANGELOG 作成（Keep a Changelog・npm 同梱）
- [x] `v0.1.0` タグ付与 ＋ git-flow（release → main → develop back-merge）
- [x] **npm アカウント作成 ＋ `@joymerrevent` 組織作成 ＋ OIDC 信頼登録**
- [x] 公開済み — **`@joymerrevent/porters-connect@0.7.0`**（npm latest・2026-08-13 にレジストリで確認）。**全 11 版**を半自動フローでリリース:
      0.1.0 → 0.1.1 → 0.2.0 → 0.2.1 → 0.3.0 → 0.4.0 → 0.5.0 → 0.6.0 → 0.6.1 → 0.6.2 → 0.7.0
      （0.1.1 でメンテナンス＝`src/` 変更なし・fast-xml-parser の下限を `^5.9.2` へ・開発依存の脆弱性 4 件を解消、
      0.3.0 で F-1 OAuth 公開 API `porters.auth.*`、0.4.0 で F-2 Read クエリ＝typed `condition` ＋ `order`/`keywords`/`itemstate`、
      0.5.0 で F-3 マルチテナント＝`porters.tenant(id)` ＋ `TenantScope`、0.6.0 で F-4 一括書き込み＝`createMany` / `updateMany` ＋ `BulkWriteResult`、
      0.6.1 で fast-xml-parser `^5.10.1` 追従、0.6.2 で CI/CD ハードニング＝Actions の SHA ピン留め ＋ OpenSSF Scorecard、
      **0.7.0 でエラーの見え方の是正 ＋ アクセスポイント設定**＝ADR-0044〜0050 の 7 本を同梱）。
      各版の詳細は [CHANGELOG][changelog]
- [x] 対応 PORTERS / API バージョン明記の確定（[ADR-0042][adr42]・案A＝**Connect API Version を契約の正**／製品 8.x・9.x は参考。README「対応バージョン」節・PRD §8・CLAUDE.md・コードコメントへ反映済み）
- [x] **0.7.0 リリース**（2026-08-13）— changeset 6 件を消費して `0.6.2` → `0.7.0`。
      `v0.7.0` 自動タグ → back-merge → GitHub Release → OIDC publish まで完了
- [ ] （任意）README 英語版（日本語ファースト → 英語）

## 🧱 基盤構築（完了）

機能開発を一旦止め、公開リポジトリの基盤（コミュニティ・ヘルス＋開発体験＋CI/CD）を固めた期間の記録。
リリース自動化の決定は [ADR-0025][adr25]〜[0032][adr32]（accepted）。WS-C の任意項目（OpenSSF Scorecard / SHA ピン留め）まで入れて**基盤構築は完了**しており、**残タスクはない**。

### WS-A. コミュニティ・ヘルス／ガバナンス

- [x] `SECURITY.md`（報告窓口・非公式の免責）＋ GitHub private vulnerability reporting 有効化
- [x] `CONTRIBUTING.md`（git-flow／Conventional Commits／pnpm／コーディング規約 [ADR-0013][p13]／公開サーフェスは英語・内部コメント日本語可／契約＋Connect API オプション契約が必要・非公式／PR はメンテナがマージ）
- [x] `.github/ISSUE_TEMPLATE/`（bug / feature の Issue Forms ＋ `config.yml`）
- [x] `.github/PULL_REQUEST_TEMPLATE.md`（全ゲート green／決定を伴うなら ADR／秘匿情報なし）
- [x] `.github/CODEOWNERS`
- [x] `CODE_OF_CONDUCT.md`（Contributor Covenant）
- [x] README に「Contributing／セキュリティ報告／非公式の免責」節

### WS-B. 開発体験・ローカルゲート

- [x] `.editorconfig`
- [x] **pre-commit 導入**（薄い構成：`simple-git-hooks` ＋ `lint-staged`）。旧記載の「pre-commit あり」は誤りで未導入だったため、ここで正式導入した
- [x] commitlint（`@commitlint/config-conventional`）を**ローカル**（commit-msg フック）で強制。**CI ジョブは WS-C**
- [x] 定型セットアップを `project-recipes` スキルへ codify 済み（**`ts-commit-gates` レシピ**＝simple-git-hooks ＋ lint-staged ＋ commitlint。既存 `git-hooks` は core.hooksPath 方式なので別レシピとして分けた）

### WS-C. CI/CD ハードニング

- [x] CodeQL（コードスキャン）ワークフロー（`codeql.yml`。**default branch=main にも反映済み**＝main で走る）
- [x] commitlint の CI ジョブ（`commitlint.yml`。PR のコミット範囲＋PR タイトルを検査・リリース PR は範囲限定。[ADR-0039][adr39]）
- [x] テスト Node マトリクス（20/22/24）＋ **最低 Node を 20 に引き上げ**（18 は EOL・vitest/eslint が非対応のため。engines/README/CLAUDE.md/CHANGELOG 反映）
- [x] OpenSSF Scorecard ワークフロー（`scorecard.yml`・週次＋`main` push＋branch_protection_rule／SARIF を code scanning へ＋OpenSSF 公開・README バッジ）／全ワークフローの Actions を**コミット SHA にピン留め**（版コメントで Dependabot が SHA＋版を追従更新＝両立）。サプライチェーン強靭化＝フェイルセーフ。既存 `github-actions` Dependabot 設定で追従（設定変更不要）

### WS-D. リリース自動化（[ADR-0025][adr25]〜[0032][adr32]）

- [x] ADR-0025 を **accepted**（**changesets・git-flow 維持**。release-please/手運用は不採用）
- [x] changesets 導入（`@changesets/cli`・config: `access: public` / `baseBranch: develop`・scripts）。**version bump のみ**に使用（CHANGELOG は**手書き**＝[ADR-0026][adr26] 案B・`changelog: false`）
- [x] publish ワークフロー `release.yml`（**Release 公開**で起動・**OIDC Trusted Publishing**・**NPM_TOKEN 不要**・provenance 自動）＋ npm 側の信頼登録済み（0.1.0〜0.7.0 の**全 11 版**で運用実績あり）
- [x] タグ自動化 `tag.yml`（main マージで `vX.Y.Z` 自動作成・[ADR-0029][adr29]）／ back-merge は**手動**（[ADR-0030][adr30]）／ リリース前ゲート `check:release`（版番号 semver＋単調増加・[ADR-0027][adr27]/[0031][adr31]/[0032][adr32]）
- [x] CHANGELOG 形式確定（[ADR-0026][adr26] 案B）／[release-runbook][rb] を半自動フローへ更新済み

## 🧹 小さな整理（技術的負債）

- [x] `src/resources/{job,process,resume}.ts` のコメント「first alias only」を実態（全 alias を `string[]` で返す・[ADR-0017][adr17]）に修正
- [x] メモリ `field-type-fidelity-followup` の更新（Option 複数選択・ラベル distinct 化は解消済み／残は per-type 値検証）
- [x] 初期 scaffold 資料（SPEC_v1 / KICKOFF_PROMPT）を `docs/history/` へ移設（PR #50）

## 🚀 将来の機能アップ（Non-Goals / Future）

[PRD §3 非ゴール][prd] ／ [ADR 論点バックログ][adr] と対応。

- 第2層 MCP サーバー（`@joymerrevent/porters-mcp`）＝ 案A。**着手対象**なので上記「いま何をやるか」も参照
- フェイクサーバーの **package 昇格・配布**（`@joymerrevent/porters-fake`・フェーズ7・需要が出てから）
- MVP 外リソースの R/W: Recruiter / Contact / Activity / Contract / Sales / Opportunity / Phase（v0.2 以降）
- CJS 出力 / CLI / Docker 配布 / 公開プレイグラウンド
- `defineFields` follow-up（[ADR-0023][adr23]）: 値レベルの厳格な実行時検証・テナント実在チェック・Field Read からの宣言雛形生成・Attachment / Reference / Image 型のカスタム項目

## 🔌 ライブ検証（契約環境が必要・契約後タスク）

実 PORTERS 契約が無いと確定できない仮定は [live-verification][lv]（**LV-1〜13**）に集約。リリースのブロッカーではないが、
契約取得後に実機で確定し、必要なら fixture を実データへ差し替える。
LV-9〜12 はフェイクサーバー実装中に増えた項目（制約違反時の HTTP 応答・System[Reference] の入れ子・Write 失敗時の Result Code・Field Read の表記）。

## 関連

- 要件: [requirements][prd]（PRD・フェーズ計画は §9）
- 決定: [docs/adr][adr]
- レビュー指摘台帳: [findings][findings]（最新スナップショット: [2026-08-10-01][run]）
- 契約後検証: [live-verification][lv]
- フェイクサーバー: [実装計画][fake-plan] ／ [curl 手順書][fake-runbook]
- 歴史的経緯: [docs/history][history]

[prd]: design/requirements.md
[rb]: release-runbook.md
[changelog]: ../CHANGELOG.md
[adr17]: adr/0017-option-read-shape.md
[adr23]: adr/0023-custom-field-declaration-dsl.md
[adr24]: adr/0024-mock-transport.md
[adr25]: adr/0025-release-automation.md
[adr26]: adr/0026-changelog-format.md
[adr27]: adr/0027-release-readiness-gate.md
[adr29]: adr/0029-release-tag-automation.md
[adr30]: adr/0030-backmerge-method.md
[adr31]: adr/0031-version-number-validation.md
[adr32]: adr/0032-monotonic-check-release-scope.md
[adr33]: adr/0033-post-mvp-direction.md
[adr34]: adr/0034-oauth-public-surface-impl.md
[adr36]: adr/0036-refresh-expiry-reacquire.md
[adr38]: adr/0038-read-query-surface-impl.md
[adr39]: adr/0039-commitlint-release-range.md
[adr40]: adr/0040-multitenancy-surface-impl.md
[adr41]: adr/0041-bulk-write-surface-impl.md
[adr42]: adr/0042-supported-version-policy.md
[adr43]: adr/0043-local-fake-server.md
[adr44]: adr/0044-http-status-handling.md
[adr45]: adr/0045-write-response-root-code.md
[adr46]: adr/0046-guard-error-contract.md
[adr47]: adr/0047-access-point-scheme.md
[adr48]: adr/0048-access-point-host-validation.md
[adr49]: adr/0049-host-port-roundtrip.md
[adr50]: adr/0050-auth-http-status-handling.md
[fake-plan]: design/fake-server-plan.md
[fake-runbook]: fake-server-runbook.md
[p7]: adr/0007-oauth-public-surface.md
[p13]: adr/0013-coding-conventions-class-vs-function.md
[rv3]: reviews/2026-06-22-03.md
[run]: reviews/2026-08-10-01.md
[adr]: adr/README.md
[findings]: reviews/findings.md
[lv]: live-verification.md
[history]: history/README.md
