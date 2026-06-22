# ロードマップ / 現況棚卸し

- ステータス: living（随時更新）
- 最終更新: 2026-06-22
- 位置づけ: プロジェクト横断の「完了 / 残作業 / 将来」を 1 枚で見渡すための**現況ドキュメント**。
  要件の正は [requirements][prd]（PRD）、決定の正は [docs/adr][adr]、レビュー指摘の正は [findings][findings]、
  契約後に確定する仮定は [live-verification][lv]。本書はそれらへのインデックス＋進捗ビューであり、
  詳細・根拠は各正典を参照する（重複させない）。

## ▶️ 次の注力（決定済み・[ADR-0033][adr33]）

stakeholder 判断（2026-06-22）で **案F（v1 公開面の積み残しを埋める）を先行 → 案A（第2層 MCP）を主軸**。
案F = 受け入れ済み ADR / P0 要件が約束したが未実装のサーフェス群:
F-1 OAuth 公開面 `porters.auth.*`（[ADR-0007][p7]）／ F-2 Read クエリ `order`・`keywords`・`itemstate`（[ADR-0005][p5]・R-5）／
F-3 `tenant(id)` ＋ per-call `partition`（ADR-0008/0021）／ F-4 200 件一括書き込み＋自動分割（`CLAUDE.md`）。
横断監査の証拠は [2026-06-22-03][rv3]、ドリフトは [findings][findings] RV-10〜12。各群は実装前に個別 ADR へ分岐。

## ✅ 完了

### コア層

- HTTP transport（fetch 既定＋注入 seam）／requester（スロットル・認証・指数バックオフ・送信前サイズガード = URL+body 合算）
- XML parse/encode（Option・User/Reference・DateTime/Date を正規化）／datetime（ISO ⇄ PORTERS）
- OAuth（`code_direct`・トークン ms 単位・キャッシュ＋自動リフレッシュ・差し替え可能ストア）
- エラーモデル（基底 `PortersError` ＋ 系統別 4 サブクラス ＋ `category` 11 種・未知は `unknown`）

### リソース（MVP 完了 = [R-3][prd]）

- データ R/W: Candidate / Job / Client / Process / Resume ＋ Attachment（Base64）
- マスタ Read: Partition / User（`current()`）/ Field / Option

### 要件（[PRD §6][prd]）

- P0 = **R-1〜R-15 を実装**（OAuth・型付き client・リソース・XML 隠蔽・型付きクエリ・自動ページング・
  レート市民＋リトライ・サイズガード・構造化エラー・日時 ISO・秘匿非漏洩・モック transport・型安全・配布・言語方針）
  - ※ 横断監査で一部に**積み残し**判明（R-5 の `order`/`keywords`/`itemstate`・R-4 Link/Image・マルチテナント面）。是正は上記「▶️ 次の注力」[ADR-0033][adr33] 案F／[findings][findings] RV-12。
- P1 = **すべて実装**: R-16 `defineFields`（ADR-0023）／ R-17 `createMockTransport`＋サンドボックス（ADR-0024）／ R-18 エラー対処ガイド

### 基盤・記録

- ADR 0001〜0032 すべて accepted（[索引][adr]）
- CI（ci / mutation / codeql / commitlint / test）＋ eslint / prettier / markdownlint ＋ vitest coverage（perFile stmts/funcs/lines=100・branch≥90）＋ Stryker ＋ pre-commit（simple-git-hooks ＋ lint-staged ＋ commitlint）
- 品質ゲート green・230 tests／project-review プロセス＋台帳（[findings][findings] の RV-1〜9 はすべて `fixed`）
- 初期 scaffold 資料を [docs/history][history] へ移設（ルート直下を利用者向けに整理）

## 🔜 リリースに向けた残タスク

手順は [release-runbook][rb]。リリースは**半自動**（main マージで `tag.yml` が自動タグ → 人/CC が GitHub Release 作成 → `release.yml` が **OIDC Trusted Publishing** で npm 公開・NPM_TOKEN 不要）。決定は [ADR-0025][adr25]〜[0032][adr32]。

- [x] `version` 0.1.0 確定 ／ CHANGELOG 作成（Keep a Changelog・npm 同梱）
- [x] `v0.1.0` タグ付与 ＋ git-flow（release → main → develop back-merge）
- [x] **npm アカウント作成 ＋ `@joymerrevent` 組織作成 ＋ OIDC 信頼登録**
- [x] 公開済み — **`@joymerrevent/porters-connect@0.2.1`**（npm latest）。0.1.0 → 0.2.0 → 0.2.1 を半自動フローでリリース
- [ ] 対応 PORTERS / API バージョン明記の確定（[PRD §8][prd] オープン論点・stakeholder 判断。README には Connect API v2 / PORTERS 8.x・9.x 記載済み）
- [ ] （任意）README 英語版（日本語ファースト → 英語）

## 🧱 基盤構築（ほぼ完了）

機能開発を一旦止め、公開リポジトリの基盤（コミュニティ・ヘルス＋開発体験＋CI/CD）を固める。
リリース自動化の決定は [ADR-0025][adr25]〜[0032][adr32]（accepted）。残るは WS-C の任意項目（OpenSSF Scorecard / SHA ピン留め）のみ。各項目は branch→PR で進め、マージはメンテナ。

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
- 定型セットアップは `project-recipes` スキルで codify 予定（既存 `git-hooks` は core.hooksPath 方式のため、simple-git-hooks 方式は別レシピ化）

### WS-C. CI/CD ハードニング

- [x] CodeQL（コードスキャン）ワークフロー（`codeql.yml`。default branch=main でも走るよう main へ反映は別途）
- [x] commitlint の CI ジョブ（`commitlint.yml`。PR のコミット範囲を検査）
- [x] テスト Node マトリクス（20/22/24）＋ **最低 Node を 20 に引き上げ**（18 は EOL・vitest/eslint が非対応のため。engines/README/CLAUDE.md/CHANGELOG 反映）
- [ ] （任意・未着手）OpenSSF Scorecard／Actions の SHA ピン留め（Dependabot 更新と両立）

### WS-D. リリース自動化（[ADR-0025][adr25]〜[0032][adr32]）

- [x] ADR-0025 を **accepted**（**changesets・git-flow 維持**。release-please/手運用は不採用）
- [x] changesets 導入（`@changesets/cli`・config: `access: public` / `baseBranch: develop`・scripts）。**version bump のみ**に使用（CHANGELOG は**手書き**＝[ADR-0026][adr26] 案B・`changelog: false`）
- [x] publish ワークフロー `release.yml`（**Release 公開**で起動・**OIDC Trusted Publishing**・**NPM_TOKEN 不要**・provenance 自動）＋ npm 側の信頼登録済み（0.1.0〜0.2.1 公開実績あり）
- [x] タグ自動化 `tag.yml`（main マージで `vX.Y.Z` 自動作成・[ADR-0029][adr29]）／ back-merge は**手動**（[ADR-0030][adr30]）／ リリース前ゲート `check:release`（版番号 semver＋単調増加・[ADR-0027][adr27]/[0031][adr31]/[0032][adr32]）
- [x] CHANGELOG 形式確定（[ADR-0026][adr26] 案B）／[release-runbook][rb] を半自動フローへ更新済み

## 🧹 小さな整理（技術的負債）

- [x] `src/resources/{job,process,resume}.ts` のコメント「first alias only」を実態（全 alias を `string[]` で返す・ADR-0017）に修正
- [x] メモリ `field-type-fidelity-followup` の更新（Option 複数選択・ラベル distinct 化は解消済み／残は per-type 値検証）
- [x] 初期 scaffold 資料（SPEC_v1 / KICKOFF_PROMPT）を `docs/history/` へ移設（PR #50）

## 🚀 将来の機能アップ（Non-Goals / Future）

[PRD §3 非ゴール][prd] ／ [ADR 論点バックログ][adr] と対応。

- 第2層 MCP サーバー（`@joymerrevent/porters-mcp`）
- N2 ローカル フェイクサーバー（高忠実なオフライン評価・別パッケージ・別 ADR。ADR-0024 follow-up）
- MVP 外リソースの R/W: Recruiter / Contact / Activity / Contract / Sales / Opportunity / Phase（v0.2 以降）
- CJS 出力 / CLI / Docker 配布 / 公開プレイグラウンド
- `defineFields` follow-up（ADR-0023）: 値レベルの厳格な実行時検証・テナント実在チェック・Field Read からの宣言雛形生成・Attachment / Reference / Image 型のカスタム項目

## 🔌 ライブ検証（契約環境が必要・契約後タスク）

実 PORTERS 契約が無いと確定できない仮定は [live-verification][lv]（LV-1〜8）に集約。リリースのブロッカーではないが、
契約取得後に実機で確定し、必要なら fixture を実データへ差し替える。

## 関連

- 要件: [requirements][prd]（PRD・フェーズ計画は §9）
- 決定: [docs/adr][adr]
- レビュー指摘台帳: [findings][findings]
- 契約後検証: [live-verification][lv]
- 歴史的経緯: [docs/history][history]

[prd]: requirements.md
[rb]: ../release-runbook.md
[adr25]: ../adr/0025-release-automation.md
[adr26]: ../adr/0026-changelog-format.md
[adr27]: ../adr/0027-release-readiness-gate.md
[adr29]: ../adr/0029-release-tag-automation.md
[adr30]: ../adr/0030-backmerge-method.md
[adr31]: ../adr/0031-version-number-validation.md
[adr32]: ../adr/0032-monotonic-check-release-scope.md
[adr33]: ../adr/0033-post-mvp-direction.md
[p5]: ../adr/0005-public-api-shape.md
[p7]: ../adr/0007-oauth-public-surface.md
[p13]: ../adr/0013-coding-conventions-class-vs-function.md
[rv3]: ../reviews/2026-06-22-03.md
[adr]: ../adr/README.md
[findings]: ../reviews/findings.md
[lv]: ../live-verification.md
[history]: ../history/README.md
