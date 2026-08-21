# RV-9 🟡 単調増加チェックの baseline が back-merge ラグで誤検知する

- 重要度: 🟡 ／ 観点: アーキテクチャ / リリース
- 状態: fixed

## 概要

[ADR-0031][adr31] の版番号単調増加検証の baseline が**グローバル最大タグ**だった。
git-flow のリリースは「release ブランチで version bump → main へ直マージ → 自動タグ →
**手動** back-merge」の順なので、**タグ作成と back-merge の間は develop の version が最新タグより低い**。
この窓で develop への通常 PR が「版の逆行」として落ちる。

## 根拠

- `scripts/check-release-invariants.mjs:96` — `git tag --list`（全タグ）。
- 同 `:32-40` — `maxTagVersion` がグローバル最大を取る。
- 同 `:84` — `compareSemver(version, baseline) < 0` で失敗。
- `.github/workflows/ci.yml` — checkout は `fetch-tags: true`（shallow のまま＝到達可能性の判定材料が無い）。
- `docs/adr/0031-version-number-validation.md` — Considered Options「通常 PR では version == baseline」／
  Decision Outcome「毎 PR 安全」。
- `docs/release-runbook.md:27-31`・[ADR-0030][adr30] — main 直マージ → 自動タグ → **手動** back-merge の順。

## 影響

**リリースのたびに、無関係な PR が巻き込まれて落ちる**（例: develop = 0.2.0 ／ 最新タグ v0.3.0）。
より本質的な問題は、[ADR-0031][adr31] が掲げた「通常 PR では version == baseline ＝毎 PR 安全」という
**前提そのものが成立していない**こと＝決定と実装の乖離。しかも回避策が
「back-merge を忘れず即実行する」という**人の注意**への依存になり、
「人の記憶でなく仕組みで守る」というこの repo の方針と逆を向く。
現状 develop = 最新タグで**未発火＝latent** だが、次のリリースの back-merge 窓で必ず踏む。

## 検出経緯

[2026-06-22-01][run622] のレビュー。リリース自動化（[ADR-0029][adr29]/[ADR-0031][adr31]）が
入った直後に、git-flow の手順と検査の baseline 定義を時系列で突き合わせて判明した。

## 推奨

いずれか — (a) baseline を **HEAD から到達可能な最大タグ**に変える
（main のタグは develop の祖先でないため除外される。ただし `fetch-depth: 0` が要り CI が重くなる）、
(b) 単調増加検査を**リリース文脈に限定**（base = main の PR / release ブランチのみ）、
(c) [ADR-0031][adr31] を amend して back-merge をタグ直後の必須手順にする（人の手順に依存＝弱い）。
いずれも baseline の定義に関わるため **ADR amend を伴う**。

## 処置

[ADR-0032][adr32] を **accepted**（案A＝単調増加検証 (2) を base = main の PR に限定）ののち実装。
`scripts/check-release-invariants.mjs` で (2) を `releaseContext`
（`process.env.GITHUB_BASE_REF === "main"`）ガード下に置き、develop の通常 PR・push・local では skip する。
形式検証 (1)・baseline（直近 git タグ）・自前比較は [ADR-0031][adr31] のまま不変。

## 検証

- 版の逆行は **publish 経路（必ず main 向け PR を通る）で確実に弾かれる**ため実害なし。
- CI も据え置き（`fetch-depth: 0` 不要＝重くならない）。
- release 文脈で逆行を検知し、非 release 文脈では skip することを
  `scripts/check-release-invariants.test.mjs` で pin した。
- [ADR-0031][adr31] (2) の実行範囲は [ADR-0032][adr32] で superseded（本文は不変・supersede 注記のみ追記）。

[adr29]: ../../adr/0029-release-tag-automation.md
[adr30]: ../../adr/0030-backmerge-method.md
[adr31]: ../../adr/0031-version-number-validation.md
[adr32]: ../../adr/0032-monotonic-check-release-scope.md
[run622]: ../2026-06-22-01.md
