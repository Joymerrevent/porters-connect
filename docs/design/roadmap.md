# ロードマップ / 現況棚卸し

- ステータス: living（随時更新）
- 最終更新: 2026-06-19
- 位置づけ: プロジェクト横断の「完了 / 残作業 / 将来」を 1 枚で見渡すための**現況ドキュメント**。
  要件の正は [requirements][prd]（PRD）、決定の正は [docs/adr][adr]、レビュー指摘の正は [findings][findings]、
  契約後に確定する仮定は [live-verification][lv]。本書はそれらへのインデックス＋進捗ビューであり、
  詳細・根拠は各正典を参照する（重複させない）。

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

- P0 = **R-1〜R-15 すべて実装**（OAuth・型付き client・リソース・XML 隠蔽・型付きクエリ・自動ページング・
  レート市民＋リトライ・サイズガード・構造化エラー・日時 ISO・秘匿非漏洩・モック transport・型安全・配布・言語方針）
- P1 = **すべて実装**: R-16 `defineFields`（ADR-0023）／ R-17 `createMockTransport`＋サンドボックス（ADR-0024）／ R-18 エラー対処ガイド

### 基盤・記録

- ADR 0001〜0024 すべて accepted（[索引][adr]）
- CI（ci / mutation）＋ eslint / prettier / markdownlint ＋ vitest coverage（perFile stmts/funcs/lines=100・branch≥90）＋ Stryker
  （※ pre-commit は未導入。下記「🧱 基盤構築」WS-B で正式導入する）
- 品質ゲート green・216 tests／project-review プロセス＋台帳（[findings][findings] の RV-1〜8 はすべて `fixed`）
- 初期 scaffold 資料を [docs/history][history] へ移設（ルート直下を利用者向けに整理）

## 🔜 リリースに向けた残タスク

手順は [release-runbook][rb]。自動化の検討は [ADR-0025][adr25]（0.2.0 以降）。

- [x] `version` 0.1.0 確定 ／ CHANGELOG 作成（Keep a Changelog・npm 同梱）
- [x] `v0.1.0` タグ付与 ＋ git-flow（release → main → develop back-merge）
- [x] **npm アカウント作成 ＋ `@joymerrevent` 組織作成**
- [x] 初版 **`pnpm publish` ＋ GitHub Release** — `@joymerrevent/porters-connect@0.1.0` 公開済み（Release `v0.1.0`）
- [ ] 対応 PORTERS / API バージョン明記の確定（[PRD §8][prd] オープン論点・stakeholder 判断。README には Connect API v2 / PORTERS 8.x・9.x 記載済み）
- [ ] （任意）README 英語版（日本語ファースト → 英語）

## 🧱 基盤構築（進行中）

機能開発を一旦止め、公開リポジトリの基盤（コミュニティ・ヘルス＋開発体験＋CI/CD）を固める。
リリース自動化の決定は [ADR-0025][adr25]（proposed）。各項目は branch→PR で進め、マージはメンテナ。

### WS-A. コミュニティ・ヘルス／ガバナンス

- [ ] `SECURITY.md`（報告窓口・非公式の免責）＋ GitHub private vulnerability reporting 有効化
- [ ] `CONTRIBUTING.md`（git-flow／Conventional Commits／pnpm／コーディング規約 [ADR-0013][p13]／公開サーフェスは英語・内部コメント日本語可／契約＋Connect API オプション契約が必要・非公式／PR はメンテナがマージ）
- [ ] `.github/ISSUE_TEMPLATE/`（bug / feature の Issue Forms ＋ `config.yml`）
- [ ] `.github/PULL_REQUEST_TEMPLATE.md`（全ゲート green／決定を伴うなら ADR／秘匿情報なし）
- [ ] `.github/CODEOWNERS`
- [ ] `CODE_OF_CONDUCT.md`（Contributor Covenant・任意）
- [ ] README に「Contributing／セキュリティ報告／非公式の免責」節

### WS-B. 開発体験・ローカルゲート

- [ ] `.editorconfig`
- [ ] **pre-commit 導入**（薄い構成：`simple-git-hooks` ＋ `lint-staged`、または lefthook）。旧記載の「pre-commit あり」は誤りで未導入だったため、ここで正式導入する
- [ ] commitlint（`@commitlint/config-conventional`）＝ Conventional Commits をローカル＋CI で強制
- 定型セットアップは `project-recipes` スキルのレシピを優先活用

### WS-C. CI/CD ハードニング

- [ ] CodeQL（コードスキャン）ワークフロー
- [ ] commitlint の CI ジョブ
- [ ] （任意）OpenSSF Scorecard／Actions の SHA ピン留め（Dependabot 更新と両立）／テスト Node マトリクス（18/20/22）

### WS-D. リリース自動化（[ADR-0025][adr25]）

- [ ] ADR-0025 に推奨を執筆（proposed）→ stakeholder 決定（accepted）
- [ ] accepted 後：publish ワークフロー（`NPM_TOKEN`＋provenance）実装・[release-runbook][rb] 更新・必要ならブランチ戦略簡素化

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
[p13]: ../adr/0013-coding-conventions-class-vs-function.md
[adr]: ../adr/README.md
[findings]: ../reviews/findings.md
[lv]: ../live-verification.md
[history]: ../history/README.md
