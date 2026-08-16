# RV-9 🟡 単調増加チェックの baseline が back-merge ラグで誤検知

- 重要度: 🟡 ／ 観点: アーキテクチャ / リリース
- 状態: fixed

## 概要

ADR-0031 の単調増加検証の baseline が**グローバル最大タグ**（`git tag --list` の最大版）。git-flow のリリースは「release ブランチで version bump → **main** へ直マージ → `tag.yml` が `vX.Y.Z` 作成 → **手動** back-merge で develop に version 反映」（ADR-0030 案H・runbook §2）の順なので、**「タグ作成」と「手動 back-merge」の間は develop の version が最新タグより低い**。この窓で develop への通常 PR が `version < baseline` ＝「版の逆行」で落ちる（例: develop=0.2.0／最新タグ v0.3.0）。ADR-0031 が掲げた「通常 PR では version==baseline ＝毎 PR 安全（通常 PR を落とさない）」前提が back-merge ラグを見落としている（決定↔実装の乖離）。「人の注意でなく仕組みで守る」はずが、誤検知回避を「back-merge を忘れず即実行」という人の注意に依存させてしまう

## 根拠

`scripts/check-release-invariants.mjs:96`（`git tag --list`＝全タグ）/ `:32-40`（`maxTagVersion`＝グローバル最大）/ `:84`（`compareSemver(version, baseline) < 0` で失敗）/ `.github/workflows/ci.yml`（checkout は `fetch-tags: true`＝shallow のまま・到達可能性判定用の履歴は無い）/ `docs/adr/0031-version-number-validation.md`（Considered Options「通常 PR では version == baseline」・Decision Outcome「毎 PR 安全」）/ `docs/release-runbook.md:27-31`（main 直マージ→自動タグ→手動 back-merge の順）/ `docs/adr/0030-backmerge-method.md`（back-merge は手動＝ラグ源）

## 推奨

いずれか — (a) baseline を **HEAD から到達可能な最大タグ**に変更（`git describe --tags --abbrev=0` 等。main のタグは develop の祖先でないため除外され、develop=据え置きでも pass。ただし到達可能性判定に `fetch-depth: 0` が要る＝CI を一段重く）。(b) 単調増加検査を**リリース文脈に限定**（base=main の PR / release ブランチのみで実施し、develop の通常 PR では skip）。(c) ADR-0031 を amend し「back-merge を tag 直後の必須ステップ化」＋窓の許容を明記（仕組みでなく手順で担保＝フェイルセーフとしては弱い）。いずれも ADR-0031 の baseline 定義（案A「直近の git タグ」の解釈＝グローバル最大 vs 到達可能最大）に関わるため **ADR amend を伴う**。現状 develop=0.2.0＝最新タグで未発火＝latent（今は緑だが次回リリースの back-merge 窓で develop PR を巻き込む）

## 処置

[ADR-0032][adr32] accepted（案A：単調増加検証(2)を base=main の PR に限定）。`scripts/check-release-invariants.mjs` で (2) を `releaseContext`（`process.env.GITHUB_BASE_REF === "main"`）ガード下に変更＝develop の通常 PR・push・local では skip。形式検証(1)・baseline（直近 git タグ）・自前比較は ADR-0031 のまま不変。版の逆行は publish 経路（必ず main 向け PR を通る）で確実に弾くため実害なし・CI も据え置き（`fetch-depth:0` 不要）。release 文脈で逆行検知／非 release 文脈で skip するテストを追加（`check-release-invariants.test.mjs`）。ADR-0031 (2) の実行範囲は ADR-0032 で superseded（ADR-0031 本文は不変・supersede 注記のみ追記）

[adr32]: ../../adr/0032-monotonic-check-release-scope.md
