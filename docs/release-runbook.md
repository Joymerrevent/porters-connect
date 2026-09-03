# リリース手順書（runbook）

- ステータス: living（**半自動**・ADR-0029 案B）。タグ付け・publish は自動／back-merge は手動（**PR 経由**・ADR-0062）。
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
- [ ] **back-merge**（手動・**PR 経由**／[ADR-0062][adr62]）: `main` → `develop`（version/CHANGELOG を develop に戻す）
  - `gh pr create --base develop --head main --title "chore: X.Y.Z を develop へ back-merge する"`
  - [ ] `ci` / `stryker` の green を確認して **merge commit** でマージ（**squash しない**）
  - ⚠️ **squash すると `develop` に `main` と異なるコミットができ、次回以降の back-merge が毎回競合する**。
  - ※ **直 push はしない**。`git merge origin/main && git push` は `develop` の保護（PR 必須・必須ステータス
    チェック）を**管理者権限で bypass して通ってしまう**（0.12.0 で判明・[findings][findings] RV-33）。
    PR 経由なら「develop へ入る変更は必ず PR ＋ チェック green」が本当になり、管理者以外でも実行できる。
  - ※ PR タイトルは commitlint の検査対象（base≠`main`・[ADR-0039][adr39]）＝ `chore: …` の形にする。
  - ※ 完全自動化（案I・GitHub App）は未導入（`GITHUB_TOKEN` は保護ブランチへ直 push 不可）。

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

- ✅ 最新公開: **0.12.1**（npm latest・`v0.12.1` タグ・OIDC Trusted Publishing で publish・provenance 付き・
  7 files / 563.5 kB・2026-09-03）。0.2.0 以降この半自動フローで公開（**全 17 版**）。
  changeset **2 枚**を消費した patch リリースで、`pnpm changeset:version` は問題なく動いた（復旧後 3 回目）。
  ひとつ前の 0.12.0（2026-08-31・7 files / 553.4 kB）は changeset 7 枚を消費した全リソース網羅の版。
- ✅ **back-merge は PR 経由に変更済み**（[ADR-0062][adr62] accepted・2026-09-03／[findings][findings] RV-33）。
  0.12.0 まで使っていた直 push（`git merge origin/main && git push`）は、`develop` の
  「Changes must be made through a pull request」「Required status check」を**bypass した**という
  警告つきで成功していた（管理者権限のため・**必須チェックの完了も待たずに**通っていた）。
  **0.12.1 から本書 §2 の PR 手順に移行済み**。初回適用の実測（2026-09-03・back-merge PR **#216**）:
  **必須チェックの完了まで約 84 秒**、merge commit でマージして完了。bypass 警告は出なくなった
  （＝保護を迂回していない）。手順として増えたのはマージ操作 1 回分だけで、待ち時間も想定内。
- ✅ **`pnpm changeset:version` は復旧済み**（**`@changesets/cli` を 2.31.1 → 3.0.0 へ上げた**・2026-08-23）。
  原因は、`pnpm.overrides` の `js-yaml: ">=4.2.0"` が changesets の推移依存 `read-yaml-file@1.1.0`
  （`js-yaml: ^3.6.1` を宣言）にも効き、同パッケージが呼ぶ **js-yaml v3** の API（`yaml.safeLoad`）が
  **js-yaml v4** 以降で削除されていたこと。**changesets v3** では `read-yaml-file` が依存から消えるので衝突しない
  （override をスコープで緩める案は不採用＝脆弱な版を意図的に呼び戻すことになるため）。
  なお **changesets v3 は Node `^22.11 || ^24 || >=26`** を要求する。`.node-version` は 22 なので
  通常の開発・CI では問題ないが、**Node 20 では `changeset` コマンドが動かない**
  （install 自体は通る＝ test マトリクスの Node 20 ジョブは影響なし）。

> 📌 **「v3」が 2 つ出てくるので注意**（読み違えやすい）。
>
> | 表記              | 何                | 位置づけ                                              |
> | ----------------- | ----------------- | ----------------------------------------------------- |
> | **js-yaml v3**    | YAML パーサ       | **古い・脆弱**。`safeLoad` を持つ。戻してはいけない側 |
> | **changesets v3** | `@changesets/cli` | **最新**。2.31.1 から上げた側                         |
>
> 今回やったのは **changesets の版上げ（2 → 3）**であって、**js-yaml のダウングレード（4 → 3）ではない**。
> js-yaml は override どおり v5 系のまま。

- ✅ 自動化（ADR-0029 案B）：`tag.yml`（main マージで自動タグ）＋ `release.yml`（Release 公開で自動 publish）。0.3.0 以降はこのフロー。
- ⏳ back-merge の完全自動化（案I・GitHub App）は未導入＝ §2 の手動手順（PR 経由）で行う。

### `changeset:version` が壊れていた期間（2026-08-23 に判明）

**「changesets を上げたら壊れた」のではなく、導入初日から一度も動いていなかった。**
override が先、changesets の導入が翌日という順序だったため、最初から噛み合っていなかった。

| 日付       | 出来事                                                            |
| ---------- | ----------------------------------------------------------------- |
| 2026-06-19 | PR #53 で脆弱性対応として `js-yaml: ">=4.2.0"` の override を追加 |
| 2026-06-20 | PR #64 で changesets を導入 ← **この時点ですでに壊れていた**      |
| 2026-08-22 | 0.10.0 のリリース作業で発覚                                       |
| 2026-08-23 | `@changesets/cli` を 2.31.1 → 3.0.0 へ上げて解消                  |

ロックファイルを遡ると、changesets 導入初日から `read-yaml-file` 配下は `js-yaml@4.2.0` に
差し替わっている（`safeLoad` は v4.0.0 で削除済）。以降 5.2.1 → 5.2.3 と上がった。
このリポジトリの `@changesets/cli` は **2.31.0 → 2.31.1 しか動いていない＝版上げは原因ではない**。

**教訓**: [roadmap][rm] の 0.7.0〜0.9.0 は「changeset N 件を消費して」と記録しているが、
上の事実と矛盾する（実際は手作業だったとみられる）。**ツールが緑を返したことを確認せずに
記録を書くと、こういう嘘が残る**＝記録は実行結果に基づいて書く。

#### なぜ changesets の版上げを選んだか（採らなかった案の記録）

有力な代替として **`read-yaml-file` を js-yaml v4 対応版（2.1.0）へ override する案**があった。
`read-yaml-file@2.1.0` は 1.1.0 とエクスポートが完全に同一（`module.exports` / `.default` / `.sync`・CJS のまま）で、
差分は `yaml.safeLoad` → `yaml.load` の 1 行だけ。実機で `changeset version` が通ることも確認済みで、
**lockfile 差分は 31 行**（changesets の版上げは 643 行）・changesets は 2.31.1 のまま・Node 20 も維持できる。

```json
"overrides": { "js-yaml": ">=4.2.0", "read-yaml-file": ">=2.1.0 <3" }
```

それでも採らなかったのは、**今回壊れたのと同じ機構をもう一度使う**ことになるため。
`@manypkg/get-packages@1.1.3` は `read-yaml-file: ^1.1.0` と宣言しており、そこへ major を押し込む＝
**override が宣言 semver を踏み越える**構造は障害の原因そのものだった。いま動くのは API がたまたま
同一だからであって、semver が保証したことではない。壊れ方で比べると差が出る：

| 案                          | 失敗モード                                                                |
| --------------------------- | ------------------------------------------------------------------------- |
| override 追加（不採用）     | install は通り、**リリース当日に `TypeError`** で落ちる＝遅く静かに壊れる |
| changesets の版上げ（採用） | override 不要＝解決器が宣言範囲を検査し、**非互換なら install が落ちる**  |

「壊れたときに安全側へ倒れる」で選ぶなら後者。代償は「Node 20 で `changeset` が動かない」だけで、
`.node-version` は 22・`release.yml` も同ファイル参照のため実害はない。
`pnpm patch` で `safeLoad` を書き換える案は、同じ修正を上流の公開版で得られるのに自前の patch ファイルを
恒久的に抱えることになるため、上記 override 案に劣る＝検討から外した。

## 関連

- 現況/残タスク: [roadmap][rm]
- 自動化の方式: [ADR-0025][adr25]（リリース自動化）／[ADR-0029][adr29]（タグ・back-merge）／
  [ADR-0030][adr30]（back-merge は手動）／[ADR-0062][adr62]（back-merge も PR を通す）
- 変更履歴: [CHANGELOG][cl]

[prd]: design/requirements.md
[rm]: roadmap.md
[adr25]: adr/0025-release-automation.md
[adr26]: adr/0026-changelog-format.md
[adr29]: adr/0029-release-tag-automation.md
[adr30]: adr/0030-backmerge-method.md
[adr39]: adr/0039-commitlint-release-range.md
[adr62]: adr/0062-backmerge-via-pull-request.md
[cl]: ../CHANGELOG.md
[findings]: reviews/findings.md
