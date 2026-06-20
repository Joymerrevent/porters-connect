# 27. バージョン連動ドキュメントのドリフト対策（リリース整合性）

- Status: proposed
- Date: 2026-06-20
- Deciders: jun.shiromoto (Joymerrevent)

> 発端：0.2.0 リリース時、`SECURITY.md` の「対応バージョン」が `0.1.x` のまま**更新漏れ**した。
> リリースで version を上げるたびに version 連動の文書がズレうる。どう担保するかを決める。

## Context and Problem Statement

`package.json` の version に**連動する文書**がある：

- `SECURITY.md` の「対応バージョン」（例 `0.1.x`）。
- `CHANGELOG.md` の版エントリ（`## [X.Y.Z]`）。

リリース時にこれらの手動更新を忘れると、利用者向け文書が version とズレる（0.2.0 で実際に発生）。
**「人の記憶」に頼る限り再発する**。どの方式でドリフトを防ぐ／担保するか。

## Decision Drivers

- **フェイルセーフ**：人の記憶でなく**仕組み**で守る（global ルール。markdownlint MD054 の前例）。
- **薄く・堅く**：ゲートや自動化の保守コストを増やしすぎない。
- **ソロ・低頻度リリース**：重い仕組みは過剰になりがち。
- **明示性**：利用者向け文書（SECURITY / CHANGELOG）の正確さ。

## Considered Options

- **案1 ゲート（検査してブロック）**：CI 必須チェック（or pre-commit）で「CHANGELOG に現 version 節がある」「SECURITY が現 `major.minor.x`」を検査し、ズレたら fail。
- **案2 自動更新**：リリース時に version から SECURITY / CHANGELOG の該当箇所を**書き換える**（release スクリプト等）。
- **案3 連動除去**：`SECURITY.md` から**版番号を消す**（「最新リリース版のみサポート・修正は常に新バージョン」と一般化）。連動が無ければドリフトしない。
- **ハイブリッド**：SECURITY=案3、CHANGELOG=案1 の軽量版。

## Decision Outcome

未決（proposed）。

### 推奨（私案）

**ハイブリッド**を推奨：

- **`SECURITY.md` → 案3（版番号除去）**：ドリフト源そのものを消す＝最もフェイルセーフ（「壊れる部品を持たない」）。ゲートも自動化も不要に。ソロ非公式 lib では「最新版サポート」で明示性は十分。
- **`CHANGELOG.md` → 案1 の軽量版**：消せない version 連動。CI で**「現 version の `## [X.Y.Z]` 節があるか」だけ**を必須チェック（安い保険）。CHANGELOG 記入＝リリース作業そのものなので負担は小。

「守る対象を最小化（案3）しつつ、残った連動だけ仕組みで担保（案1 軽量）」という方針。

> 決定後 accepted にし、実装（SECURITY.md 修正・CHANGELOG チェックの CI 追加）は**別 PR**で行う。

### Consequences

- （決定後に記入）

## Pros and Cons of the Options

### 案1 ゲート

- Good: ミスを確実に捕まえる。迂回しにくい（CI 必須）。
- Bad: ゲートの保守が要る。**手動更新の手間は残る**（忘れを捕まえるだけ）。連動文書が増えるたび検査も増やす。

### 案2 自動更新

- Good: 手作業ゼロ＝忘れようがない。
- Bad: ツール増・文面の機械生成設計が要る。低頻度リリースには過剰になりやすい。

### 案3 連動除去

- Good: ドリフト源を消す＝最もフェイルセーフ。追加の仕組み不要。
- Bad: 「どの版がサポートか」の明示性は下がる（ソロ非公式では許容範囲）。CHANGELOG には使えない。

## More Information

- 関連: [ADR-0025][adr25]（リリース自動化）／ [ADR-0026][adr26]（CHANGELOG 形式）。
- 前例: 「人の記憶でなく仕組みで守る」（global ルール・markdownlint MD054）。

[adr25]: 0025-release-automation.md
[adr26]: 0026-changelog-format.md
