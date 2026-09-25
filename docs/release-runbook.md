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
- [ ] **CHANGELOG に名指しした基本設計／詳細設計の ADR に `- Implemented: X.Y.Z` を書き、[ADR 索引][adr-index]の「実装」列も同じ値にする**
      （[RV-56][rv56]。`pnpm check:release` が CHANGELOG の名指しと索引を突き合わせ、`pnpm check:index` が索引と本文を突き合わせる＝忘れると落ちる）
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
  - `main` への PR なので、必須の `stryker` は**必ずフル run**（約 11 分・[ADR-0094][adr94]）。マージ後の `main` への push と
    back-merge PR では、develop との違いが版番号と文書だけなら skip される
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

### squash でマージしてしまったとき（0.17.0 で実施）

`main` への PR を **merge commit ではなく squash** でマージすると、`main` から `develop` の各コミットが
辿れなくなり、**以降の back-merge が毎回競合する**（§2 の注記）。GitHub のマージボタンは**前回選んだ
方式を覚えている**ので、release PR でも squash のまま押してしまうことがある。

**publish 前なら巻き戻せる。** 0.17.0 で実際に行った手順:

1. **先に被害範囲を確認する** — GitHub Release と npm を見る。Release が未作成なら publish は
   起きていない（publish の引き金は Release・§4）。`npm view … version` が前版のままであること
2. **退避を取る** — `git branch backup/squash-X.Y.Z <squash コミット>`
3. **タグを消す** — `tag.yml` が squash コミットに `vX.Y.Z` を付けているので
   `git push --delete origin vX.Y.Z`（ローカルも `git tag -d`）
4. **`main` の保護を一時的に緩める** — force-push は `allow_force_pushes: false` で**管理者でも拒否**される。
   Settings → Branches → `main` → **Allow force pushes** をオン（API なら
   `gh api -X PUT repos/…/branches/main/protection --input <現行設定＋force_push true>`）
5. **巻き戻す** — `git push --force-with-lease=main:<squash コミット> origin <前版のマージコミット>:main`
6. **保護を元に戻す**（必須チェック・レビュー設定も含めて元の値に戻ったことを確認する）
7. **release ブランチを push し直して PR を作り直す** — マージ済み PR は再利用できない。
   マージは **Create a merge commit** を選ぶ
8. マージ後、`tag.yml` が `vX.Y.Z` を付け直す

**publish 済みなら巻き戻さない。** npm は上書き不可なので、履歴の形だけを直す（`release/X.Y.Z` を
もう一度 PR に出して merge commit でマージする＝差分ゼロのマージコミットで親子関係を復元する）。

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

- ✅ 最新公開: **0.24.0**（npm latest・`v0.24.0` タグ・OIDC Trusted Publishing で publish・provenance 付き・
  **10 files / 1063.5 kB**・2026-09-24）。**累計 32 版**（うち **0.2.0 以降の 30 版**がこの半自動フロー）。
  changeset **3 枚**（minor 2・patch 1）を消費した minor リリースで、トークンの取り方と置き場所を分ける
  （[#397][pr397]・[ADR-0091][adr91]）、日時（`DateTime`）の入力をタイムゾーンつきの ISO 8601 に絞る（[#399][pr399]）、
  Refresh Token が拒否されたら `code_direct` で取り直す（[#400][pr400]）。**破壊的変更 2 つ**（CHANGELOG の Changed に明記）。
  - **unpacked は 1037.5 → 1063.5 kB（+26.0 kB）**。同梱ファイル数は 10 のまま。
  - 手順の面では、**#399 と #400 に changeset が入っていなかった**のをリリース準備で見つけ、リリース PR [#402][pr402] の
    最初のコミットで足してから `changeset:version` を実行した（CHANGELOG は手書きなので内容は変わらない）。
    リリース PR の stryker は 10 秒（skip の判定どおり）。`main` の Test / CI / Mutation が green になるのを待ってから
    `gh release create`（notes は CHANGELOG の該当節・参照スタイルのリンクを絶対 URL に解決）→ Release ワークフロー green
    → 直後の `npm view` は 0.23.0 を返し、待って再確認すると 0.24.0（伝播待ち）。back-merge は [#403][pr403]（PR 経由・merge commit）。
- ✅ ひとつ前の **0.23.0**（npm latest・`v0.23.0` タグ・OIDC Trusted Publishing で publish・provenance 付き・
  **10 files / 1037.5 kB**・2026-09-24）。**累計 31 版**（うち **0.2.0 以降の 29 版**がこの半自動フロー）。
  changeset **2 枚**（minor 2）を消費した minor リリースで、カスタム項目を宣言で `create` の必須にする
  （[#388][pr388]・[ADR-0089][adr89]）と、利用者の TypeScript の下限を 5.4 にする（[#392][pr392]・[ADR-0090][adr90]）。
  **5.4 より前の TypeScript の利用者には破壊的**（CHANGELOG の Changed に明記）。
  - **同梱ファイルが 8 → 10**（`dist/requires-newer-typescript.d.ts` と `.d.cts`。5.4 より前の TypeScript の向け先）。
    **unpacked は 955.9 → 1037.5 kB（+81.6 kB）**で、うち 57.7 kB がこの 2 ファイル（各 28.9 kB）。
  - 手順の面では、**リリース PR で stryker が skip された最初の版**（[#385][pr385]）。判定は「develop との違いは
    文書と version だけ」で、stryker は 7 秒（前版は約 11 分）。リリース PR [#393][pr393]（merge commit）→
    Tag ワークフロー green → `gh release create`（notes は CHANGELOG の該当節・参照スタイルのリンクを絶対 URL に
    解決）→ Release ワークフロー green → `npm view` で 0.23.0 を確認。back-merge は [#394][pr394]（PR 経由・merge commit）。
- ✅ ひとつ前の **0.22.0**（npm latest・`v0.22.0` タグ・OIDC Trusted Publishing で publish・provenance 付き・
  **8 files / 955.9 kB**・2026-09-23）。**累計 30 版**（うち **0.2.0 以降の 28 版**がこの半自動フロー）。
  changeset **2 枚**（minor 1・patch 1）を消費した minor リリースで、数値でない文字列を `Number` として読まず
  `validation` で止める修正（[#372][pr372]）、単件の `create` / `update` を reject に揃える修正（[#379][pr379]）、
  使い方ドキュメントの 7 章への組み直し（[#378][pr378]）。**破壊的変更なし**（宣言が実際の項目と違うと
  読み取りがエラーになりうるので minor）。
  - **unpacked が 947.8 → 955.9 kB（+8.1 kB）**。増えたのは同梱 CHANGELOG の追記と数値の検証で、
    **同梱ファイル数は 8 のまま**。
  - 手順の面では、**#379 に changeset が入っていなかった**ので、リリースブランチで足してから
    `pnpm changeset:version` を実行した（記録漏れ＝§1 の注意どおり、手で `version` を書き換えない）。
    リリース PR [#381][pr381]（merge commit）→ Tag ワークフロー green → `gh release create`（notes は CHANGELOG の
    該当節・参照スタイルのリンクなし）→ Release ワークフロー green。publish 直後の `npm view` は 0.21.0 を
    返した（伝播待ち）ので、ログの `+ @joymerrevent/porters-connect@0.22.0` を確認してから 30 秒間隔で再確認し、
    約 1 分半後に 0.22.0 で確定した。back-merge は [#382][pr382]（PR 経由・merge commit）。
- ✅ ひとつ前の **0.21.0**（npm latest・`v0.21.0` タグ・OIDC Trusted Publishing で publish・provenance 付き・
  **8 files / 947.8 kB**・2026-09-21）。**累計 29 版**（うち **0.2.0 以降の 27 版**がこの半自動フロー）。
  changeset **4 枚**（minor 1・patch 3）を消費した minor リリースで、カスタム項目の宣言を `tenant(id, { fields })` で
  受ける [ADR-0087][adr87]（[#362][pr362]・**破壊的変更 1 つ**＝コンストラクタの `fields` 廃止・移行は 1 対 1）と、
  公開 JSDoc（[#363][pr363] / [#364][pr364]）・使い方ドキュメント（[#365][pr365] / [#366][pr366]）から保守者向けの
  識別子を除いた版。
  - **unpacked が 932.5 → 947.8 kB（+15.3 kB）**。増えたのは `tenant(id, { fields })` の実装・JSDoc の書き換え・
    同梱 CHANGELOG の追記ぶんで、**同梱ファイル数は 8 のまま**。
  - 手順の面では前版と同じ形で通った（リリース PR [#367][pr367]・merge commit）: Tag ワークフロー green →
    `gh release create`（notes は CHANGELOG の該当節・参照スタイルのリンクを絶対 URL に解決）→ Release ワークフロー
    green。publish 直後の `npm view` は 0.20.1 を返した（伝播待ち）ので、ログの
    `+ @joymerrevent/porters-connect@0.21.0` を確認してから 30 秒間隔で再確認し、約 1 分後に 0.21.0 で確定した。
    back-merge は [#368][pr368]（PR 経由・merge commit）。
- ✅ ひとつ前の **0.20.1**（npm latest・`v0.20.1` タグ・OIDC Trusted Publishing で publish・provenance 付き・
  **8 files / 932.5 kB**・2026-09-21）。**累計 28 版**（うち **0.2.0 以降の 26 版**がこの半自動フロー）。
  changeset **1 枚**を消費した patch リリースで、0.20.0 直後の定期レビュー（[2026-09-21-01][run20260921]）の
  指摘 3 件の処置（[#355][pr355] / [#356][pr356]）。**破壊的変更なし**。
  - **unpacked が 929.5 → 932.5 kB（+3.0 kB）**。増えたのは `decodeTimeOfDay` の範囲検証と JSDoc だけで、
    **同梱ファイル数は 8 のまま**。
  - 手順の面では、**§1 に足した「CHANGELOG に名指しした設計 ADR の `Implemented`」の手順と `check:release` の
    検査（[RV-56][rv56]）が初めて本番で走った**。この CHANGELOG は [ADR-0086][adr86] を名指しするが、最初の
    名指しは 0.20.0 なので索引の値と一致＝緑。Release 作成・`npm view` の伝播待ち・back-merge（[#358][pr358]・
    PR 経由・merge commit）は前版と同じ形。
- ✅ ひとつ前の **0.20.0**（npm latest・`v0.20.0` タグ・OIDC Trusted Publishing で publish・provenance 付き・
  **8 files / 929.5 kB**・2026-09-21）。**累計 27 版**（うち **0.2.0 以降の 25 版**がこの半自動フロー）。
  changeset **2 枚**を消費した minor リリースで、出典（PORTERS ヘルプセンター）の再取得で見つかった
  未追従 2 件＝ **Department Read**（[#348][pr348]）と **時分型の変換関数**（[ADR-0086][adr86]・[#350][pr350]）。
  **破壊的変更なし**。
  - **unpacked が 896.6 → 929.5 kB（+32.9 kB）**。増えたのはマスタ 1 種（`resources/department.ts`）と
    純関数 2 つ（`util/time-of-day.ts`）と JSDoc で、**同梱ファイル数は 8 のまま**。
  - 手順の面では前版と同じ形で通った: `gh release create` の notes は CHANGELOG の該当節から
    参照スタイルのリンクを**絶対 URL に解決してから**渡し、publish 直後の `npm view` は 0.19.1 を返した
    （伝播待ち）ので、ワークフローのログで `+ @joymerrevent/porters-connect@0.20.0` を確認してから
    約 1 分待って再確認した。back-merge は PR（[#352][pr352]）経由・merge commit。
- ✅ ひとつ前の **0.19.1**（npm latest・`v0.19.1` タグ・OIDC Trusted Publishing で publish・provenance 付き・
  **8 files / 896.6 kB**・2026-09-20）。
  changeset **5 枚**を消費した patch リリースで、定期レビュー（[2026-09-18-01][run20260918]）の指摘
  7 件の処置。**破壊的変更なし** — 公開 API の形は変わらず、**壊れたときの倒れ方**が変わる版。
  - いちばん重いのは **Option の選択肢 alias から書き込み XML を注入できた**こと（[RV-48][rv48] /
    [ADR-0085][adr85]）。公開型が `string[]` なので cast なしで到達でき、**呼び出し側が指定していない
    レコードが書き換わりうる**状態だった。
  - **unpacked が 872.7 → 896.6 kB（+23.9 kB）**。増えたのは検証 1 本（`util/xml-name.ts`）と
    JSDoc で、**同梱ファイル数は 8 のまま**。
  - 手順の面では、**Release 作成を `gh release create` で行った**（runbook §3 の「人 or CC」）。
    参照スタイルのリンク（`[ADR-0085][adr85]`）は **Release 上では定義が無く壊れる**ので、
    CHANGELOG から notes を切り出すときに**絶対 URL へ解決してから**渡した。
- ✅ ひとつ前の **0.19.0**（npm latest・`v0.19.0` タグ・OIDC Trusted Publishing で publish・provenance 付き・
  **8 files / 872.7 kB**・2026-09-18）。changeset **1 枚**を消費した minor リリースで、
  [ADR-0082][adr82] の反映 1 本。
  **破壊的変更は 1 つ**（`engines.node` が `>=20` → `>=22.12.0`）＝ API は変わらないので、利用者の影響は
  **Node 20 に留まっている場合だけ**。
  - **同梱ファイルが 7 → 8 に増えた**のは `dist/index.d.cts`（`.d.ts` のコピー）を足したため。
    unpacked も 727.9 → 872.7 kB（+144.8 kB）。**実体は 1 つのまま**で、増えたのは型定義だけ。
  - 手順の面では、`pnpm changeset:version` が消した `.changeset/*.md` を `git add -A` で索引に
    反映するまで **`check:links` が赤くなる**（索引に残ったファイルが読めない、と報告する）。
    検査の指示どおり `git add -A` すれば解消する＝**落ちること自体が正しい**。
- ✅ ひとつ前の **0.18.0**（npm latest・`v0.18.0` タグ・**7 files / 727.9 kB**・2026-09-17）。
  changeset **5 枚**を消費した minor リリース。**破壊的変更を 4 つ**含む
  （アクセスポイントの `host` 廃止・[ADR-0078][adr78] ／ 束ねた項目は書き込み入力から外れる・[RV-47][rv47] ／
  Field マスタの Read が `of()` 経由・[ADR-0080][adr80] ／ 添付の Read が出典の語彙・[ADR-0081][adr81]）。
  あわせて `resourceValueOf` / `resourceNameOf` を公開した。
  - **4 つの変更を 1 版にまとめた**のは、どれも「`resource` をどう受けるか」という同じ問いから
    出てきたため。破壊的変更を小出しにするより、**利用者が 1 回だけ直せば済む**ほうを採った。
- ✅ **0.17.0**（npm latest・`v0.17.0` タグ・**7 files / 705.2 kB**・2026-09-16）。
  changeset **3 枚**を消費した minor リリース。**破壊的変更を 2 つ**含む
  （添付の本体は `get` でだけ取れる・[ADR-0075][adr75] ／ Phase の Read から `keywords` / `itemstate` が
  消える・[ADR-0076][adr76]）。あわせて `searchAll` と `createFetchTransport` を公開した。
  - **この版は `main` へ squash でマージしてしまい、巻き戻してやり直した**（下記「squash でマージして
    しまったとき」）。publish 前だったので実害は無し。
- ✅ **0.16.0**（npm latest・`v0.16.0` タグ・**7 files / 686.3 kB**・2026-09-15）。
  changeset **1 枚**を消費した minor リリース。**破壊的変更**
  （`field` が未宣言のカスタム項目を受け付けなくなる・[ADR-0074][adr74]）を含み、
  逃げ道として `rawValue` を公開した。
  - **publish 直後の `npm view` は前版を返す**。Release ワークフローが green でも、npm は
    `Your package is being processed and may take a few minutes to become available.` と返しており、
    レジストリへの反映に数分かかる。**伝播待ちと publish 失敗は外から見ると同じ**なので、
    慌てて再実行せず、ワークフローのログで `+ @joymerrevent/porters-connect@X.Y.Z` を確認してから待つ。
- ✅ **0.15.1**（2026-09-13・7 files / 676.8 kB）は開発・CI だけの patch リリースで、
  `dist` の中身は 0.15.0 と同一（開発用依存の脆弱性 5 件と Actions の権限を整理した版）。
  - **この版も §5 の後追い記録が行われておらず**、本書の「最新公開」も [roadmap][rm] の公開済み行も
    0.15.0 のままだった（0.13.0 と同じ取りこぼし）。0.16.0 の記録と併せて追いつかせた。
    **記録を落としやすいのは「利用者向けの変更が無い版」** という共通点がある。
- ✅ ひとつ前の **0.15.0**（2026-09-13・7 files / 673.7 kB）は changeset **5 枚**を消費した minor リリース。
  挙動が 2 つ変わる版で、**破壊的変更**（宣言型と実データの形が食い違うと `null` ではなくエラー・RV-36）と
  **既定の挙動変更**（スロットルの共有単位が client ごと → ホストごと・[ADR-0073][adr73]・RV-43）を含む。
- ✅ **0.14.0**（2026-09-09・7 files / 613.8 kB）は changeset **1 枚**を消費した minor リリースで、
  `Link` / `Image` の対応＝ Data Type 17/17（[ADR-0060][adr60] D3）の版。
  - **0.13.0**（2026-09-06・7 files / 569.5 kB）は User マスタの標準項目を 4→17 に揃えた版
    （D2）。**この版は §5 の後追い記録が行われておらず**、本書の「最新公開」も roadmap の公開済み行も
    0.12.x のままだった。0.14.0 の記録と併せて追いつかせた。
  - **数え方の注記**: 以前ここに書いていた「0.2.0 以降この半自動フローで公開（全 17 版）」の 17 は、
    実際には**0.1.x を含む当時の累計**（0.12.1 時点）だった。0.2.0 以降だけなら当時 15 版。
    同じ取り違えを繰り返さないよう、上では**累計**と**フロー適用分**を分けて書いている。
  - 0.12.1（2026-09-03・7 files / 563.5 kB）は changeset 2 枚を消費した patch、
    0.12.0（2026-08-31・7 files / 553.4 kB）は changeset 7 枚を消費した全リソース網羅の版。
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
  → **2026-09-18 にこの制約は消えた**。[ADR-0082][adr82] で `engines` を `>=22.12.0` に上げ、
  test マトリクスからも Node 20 を外したため、下限が changesets の要求を満たす。

> 📌 **「v3」が 2 つ出てくるので注意**（読み違えやすい）。
>
> | 表記              | 何                | 位置づけ                                              |
> | ----------------- | ----------------- | ----------------------------------------------------- |
> | **js-yaml v3**    | YAML パーサ       | **古い・脆弱**。`safeLoad` を持つ。戻してはいけない側 |
> | **changesets v3** | `@changesets/cli` | **最新**。2.31.1 から上げた側                         |
>
> 今回やったのは **changesets の版上げ（2 → 3）** であって、**js-yaml のダウングレード（4 → 3）ではない**。
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
`.node-version` は 22・`release.yml` も同ファイル参照のため実害はない
（その代償も [ADR-0082][adr82] で下限を 22.12 に上げた時点で消えた）。
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
[adr-index]: adr/index.md
[rv56]: reviews/rv/0056-adr-implemented-column-stale.md
[adr29]: adr/0029-release-tag-automation.md
[adr30]: adr/0030-backmerge-method.md
[adr82]: adr/0082-module-format-and-node-baseline.md
[adr39]: adr/0039-commitlint-release-range.md
[adr60]: adr/0060-full-resource-coverage-direction.md
[adr62]: adr/0062-backmerge-via-pull-request.md
[cl]: ../CHANGELOG.md
[run20260918]: reviews/2026-09-18-01.md
[rv48]: reviews/rv/0048-option-alias-xml-injection.md
[adr85]: adr/0085-option-alias-validation.md
[findings]: reviews/findings.md
[adr73]: adr/0073-throttle-sharing.md
[adr74]: adr/0074-custom-field-declaration-required.md
[adr75]: adr/0075-attachment-search-all.md
[adr76]: adr/0076-phase-read-query-surface.md
[adr78]: adr/0078-hostname-port-split.md
[adr80]: adr/0080-resource-parameter-binding.md
[adr81]: adr/0081-attachment-read-parameters.md
[rv47]: reviews/rv/0047-phase-binding-overridable.md
[pr348]: https://github.com/Joymerrevent/porters-connect/pull/348
[pr350]: https://github.com/Joymerrevent/porters-connect/pull/350
[pr352]: https://github.com/Joymerrevent/porters-connect/pull/352
[pr355]: https://github.com/Joymerrevent/porters-connect/pull/355
[pr356]: https://github.com/Joymerrevent/porters-connect/pull/356
[pr358]: https://github.com/Joymerrevent/porters-connect/pull/358
[run20260921]: reviews/2026-09-21-01.md
[adr86]: adr/0086-time-of-day-fields.md
[adr87]: adr/0087-tenant-scoped-field-declarations.md
[pr362]: https://github.com/Joymerrevent/porters-connect/pull/362
[pr363]: https://github.com/Joymerrevent/porters-connect/pull/363
[pr364]: https://github.com/Joymerrevent/porters-connect/pull/364
[pr365]: https://github.com/Joymerrevent/porters-connect/pull/365
[pr366]: https://github.com/Joymerrevent/porters-connect/pull/366
[pr367]: https://github.com/Joymerrevent/porters-connect/pull/367
[pr368]: https://github.com/Joymerrevent/porters-connect/pull/368
[pr372]: https://github.com/Joymerrevent/porters-connect/pull/372
[pr378]: https://github.com/Joymerrevent/porters-connect/pull/378
[pr379]: https://github.com/Joymerrevent/porters-connect/pull/379
[pr381]: https://github.com/Joymerrevent/porters-connect/pull/381
[pr382]: https://github.com/Joymerrevent/porters-connect/pull/382
[pr385]: https://github.com/Joymerrevent/porters-connect/pull/385
[pr388]: https://github.com/Joymerrevent/porters-connect/pull/388
[pr392]: https://github.com/Joymerrevent/porters-connect/pull/392
[pr393]: https://github.com/Joymerrevent/porters-connect/pull/393
[pr394]: https://github.com/Joymerrevent/porters-connect/pull/394
[pr397]: https://github.com/Joymerrevent/porters-connect/pull/397
[pr399]: https://github.com/Joymerrevent/porters-connect/pull/399
[pr400]: https://github.com/Joymerrevent/porters-connect/pull/400
[pr402]: https://github.com/Joymerrevent/porters-connect/pull/402
[pr403]: https://github.com/Joymerrevent/porters-connect/pull/403
[adr89]: adr/0089-custom-field-required-on-create.md
[adr90]: adr/0090-typescript-floor.md
[adr91]: adr/0091-token-provider-and-store.md
[adr94]: adr/0094-mutation-changed-files-on-pr.md
