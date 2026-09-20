---
name: release
description: >-
  @joymerrevent/porters-connect のリリースを runbook どおりに進める。
  「リリースして」「X.Y.Z を出して」「公開して」「版を上げて」「npm に出して」
  などと言われたら、たとえ "スキル" と明示されなくても必ずこのスキルを使う。
  手順の正典は docs/release-runbook.md で、このスキルはそれを読ませたうえで、
  ベースの取り違え・ゲートの言い抜け・publish 後の記録漏れという
  過去に実際に起きた 3 つの落ち方を塞ぐ駆動役に徹する。
---

# Release — porters-connect のリリース実行

## このスキルの前提（なぜこの形か）

- **手順の正典は `docs/release-runbook.md`**（living・半自動／ADR-0029 案B）。
  **このスキルに手順を書き写さない**。写した時点で二重管理になり、runbook が更新されても
  スキルが古い手順を主張する。それは本プロジェクトが繰り返し踏んできた
  **ドキュメント ↔ 実態のドリフト**そのものを、検査の効かない場所に持ち込むことになる。
- リリースは**戻せない工程**を含む（npm は上書き不可・runbook §4）。だから
  「たぶん通った」で先へ進まない。**ゲートは実出力を見てから次へ行く**。
- **マージはユーザーが行う**。CC は PR を出すところまで。マージは本番公開の連鎖
  （タグ自動付与 → Release → publish）を起動しうるので、引き金は人が握る。
- コマンドは **pnpm** で統一する（`npm` は使わない・runbook 冒頭）。
  例外は `npm view`（レジストリの参照）だけ。

## 実行フロー

1. **版を決める** — 破壊的変更の有無を `.changeset/*.md` と差分から判断し、semver のどれかを
   ユーザーに確認する。`engines` の引き上げも破壊的変更（0.19.0 の実績）。

2. **ベースを明示して切る** — 取り違えが実際に起きているので、**切った先の SHA を出してから**進む:

   ```sh
   git fetch origin
   git switch -c release/X.Y.Z origin/develop   # 準備は develop 上（runbook §1）
   git rev-parse --short HEAD
   ```

3. **runbook §1 を上から実行する** — 開いてチェックリストどおりに進める。先に
   `ls .changeset/*.md` を見る（**0 枚だと `changeset:version` が exit 1**＝記録漏れの合図。
   手で `version` を書き換えて回避しない）。

4. **ゲートを通す** — まとめて `pnpm check`、加えて runbook §1 が挙げる
   `pnpm typecheck` / `pnpm lint` / `pnpm format:check` / `pnpm test` / `pnpm build`。
   **赤があれば直してから再実行**する。赤を抱えたまま PR にしない。
   準備中に見つけた欠陥・手順の穴は**このリリース PR に含める**（後回しにしない・runbook §1 の判断軸）。

5. **PR を作ってユーザーに渡す** — `release/X.Y.Z` → `main`。
   PR 本文には**実行したゲートの出力**（要約ではなく結果そのもの）を添える。
   **ここで止まる**。マージ方式（**merge commit**・squash しない）は PR 本文に明記して、
   ユーザーが押し間違えないようにする（0.17.0 で squash して巻き戻した実績がある）。

6. **マージ後**（ユーザーがマージしたら）— runbook §2〜§4 に従う。
   Tag ワークフロー green → `gh release create` → Release ワークフロー green →
   `npm view @joymerrevent/porters-connect version` で反映を確認。
   **publish 直後の `npm view` は前版を返すことがある**（伝播待ち・0.16.0 の実績）。
   ワークフローのログで publish 成功を確認してから待つ。慌てて再実行しない。
   あわせて back-merge（`main` → `develop`・**PR 経由**・merge commit）。

7. **公開を記録する（後追い PR・develop へ）** — runbook §5。
   **落としやすいのは「利用者向けの変更が無い版」**（0.13.0 / 0.15.1 で実際に落ちた）ので、
   patch でも必ず行う。入れてよいのは**公開が成功して初めて真になる事実**だけ。

## 主張するときの作法

リリースの各段は、外から見て成否が紛らわしい（伝播待ちと publish 失敗は同じに見える、
squash は押した本人に見えない、ゲートは緑に見えて fail-open のことがある）。

- 「green」「通った」「公開された」は、**対応するコマンド出力か Actions の結果を見てから**書く。
- 見ていないものは「未確認」と書く。**推測を事実の語で書かない**。
- ゲートが落ちた事実は隠さずそのまま報告する（落ちること自体が正しい場面がある。
  例: `changeset:version` の後に `git add -A` するまで `check:links` は赤い・0.19.0 の実績）。

## やらないこと

- **`gh pr merge` を実行しない**（マージはユーザー）。
- **手順を runbook から写経しない**。runbook と実態が食い違っていたら、**runbook のほうを直す**。
- `package.json` の `version` を手で書き換えない（`pnpm changeset:version` を使う）。
- 手で `npm publish` しない（Release 公開が引き金・OIDC Trusted Publishing）。
- publish 前に runbook の「最新公開」や roadmap の公開済み行を書き換えない。
  publish は最後まで確定しないので、先に書くと `main` に嘘が残る。
