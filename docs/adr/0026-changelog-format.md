# 26. CHANGELOG の生成方式（Keep a Changelog 手書き vs changesets 生成）

- Status: accepted
- Date: 2026-06-20
- Deciders: jun.shiromoto (Joymerrevent)

> [ADR-0025][adr25]（changesets 採用）の**サブ論点を分離**して確定するための ADR。
> 0.2.0 リリースを機に、CHANGELOG の最終的な書式と生成方式を決める。

## Context and Problem Statement

ADR-0025 で changesets を採用した。changesets は version bump と CHANGELOG 生成を担えるが、
**生成する書式が現行の [Keep a Changelog][kac] 形式と異なる**（日付・Added/Changed/Fixed/Security 節・
version 比較リンクが無く、bump 種別でグルーピングする）。0.1.x は Keep a Changelog で丁寧に整備済み。
0.2.0 以降の CHANGELOG をどちらの書式・どの生成方式にするか。

## Decision Drivers

- **品質（北極星「公認に値する品質」）**: CHANGELOG は npm / GitHub で利用者が読む一次成果物。読みやすさ・分類・日付が効く。
- **自動化・人手削減**（ADR-0025 の動機）: 毎リリースの手作業を減らしたい。
- **記録漏れ防止**: 変更を PR 時点で記録したい（changeset の利点）。
- **一貫性**: 0.1.x（Keep a Changelog）との見え方の連続性。

## Considered Options

### 案A: changesets 生成形式に統一（`changelog` 既定）

`changeset version` が CHANGELOG を自動生成（`## x.y.z` → `### Minor/Patch/Major Changes` → 要約箇条書き）。

### 案B: Keep a Changelog を維持・手書き（`changelog: false` ＋ changesets は versioning のみ）

changeset は version bump と「何が変わったか」の PR 時点記録に使い、`changelog: false` で CHANGELOG 自動生成は止める。
**リリース時に changeset の要約を Keep a Changelog 形式へ転記**（日付・Added/Changed/Fixed/Security・compare リンク）。

### 案C: custom changelog generator

changesets から Keep a Changelog 風を出すカスタム generator を実装。

## Decision Outcome

**決定（accepted・2026-06-20）：案B を採用。** Keep a Changelog 形式を維持・手書きし、changesets は version bump（versioning）のみに使う（`changelog: false`）。理由は下記「推奨」のとおり。

### 推奨（私案）

**案B（Keep a Changelog 手書き・changesets は versioning のみ）を推奨。** 理由：

- CHANGELOG は利用者向け一次成果物で、**Added/Changed/Fixed/Security の意味分類＋日付＋compare リンク**の読み手価値が高い（北極星「品質」直結）。
- changeset を **PR 時点の変更記録**に使えば記録漏れは防げる（content は捕捉）。リリース時に Keep a Changelog へ転記するだけ。
- リリースは deliberate・低頻度なので転記コストは小。

> 決定後 accepted にし、`.changeset/config.json` の `changelog` と [release-runbook][rb] を反映する。

### Consequences

- `.changeset/config.json` の `changelog` を **`false`** に設定（changesets は CHANGELOG を生成しない）。
- changeset は **PR 時点の変更記録**＋ **version bump** に使う。`pnpm changeset:version` は version を上げ changeset を消費するが CHANGELOG は触らない。
- **CHANGELOG はリリース時に手書き**：`.changeset/*.md` の要約を Keep a Changelog 形式（`## [X.Y.Z] - 日付`・Added/Changed/Fixed/Security・末尾 compare リンク）へ転記する。0.1.x と書式一貫。
- [release-runbook][rb] §1 を上記フローに更新（**実装は別 PR**）。

## Pros and Cons of the Options

### 案A changesets 生成

- Good: CHANGELOG の手作業ゼロ。version bump と一体。要約は changeset で日本語 curated。
- Bad: **bump 種別でのグルーピングのみ**＝Added/Changed/Fixed/Security の意味分類が出せない（changeset は型を持たない）。日付・compare リンク無し。0.1.x と書式が混在。

### 案B Keep a Changelog 手書き

- Good: 読み手最適の書式・分類・日付・リンクを維持。0.1.x と一貫。記録漏れは changeset で担保。
- Bad: リリース時に転記の手作業（低頻度なら小）。完全自動ではない。

### 案C custom generator

- Good: 書式維持＋自動。
- Bad: **bump 種別 → Added/Changed の意味変換はできない**（情報が無い）。日付・リンクは追加実装。保守コストの割に実質 A の見た目調整止まり。

## More Information

- 親 ADR: [ADR-0025][adr25]（changesets 採用）。本 ADR はその CHANGELOG 形式サブ論点。
- 参照: [Keep a Changelog][kac] ／ [changesets][cs]。

[kac]: https://keepachangelog.com/en/1.1.0/
[cs]: https://github.com/changesets/changesets
[adr25]: 0025-release-automation.md
[rb]: ../release-runbook.md
