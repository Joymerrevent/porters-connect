# 31. リリース版番号の自動検証（semver 形式・単調増加）

- Status: accepted
- Date: 2026-06-21（accepted: 2026-06-21）
- Deciders: jun.shiromoto (Joymerrevent)
- Extends: [ADR-0027][adr27]（リリース前ゲート・`check:release`）

> 発端：「version 番号の打ち間違いを検知する仕組みはあるか？」。現状の `check:release` は
> version↔CHANGELOG↔README を結ぶが、版番号そのものの妥当性は見ていない。これを足す。

## Context and Problem Statement

ADR-0027 の `check:release`（`scripts/check-release-invariants.mjs`・ci 必須・常時実行）は、
package.json の version に対し **CHANGELOG に `## [version]` 節があるか／README の Node バッジ一致**を検査する。
タグは `tag.yml` が package.json から導出するので**タグ食い違いは構造的に起きない**。npm は**二重 publish 不可**。

しかし次は**捕捉できない**：

- **不正な semver 形式**（例 `0.30`・`0.3`・`v0.3.0`・末尾空白）。
- **版の逆行・飛び**（例 `0.2.0` の後に `0.1.5`）。
- **package.json と CHANGELOG に同一の打ち間違い**（両方 `0.30` なら「一致」してしまい通る）。

これらを `check:release` に足してフェイルセーフに塞ぐ（人の注意でなく仕組みで守る）。

## Decision Drivers

- **仕組みで守る**（review の見落としに依存しない）。
- **CI を重く・脆くしない**（ネットワーク依存・flaky を増やさない）。
- **毎 PR で安全に回る**こと（通常 PR を誤って落とさない）。
- 既存 `check:release` に**集約**（散らさない）。

## Considered Options

検査の中身は方針として固定で、対立しない（**形式検証**と**単調増加検証**の**両方**を `check:release` に追加し、
判定は「`version < baseline` で失敗・`==`/`>` は許可」＝毎 PR 安全）。
選択が要るのは次の2軸で、各軸 2 案ある。

- **案A：baseline＝直近の git `v*` タグ**（推奨）。ローカル完結・ネット不要・`tag.yml` が作成。要 ci で tags 取得（既定は未取得）。
- **案B：baseline＝npm 公開版**（`npm view ... version`）。実公開版が真値だが、ネット要・flaky・初回 publish 前はエラー。
- **案C：semver 比較＝自前の数値比較**（推奨）。`MAJOR.MINOR.PATCH` を分解して比較。依存ゼロ。現状 prerelease 未使用。
- **案D：semver 比較＝`semver` パッケージを devDep 追加**。prerelease も厳密だが依存が増える。

## Decision Outcome

**決定（accepted・2026-06-21）：**

- **検査項目**：形式検証（自前正規表現 `^\d+\.\d+\.\d+$`。将来 prerelease を使うなら拡張）と単調増加検証の**両方**を追加。
  判定は「`<` で失敗・`==`/`>` は許可」とし、**毎 PR で安全**（通常 PR を落とさず逆行だけ弾く）。
- **baseline：案A（git タグ）**。ネット不要・robust。ci の checkout に `fetch-tags: true`（または `fetch-depth: 0`）を足す。
  タグが無い初回は baseline を `0.0.0` 扱いで素通り。
- **semver 比較：案C（自前比較）**。依存を増やさない（フェイルセーフ・薄く）。
- 任意で **`tag.yml` にも同じ単調チェック**をバックストップとして入れる（main 上・タグ作成直前）。

理由（Decision Drivers 照合）：ADR-0027 の「version↔CHANGELOG/README 整合」に「**形式＋逆行防止**」を重ね、
版番号ミスをほぼ自動で弾く。対立案の **案B（npm）/案D（semver 依存）はネット依存・依存増**で、
「CI を脆くしない」「薄く・robust（フェイルセーフ）」方針に反するため不採用。

### Consequences

- `scripts/check-release-invariants.mjs` に形式検証（`^\d+\.\d+\.\d+$`）と単調増加検証（baseline＝直近 git タグ・自前比較・`<` で失敗）を追加する。
- ci.yml の checkout に tags 取得（`fetch-tags: true` または `fetch-depth: 0`）を足す。タグ無しの初回は baseline を `0.0.0` 扱いで素通り。
- 実装は**別 PR**（本 ADR の accept を受けて着手）。

## Pros and Cons of the Options

### 案A baseline＝git タグ（推奨）

- Good: ネット不要・robust・`tag.yml` のタグと一貫。
- Bad: ci に tags 取得を足す必要。

### 案B baseline＝npm

- Good: 実公開版が真値。
- Bad: ネット依存・flaky・初回エラー・CI が外部状態に結合。

### 案C semver 比較＝自前（推奨）

- Good: 依存ゼロ・薄い。
- Bad: prerelease を使い出すと自前拡張が要る。

### 案D semver 比較＝semver 依存

- Good: 厳密。
- Bad: devDep 追加。

## More Information

- 関連: [ADR-0027][adr27]（リリース前ゲート）／ `scripts/check-release-invariants.mjs` ／ [ADR-0029][adr29]（`tag.yml` が version からタグ導出）。

[adr27]: 0027-release-readiness-gate.md
[adr29]: 0029-release-tag-automation.md
