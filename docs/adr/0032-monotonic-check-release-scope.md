# 32. 単調増加検証を base=main の PR に限定（ADR-0031 (2) を改訂）

- Status: accepted
- Date: 2026-06-22（accepted: 2026-06-22）
- Deciders: jun.shiromoto (Joymerrevent)
- Supersedes: [ADR-0031][adr31] の**単調増加検証(2)の実行範囲**（毎 PR → base=main の PR 限定）。形式検証(1)・baseline=git タグ・自前比較は不変。

> 発端：project-review RV-9。ADR-0031 の単調増加検証が、git-flow の release→**手動** back-merge 窓で
> develop の無関係 PR を「版の逆行」で落とす（baseline=グローバル最大タグ／develop は back-merge までタグに追いつかない）。

## Context and Problem Statement

ADR-0031 は「(2) 単調増加検証を**毎 PR**で回す（baseline＝直近 git タグ・`< baseline` で失敗・`==`/`>` 許可）」と accepted した。
前提は「通常 PR では version==baseline（リリース間は据え置き）」。

しかし git-flow の実フロー（runbook §2・[ADR-0030][adr30] 案H＝手動 back-merge）は次の順:

1. `release/X.Y.Z` で version を bump
2. **main** に直マージ → `tag.yml` が `vX.Y.Z` を作成
3. **手動** back-merge（main→develop）で version/CHANGELOG を develop へ反映

「2 のタグ作成」〜「3 の手動 back-merge」の窓で、**develop の version は最新タグより低い**（例 develop=0.2.0／最新タグ v0.3.0）。
baseline はグローバル最大タグなので、この窓で develop への**通常 PR が `version < baseline` ＝「版の逆行」で落ちる**。
ADR-0031 の前提（version==baseline）が back-merge ラグを見落としていた（RV-9）。「人の注意でなく仕組みで守る」はずが、
誤検知回避を「back-merge を即実行」という人の注意に依存させてしまう。

## Decision Drivers

- ADR-0031 の主旨（版番号ミスを**仕組みで**弾く）は維持する。
- **無関係な develop PR を誤って落とさない**（「毎 PR 安全」を実態として満たす）。
- **CI を重く・脆くしない**（ADR-0031 と同じ駆動）。
- 版の逆行が**実害になる瞬間（＝リリース＝publish）**で確実に弾ければ十分。

## Considered Options

形式検証(1)は常時のまま（version は文脈に依らず正当であるべき・安価）。論点は (2) 単調増加検証の**実行範囲／baseline**。

- **案A：base=main の PR に限定**（推奨）。リリース PR（`release/*`→main）でのみ単調増加を検査。develop の通常 PR・push・local では skip。baseline はグローバル最大タグのまま・CI は据え置き（`fetch-tags` のみ）。
- **案B：baseline を HEAD から到達可能な最大タグに変更**＋ ci を `fetch-depth:0`。main だけにあるタグ（back-merge 前）は祖先でないため除外され、毎 PR で安全。意味的に最も正しいが CI を一段重くする。
- **案C：ADR/runbook で back-merge を tag 直後の必須化のみ**（コード不変）。追加実装ゼロだが誤検知回避を人の注意に依存。

## Decision Outcome

**決定（accepted・2026-06-22）：案A。**

(2) 単調増加検証を **base=main の PR に限定**する（`scripts/check-release-invariants.mjs` で release 文脈＝
`GITHUB_BASE_REF === "main"` のときだけ逆行判定を実行）。形式検証(1)は全 PR/push/local で**常時**。
baseline（直近 git タグ）・自前比較・`fetch-tags` は [ADR-0031][adr31] のまま変更しない。

理由（Decision Drivers 照合）：版の逆行が**実害になるのは publish される瞬間**で、それは必ず main 向け PR を通る。
そこで確実に弾けば、develop の back-merge 窓で無関係 PR を巻き込む誤検知を消せる。CI も重くしない（案B の `fetch-depth:0` 不要）。
案C はフェイルセーフとして弱く ADR-0031 の「仕組みで守る」に反する。

### Consequences

- （accept 後）`check-release-invariants.mjs` の (2) を `GITHUB_BASE_REF === "main"` ガード下に置く。(1) は常時。
  release 文脈で逆行検知・非 release 文脈で skip するテストを追加。
- **トレードオフ（Neutral/Bad）**：develop CI と local `check:release` は (2) を検査しない（文脈不明→skip 側）。
  develop 上での版の逆行は**リリース PR で初めて捕捉**される（publish 前に必ず通るので実害は出ない）。
  スクリプトが CI 環境変数（`GITHUB_BASE_REF`）に依存し、文脈で挙動が変わる。
- [ADR-0031][adr31] の「(2) を毎 PR で回す」サブ決定を本 ADR で **superseded**（範囲を base=main に縮小）。
  ADR-0031 本文は書き換えず status ポインタのみ追記する。
- 実装は**別 PR**（accept 後）。RV-9 はその実装で `fixed` にする。

## Pros and Cons of the Options

### 案A base=main 限定（推奨）

- Good: develop の誤検知ゼロ・CI 据え置き・逆行は publish 経路で確実に捕捉・ADR-0031 の baseline/比較を流用。
- Bad: develop/local では逆行未検査（リリース PR まで遅延）・スクリプトが CI 文脈（`GITHUB_BASE_REF`）依存。

### 案B 到達可能最大タグ＋fetch-depth:0

- Good: 意味的に正しく毎 PR で安全・CI/local 同一挙動。
- Bad: 毎 PR で full fetch＝CI を一段重くする。ADR-0031 の「CI を重くしない」駆動に逆行。

### 案C ADR/手順のみ

- Good: 追加実装ゼロ。
- Bad: 誤検知回避を人の注意（back-merge 即実行）に依存＝フェイルセーフとして弱い。

## More Information

- 発端: project-review RV-9（`docs/reviews/findings.md` / `docs/reviews/2026-06-22-01.md`）。
- 関連: [ADR-0031][adr31]（版番号検証・本 ADR が (2) の範囲を改訂）／ [ADR-0030][adr30]（手動 back-merge＝ラグ源）／ `scripts/check-release-invariants.mjs` ／ `docs/release-runbook.md` §2。

[adr30]: 0030-backmerge-method.md
[adr31]: 0031-version-number-validation.md
