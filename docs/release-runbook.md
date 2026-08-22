# リリース手順書（runbook）

- ステータス: living（**半自動**・ADR-0029 案B）。タグ付け・publish は自動／back-merge は当面手動。
- 位置づけ: リリース手順チェックリスト。準備 → main マージで自動タグ → Release 作成 → 自動 publish。
- コマンドは **pnpm** で統一（`npm` は使わない）。

## 0. 初回のみ：npm セットアップ

- [ ] **npm アカウント作成**（<https://www.npmjs.com/>）＋メール認証
  - username は**変更不可**（永続）なので慎重に。ただし公開パッケージ名には出ない（出るのは組織 `@joymerrevent`）。
- [ ] **2 要素認証(2FA)** を有効化（推奨。publish 時に OTP を要求される）
- [ ] **`@joymerrevent` 組織を npm 上で作成**（Free プラン＝公開パッケージは無料）。自分に publish 権限があること。
  - スコープ付き `@joymerrevent/porters-connect` は、npm 側に `@joymerrevent` 組織が無いと publish 不可（[PRD §8][prd] の未確定事項）。
- [ ] `pnpm login`（ローカル認証。CI 化する場合は `NPM_TOKEN`）

## 1. リリース準備（git-flow・develop 上）

- [ ] 各変更 PR に `pnpm changeset`（`.changeset/*.md`）が入っていること（変更の記録）
- [ ] `release/X.Y.Z` ブランチを切る
- [ ] **CHANGELOG を手書き**（[ADR-0026][adr26]・案B）: `.changeset/*.md` の要約を `## [Unreleased]` → `## [X.Y.Z] - YYYY-MM-DD` に転記（Added/Changed/Fixed/Security）。空の `[Unreleased]` 再設置・末尾の compare リンク更新
- [ ] `pnpm changeset:version` で `version` を bump（`changelog: false` なので CHANGELOG は生成されず changeset が消費される）
  - ⚠️ **`.changeset/*.md` が 1 枚も無いと exit 1 で落ちる**（changesets v3 の仕様変更。v2 は黙って exit 0）。
    版を上げたいのに changeset が無い＝**記録漏れ**なので、changeset を書いてからやり直す
    （手で `version` を書き換えて回避しない）。開発ツール限定の変更など**意図的に版を上げない**場合は、
    そもそもこの手順に来ない。
- [ ] コミット（version＋CHANGELOG）
- [ ] 全ゲート green: `pnpm run typecheck` / `pnpm run lint` / `pnpm run format:check` / `pnpm test` / `pnpm run build`
- [ ] **準備中に見つけた欠陥・手順の穴は、このリリース PR に含める**（後回しにしない）。
      後追い PR（§5）に入れてよいのは「**公開が成功して初めて真になる事実**」だけ。

> **どちらに入れるかの判断軸**（0.10.0 で取り違えた実績あり）。
> **リリース PR** — CHANGELOG（**利用者向け・tarball に同梱**）、準備中に判明した欠陥や手順の穴。
> **後追い PR** — 最新公開版・パッケージサイズなど、**publish が終わるまで書けない**もの。
> publish は最後まで確定しない工程（失敗しうる）なので、先に書くと main に嘘が残る。

## 2. main へマージ（タグは自動）

- [ ] PR `release/X.Y.Z` → `main`（**merge commit**・squash しない＝履歴保持）
- [ ] マージ後、**`tag.yml` が自動で `vX.Y.Z` を作成・push**（タグ忘れ防止・ADR-0029 案B）。Actions の **Tag** ワークフロー green を確認
- [ ] **back-merge**（当面手動）: `main` → `develop`（version/CHANGELOG を develop に戻す）
  - `git checkout develop && git pull && git merge --no-edit origin/main && git push`
  - ※ 完全自動化（案F）は GitHub App が要る（`GITHUB_TOKEN` は保護ブランチへ直 push 不可）。未導入

## 3. GitHub Release を作成（＝publish の意図的ゲート）

自動作成された `vX.Y.Z` タグから **GitHub Release を作る**。これが publish の引き金（出すタイミングを人が握る）。

- [ ] `gh release create vX.Y.Z --title "X.Y.Z" --notes "<CHANGELOG の該当節>"`（UI の「Draft a release」でも可）
  - **人 or CC（`gh release create`＝ユーザートークン）が作る**こと。`GITHUB_TOKEN` ワークフロー製の Release は publish を起動しない（落とし穴B）。

## 4. npm 公開（Release 公開で自動・OIDC Trusted Publishing）

§3 で Release を公開した時点で **`.github/workflows/release.yml` が起動し、OIDC で npm に publish** される（**NPM_TOKEN 不要**・provenance 自動・手動 publish 不要）。

- [ ] Actions の **Release** ワークフローが green を確認
- [ ] 確認: `npm view @joymerrevent/porters-connect version` ／ npmjs.com のページ
- ⚠️ **公開した版は上書き不可**。修正は必ず新バージョンで（`unpublish` は厳しく制限・非推奨）。
- 前提（初回のみ）: npmjs.com の該当パッケージ → **Settings → Trusted Publisher** に GitHub Actions（org `Joymerrevent` ／ repo `porters-connect` ／ workflow `release.yml`）を登録済みであること。
- 失敗時の定番: `E404`（scoped）は npm < 11.5.1 が原因 → ワークフローは `npm@latest` に更新してから publish している。

## 5. 公開の記録（後追い PR・develop へ）

**publish が終わってから**、実測した事実をドキュメントに反映する（`docs/` のみ・`src/` は触らない）。

- [ ] 本書「現在の状況」の**最新公開版**と累計版数
- [ ] [roadmap][rm] の公開済み行・リリース記録（`npm view … dist.fileCount dist.unpackedSize` で実測したサイズ）
- [ ] ブランチ経由で PR（**直 push しない**）。過去の例: 0.6.2 / 0.7.0 / 0.8.0 / 0.9.0 / 0.10.0 とも別 PR
- ⚠️ **ここに入れてよいのは「公開が成功して初めて真になる事実」だけ**（§1 の判断軸を参照）。

## 現在の状況

- ✅ 最新公開: **0.10.0**（npm latest・`v0.10.0` タグ・OIDC Trusted Publishing で publish・provenance 付き・2026-08-22）。0.2.0 以降この半自動フローで公開（**全 14 版**）。
- ✅ **`pnpm changeset:version` は復旧済み**（`@changesets/cli` v3 へ更新・2026-08-23）。
  0.10.0 で落ちていた原因は、`pnpm.overrides` の `js-yaml: ">=4.2.0"` が changesets の推移依存
  `read-yaml-file@1.1.0` にも効き、同パッケージが呼ぶ js-yaml v3 の API（`yaml.safeLoad`）が
  v4 以降で削除されていたこと。v3 では `read-yaml-file` が依存から消えたので衝突しない
  （override をスコープで緩める案は不採用＝脆弱な版を意図的に呼び戻すことになるため）。
  なお **changesets v3 は Node `^22.11 || ^24 || >=26`** を要求する。`.node-version` は 22 なので
  通常の開発・CI では問題ないが、**Node 20 では `changeset` コマンドが動かない**
  （install 自体は通る＝ test マトリクスの Node 20 ジョブは影響なし）。
- ✅ 自動化（ADR-0029 案B）：`tag.yml`（main マージで自動タグ）＋ `release.yml`（Release 公開で自動 publish）。0.3.0 以降はこのフロー。
- ⏳ back-merge の完全自動化（案F・GitHub App）は未導入＝当面 §2 の手動手順。

## 関連

- 現況/残タスク: [roadmap][rm]
- 自動化の方式: [ADR-0025][adr25]（リリース自動化）／[ADR-0029][adr29]（タグ・back-merge）
- 変更履歴: [CHANGELOG][cl]

[prd]: design/requirements.md
[rm]: roadmap.md
[adr25]: adr/0025-release-automation.md
[adr26]: adr/0026-changelog-format.md
[adr29]: adr/0029-release-tag-automation.md
[cl]: ../CHANGELOG.md
