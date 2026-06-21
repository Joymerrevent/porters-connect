# 31. リリース版番号の自動検証（semver 形式・単調増加）

- Status: proposed
- Date: 2026-06-21
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

### 検査項目

- **(1) semver 形式検証**：version が `MAJOR.MINOR.PATCH` 形式か。常時安全（リリース状態に依らず version は常に正当であるべき）。
- **(2) 単調増加検証**：version が baseline より**前に戻っていない**か。

### (2) の baseline（比較対象）

- **案X：直近の git `v*` タグ**。ローカルで完結・ネット不要・`tag.yml` が作成。ただし ci の checkout が既定（タグ未取得）なので **tags 取得が要る**。
- **案Y：npm 公開版**（`npm view ... version`）。「実際に公開された版」が真値だが、**ネット要・flaky・初回 publish 前はエラー**。

### (2) の判定ロジック（毎 PR で回す前提）

- 通常 PR では version == baseline（リリース間は据え置き）。リリース PR でのみ version > baseline。
- よって **`version < baseline` で失敗／`==` と `>` は許可**。これなら**毎 PR で安全**（通常 PR を落とさない・逆行だけ弾く）。

### semver 比較の実装

- **案P：自前の数値比較**（`MAJOR.MINOR.PATCH` を分解して比較）。依存ゼロ。現状 prerelease 未使用。
- **案Q：`semver` パッケージを devDep 追加**。prerelease も厳密だが依存が増える。

## Decision Outcome

未決（proposed）。

### 推奨（私案）

- **(1) semver 形式：常時検証**（自前正規表現 `^\d+\.\d+\.\d+$`。将来 prerelease を使うなら拡張）。
- **(2) 単調増加：baseline ＝ 案X（直近 git タグ）**。ネット不要・robust。`check:release` に「`<` で失敗・`==`/`>` は許可」を実装。
  ci の checkout に **`fetch-tags: true`**（または `fetch-depth: 0`）を足す。タグが無い初回は baseline を `0.0.0` 扱いで素通り。
- **semver 比較：案P（自前比較）**。依存を増やさない（フェイルセーフ・薄く）。
- 任意で **`tag.yml` にも同じ単調チェック**をバックストップとして入れる（main 上・タグ作成直前）。

「version と CHANGELOG/README の整合（ADR-0027）」に「**形式 ＋ 逆行防止**」を重ね、版番号ミスをほぼ自動で弾く。

### Consequences

- （決定後に記入）`scripts/check-release-invariants.mjs` に検査(1)(2)を追加。ci.yml の ci checkout に tags 取得を追加。
- 実装は**別 PR**（accept 後）。

## Pros and Cons of the Options

### baseline：案X git タグ（推奨） / 案Y npm

- 案X Good: ネット不要・robust・`tag.yml` のタグと一貫。Bad: ci に tags 取得を足す必要。
- 案Y Good: 実公開版が真値。Bad: ネット依存・flaky・初回エラー・CI が外部状態に結合。

### semver 比較：案P 自前（推奨） / 案Q semver 依存

- 案P Good: 依存ゼロ・薄い。Bad: prerelease を使い出すと自前拡張が要る。
- 案Q Good: 厳密。Bad: devDep 追加。

## More Information

- 関連: [ADR-0027][adr27]（リリース前ゲート）／ `scripts/check-release-invariants.mjs` ／ [ADR-0029][adr29]（`tag.yml` が version からタグ導出）。

[adr27]: 0027-release-readiness-gate.md
[adr29]: 0029-release-tag-automation.md
