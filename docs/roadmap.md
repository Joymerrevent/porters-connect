# ロードマップ / 現況棚卸し

- ステータス: living（随時更新）
- 最終更新: 2026-08-21
- 位置づけ: **「次に何をやるか」を確認する入口**。プロジェクト横断の「着手可能 / 待ち / 完了 / 将来」を 1 枚で見渡す。
  要件の正は [requirements][prd]（PRD）、決定の正は [docs/adr][adr]、レビュー指摘の正は [findings][findings]、
  契約後に確定する仮定は [live-verification][lv]。本書はそれらへの**インデックス＋進捗ビュー**であり、
  詳細・根拠は各正典を参照する（重複させない）。

---

## ▶️ いま何をやるか

**2026-08-16 の全面レビュー**（[2026-08-16-01][run816]）で棚卸しし、そこで見つかった 8 件のうち
**6 件を 0.9.0 で解消**した。残る 2 件（RV-25 / RV-26）はいずれも挙動変更を伴うため ADR からになる。
品質ゲートは全 green（608 tests・カバレッジ 100/98.87/100/100）。
完成度は本書の「📊 完成度（実装カバレッジ）」節を参照。

### 着手可能（ブロック無し・上から順に）

| #   | やること                                       | 根拠  | semver | 備考                                                                       |
| --- | ---------------------------------------------- | ----- | ------ | -------------------------------------------------------------------------- |
| 1   | **RV-25 の ADR**: `partition` 未束縛の呼び出し | RV-25 | —      | 🟡 いまは無言で `partition=0` を送る。`host` は構築時検証するのに非対称    |
| 2   | **RV-26 の ADR**: `P_Deleted` の型付け         | RV-26 | —      | 🟡 Read 専用・condition/order 不可＋ decode 形が未確定＝ **LV 追加**を伴う |

- 上記 2 件はいずれも**挙動を変える**ので、[ADR 運用][adr]どおり **proposed で起票 → 議論 → accepted → 実装**の順で進める。
  **R-4 の Link / Image** も要 ADR（下記「随時・任意」）。
- **RV-22**（429 後に `create` を再送しない）は**まだ着手しない** — 実 PORTERS では発火しない（レート超過は強制切断）。
  429 が観測できるか自体が LV-9 の確認事項なので、契約後に判断する。
- **0.9.0 を公開済み**（2026-08-21）。**RV-23 / RV-24 / RV-27 / RV-28 / RV-29 / RV-30 の 6 件**が世に出た。
  主題は **Candidate の取りこぼしの是正**（`P_Memo` / `P_Street` / `P_Fax` / `P_PhaseMemo` が公開型に無く、
  候補者のメモが扱えなかった）で、再発防止として **reference ↔ カタログの突合を CI で検査**するようにした。
  併せて `count` の範囲検査・制約型の export・**利用ガイド 2 本**（カスタム項目 / Read クエリ）を同梱。
  **未リリースの変更は無し**（`.changeset/` は空）。

### 随時・任意（急がない）

- [ ] **R-4 の積み残し: Link / Image 型の正規化**（[PRD R-4][prd] で **v1 未対応・deferred** と明記。P0 要件で唯一残っている穴）。
      **訂正（2026-08-16）**: 旧記載は「カスタム項目側の Image 対応は案D＝別物」としていたが、
      reference 実測で**標準 `P_` 項目に Link / Image を使うリソースは 18 本中 0 件**と判明した。
      この 2 型は**カスタム項目（`U_`/`A_`）経由でしか現れない**＝ R-4 と案D の Image 対応は**同一層の同一作業**。
      `DataType` に足すだけでは誰も宣言できないので、**`defineFields` の builder への露出まで 1 本の ADR で**扱う
- [ ] 案D `defineFields` 深掘りの**残り**（値レベルの実行時検証・テナント実在チェック・Field Read からの宣言生成。[ADR-0023][adr23]）。
      値検証は**契約前に厳しくしすぎない**（サーバーが受けるものを手前で落とすと安全側でなく危険側に倒れる）＝ opt-in 前提
- [ ] （任意）README 英語版（日本語ファースト → 英語）

### 待ち（自分では進められない）

| 待ちの種類   | 中身                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **契約待ち** | ライブ検証 **LV-1〜13**（[live-verification][lv]）。リリースのブロッカーではない                                                          |
| **需要待ち** | フェイクサーバー **フェーズ7**（package 昇格・配布。[実装計画][fake-plan]・stakeholder 2026-08-09）                                       |
| **判断待ち** | ① **次の主軸**（下記「🧭 方針」— 案B 全リソース網羅を先行するなら [ADR-0033][adr33] の改訂が要る）／② PRD [§8][prd] オープン論点 **2 件** |

### TODO の見取り図（どこを見れば何が分かるか）

TODO は役割ごとに分かれている。**本書が入口**で、詳細は各正典にある。

| ファイル                      | 何の TODO か                                 | いまの状態                                   |
| ----------------------------- | -------------------------------------------- | -------------------------------------------- |
| **本書**（roadmap）           | **次に何をやるか**（着手可能 / 随時 / 待ち） | 着手可能 2 件（いずれも ADR から）           |
| [findings][findings]          | レビュー指摘の処置台帳（RV-N）               | open 3 件 = RV-22（契約待ち）/ RV-25 / RV-26 |
| [docs/adr][adr]               | 【accept 済み・実装済み】＋論点バックログ    | proposed **なし**／実装待ち **なし**         |
| [live-verification][lv]       | 契約取得後に実機確認する仮定（LV-N）         | LV-1〜13 が未確認（契約待ち）                |
| [フェイク実装計画][fake-plan] | フェイクサーバーのフェーズ別チェックリスト   | フェーズ0〜6 完了・フェーズ7 のみ未着手      |
| [release-runbook][rb]         | リリース手順のチェックリスト                 | 毎回使う手順書（常時 unchecked）             |

> GitHub Issues は使っていない（現在 0 件）。TODO の正典は上記のとおり `docs/` 配下にある。

---

## 📊 完成度（実装カバレッジ）

「どこまで完成しているか」を 4 軸で実測した結果（2026-08-16・[レビュー][run816]で reference と `src/` を突合）。
**数字の根拠と内訳はレビュー本体**にあり、ここは要約と現在地だけを置く（重複させない）。

| 軸                   | 現在地                | 何が足りないか                                                                                                                 |
| -------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **(a) リソース網羅** | **10 / 17**           | マスタ Read は 4/4 完了。データ R/W が 6/13 — 未実装は Recruiter / Contact / Activity / Contract / Sales / Opportunity / Phase |
| **(b) API 機能網羅** | **ほぼ全部** ✅       | Read 8 パラメータ・Write・一括・ページング・OAuth 2 方式・マルチテナント・制限対応まで実装済み。残る穴は `P_Deleted`（RV-26）  |
| **(c) データ型網羅** | **14 / 17**           | `Link` / `Image`（＝ R-4・カスタム項目経由でのみ出現）と `System[Department]`（User 拡張項目・LV 待ち）                        |
| **(d) ドキュメント** | README ＋ ガイド 4 本 | `defineFields` の使い方が皆無（RV-24）／F-2 Read クエリのガイドが無い（RV-27）                                                 |

読み方 — **(b) は実質完成、(a) と (d) に穴がある**。「使ってもらう」目標に対しては、
実テナントが必ず持つカスタム項目の解説（d）が、未実装 7 リソース（a）より効く。
未実装リソースは descriptor パターン（`src/resources/client.ts` は 89 行）に載るため 1 種あたりは小さいが、
**Phase だけは alias 接頭辞が無く**（`Id` / `Resource` / `ResourceId`）汎用 factory の前提から外れる＝別途設計が要る。

---

## 🧭 方針（[ADR-0033][adr33]・stakeholder 2026-06-22）

**案F（v1 公開 API の積み残し）を先行 → 案A（第2層 MCP）を主軸**。各群は実装前に個別 ADR（詳細設計）へ分岐する。

| 案  | 内容                      | 状態                                                    |
| --- | ------------------------- | ------------------------------------------------------- |
| F   | v1 公開 API の積み残し    | ✅ **完了**（F-1〜F-4。下記）                           |
| C   | ローカル フェイクサーバー | ✅ フェーズ0〜6 完了（フェーズ7 は需要待ち）            |
| A   | 第2層 MCP サーバー        | ▶️ **これが主軸**（詳細設計 ADR から）                  |
| B   | MVP 外リソース R/W        | 随時（需要に応じ機会的に）**← 先行させるか判断待ち**    |
| D   | `defineFields` 深掘り     | 随時（Link/Image 部分は R-4 と同一作業）                |
| E   | 対応バージョン表記        | ✅ [ADR-0042][adr42] で確定（残るは README 英語版のみ） |

> **判断待ち: 次の主軸（2026-08-16 起票）** — stakeholder から
> 「**ライブラリの完成＝全リソースにアクセスでき、API でやれることをできるようにする ＋ 使い方のドキュメント充実**」を
> 次の目標にしたい、との申し出があった。これは本 ADR の決定（**案A を主軸**とし、**案B は MCP 越しの需要に応じて
> 機会的に**＝投機的拡充を避ける）と方向が異なる。**方針を変えるなら [ADR-0033][adr33] を supersede する新しい ADR が要る**
> （決定を記録に残す＝後から「なぜ順序を変えたか」を辿れるようにする）。それまでは本 ADR の決定が有効。
> 判断の材料は本書の「📊 完成度（実装カバレッジ）」節と [レビュー][run816] の次アクション候補。

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
- ※ **標準項目の網羅は 0.9.0 で充足**（RV-23 の 4 項目を追加）。以降は **reference ↔ カタログの突合を
  CI が検査**するので、取りこぼし・型の取り違えは仕組みで防がれる（RV-29）

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

- ADR 0001〜0054 accepted（0037 は 0039 で superseded）・**proposed は無し・実装待ちも無し**（[索引][adr]）
- CI（ci / mutation / codeql / commitlint / test / scorecard）＋ eslint / prettier / markdownlint ＋ vitest coverage（perFile stmts/funcs/lines=100・branch≥90）＋ Stryker ＋ pre-commit（simple-git-hooks ＋ lint-staged ＋ commitlint）
- 品質ゲート green・**608 tests**／project-review プロセス＋台帳（[findings][findings]：**open は 3 件**＝
  RV-22（契約待ち）・RV-25・RV-26。台帳は [ADR-0052][adr52] で **1 件 1 ファイル**になり、
  索引とのズレは `pnpm check:index` が CI で弾く）
- 初期 scaffold 資料を [docs/history][history] へ移設（ルート直下を利用者向けに整理）

## 🔜 リリースに向けた残タスク

手順は [release-runbook][rb]。リリースは**半自動**（main マージで `tag.yml` が自動タグ → 人/CC が GitHub Release 作成 → `release.yml` が **OIDC Trusted Publishing** で npm 公開・NPM_TOKEN 不要）。決定は [ADR-0025][adr25]〜[0032][adr32]（commitlint は [ADR-0039][adr39] で改訂：リリース PR は lint 範囲を限定して実行＋feature PR は PR タイトルも検査。旧 ADR-0037 のスキップは superseded）。

- [x] `version` 0.1.0 確定 ／ CHANGELOG 作成（Keep a Changelog・npm 同梱）
- [x] `v0.1.0` タグ付与 ＋ git-flow（release → main → develop back-merge）
- [x] **npm アカウント作成 ＋ `@joymerrevent` 組織作成 ＋ OIDC 信頼登録**
- [x] 公開済み — **`@joymerrevent/porters-connect@0.9.0`**（npm latest・2026-08-21 にレジストリで確認）。**全 13 版**を半自動フローでリリース:
      0.1.0 → 0.1.1 → 0.2.0 → 0.2.1 → 0.3.0 → 0.4.0 → 0.5.0 → 0.6.0 → 0.6.1 → 0.6.2 → 0.7.0 → 0.8.0 → 0.9.0
      （0.1.1 でメンテナンス＝`src/` 変更なし・fast-xml-parser の下限を `^5.9.2` へ・開発依存の脆弱性 4 件を解消、
      0.3.0 で F-1 OAuth 公開 API `porters.auth.*`、0.4.0 で F-2 Read クエリ＝typed `condition` ＋ `order`/`keywords`/`itemstate`、
      0.5.0 で F-3 マルチテナント＝`porters.tenant(id)` ＋ `TenantScope`、0.6.0 で F-4 一括書き込み＝`createMany` / `updateMany` ＋ `BulkWriteResult`、
      0.6.1 で fast-xml-parser `^5.10.1` 追従、0.6.2 で CI/CD ハードニング＝Actions の SHA ピン留め ＋ OpenSSF Scorecard、
      0.7.0 でエラーの見え方の是正 ＋ アクセスポイント設定＝ADR-0044〜0050 の 7 本、
      0.8.0 で「0 件」と「届いていない」の区別＝[ADR-0051][adr51]（Read 応答の同定）、
      **0.9.0 で Candidate の標準 4 項目 ＋ reference 突合検査 ＋ 利用ガイド 2 本**）。
      各版の詳細は [CHANGELOG][changelog]
- [x] 対応 PORTERS / API バージョン明記の確定（[ADR-0042][adr42]・案A＝**Connect API Version を契約の正**／製品 8.x・9.x は参考。README「対応バージョン」節・PRD §8・CLAUDE.md・コードコメントへ反映済み）
- [x] **0.7.0 リリース**（2026-08-13）— changeset 6 件を消費して `0.6.2` → `0.7.0`。
      `v0.7.0` 自動タグ → back-merge → GitHub Release → OIDC publish まで完了
- [x] **0.8.0 リリース**（2026-08-14）— changeset 1 件を消費して `0.7.0` → `0.8.0`。
      `v0.8.0` 自動タグ → back-merge → GitHub Release → OIDC publish（provenance 付き）まで完了
- [x] **0.9.0 リリース**（2026-08-21）— changeset 2 件を消費して `0.8.0` → `0.9.0`。
      `v0.9.0` 自動タグ → back-merge → GitHub Release → OIDC publish（provenance 付き・7 files / 366.6 kB）まで完了
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
- [x] publish ワークフロー `release.yml`（**Release 公開**で起動・**OIDC Trusted Publishing**・**NPM_TOKEN 不要**・provenance 自動）＋ npm 側の信頼登録済み（0.1.0〜0.9.0 の**全 13 版**で運用実績あり）
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
- レビュー指摘台帳: [findings][findings]（最新スナップショット: [2026-08-16-01][run816]／前回: [2026-08-10-01][run]）
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
[adr51]: adr/0051-read-envelope-identification.md
[adr52]: adr/0052-findings-register-layout.md
[fake-plan]: design/fake-server-plan.md
[fake-runbook]: fake-server-runbook.md
[p7]: adr/0007-oauth-public-surface.md
[p13]: adr/0013-coding-conventions-class-vs-function.md
[rv3]: reviews/2026-06-22-03.md
[run]: reviews/2026-08-10-01.md
[run816]: reviews/2026-08-16-01.md
[adr]: adr/README.md
[findings]: reviews/findings.md
[lv]: live-verification.md
[history]: history/README.md
