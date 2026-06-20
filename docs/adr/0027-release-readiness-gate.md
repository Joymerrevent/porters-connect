# 27. リリース前ゲート（release readiness）

- Status: proposed
- Date: 2026-06-20
- Deciders: jun.shiromoto (Joymerrevent)

> 発端：0.2.0 で `SECURITY.md`・README の Node バッジが更新漏れ。さらに調査で、論点は
> 「version 連動ドリフト」より広い **「リリース前に何を検査すべきか（publish 正当性・型解決ほか）」**
> だと判明。本 ADR で**リリース前ゲートの対象と強制方法**を一本化して決める。
> [ADR-0025][adr25]（自動化）/ [ADR-0026][adr26]（CHANGELOG 形式）のサブ論点を統合。

## Context and Problem Statement

リリースのたびに次が利用者に届きうる：

- **(a) version 連動文書のズレ**：`CHANGELOG` 版エントリ・`SECURITY.md` 対応版・README Node バッジ↔`engines`。
- **(b) 公開物の壊れ**：`package.json` の exports/files/types 不正、公開した型が利用者環境で解決しない、tarball の中身不備。

人の記憶に頼る限り再発する（0.2.0 で実際に (a) が2件発生）。**何を invariants とし、どの強制方法で守るか**を決める。

## Decision Drivers

- **フェイルセーフ**：人の記憶でなく**仕組み**で守る（global ルール・markdownlint MD054 の前例）。
- **利用者の壊れを直接防ぐ**：import 不可・型解決失敗は致命的。
- **薄く・堅く**：ゲートの保守を増やしすぎない。
- **ソロ・低頻度リリース**：重い仕組みは過剰になりがち。

## 調査で判明したリリース連動の surface（2026-06-20）

- **version 連動**：CHANGELOG 版エントリ／`SECURITY.md` 対応版（**0.1.x のまま漏れ**）／README Node バッジ↔`engines`（**alt が "Node >= 18" のまま漏れ**）。
- **publish 正当性**：`publint`（exports/files/types）→ 現状 **All good**／`@arethetypeswrong/cli`（型解決）→ node16(CJS) で ⚠️（**ESM-only の設計どおり**・CJS 利用者は dynamic import）。
- **対象外**：`src/` は自身の version を埋め込まない（`API_VERSION="2"` は PORTERS 側）。npm バッジは shields.io 動的＝自動。

## Considered Options

### 強制方法

- **案G ゲート**：CI 必須チェックで検査し、ズレ/不正なら fail（迂回しにくい）。
- **案A 自動更新**：version 等から連動箇所を書き換える。
- **案E 連動除去**：ドリフト源（hardcode した版番号など）を消す。

### 対象 invariants の候補

- `publint`（公開正当性）
- `attw`（型解決）
- CHANGELOG に現 version 節
- README Node バッジ ↔ `engines`
- SECURITY 対応版
- （将来）install スモーク・tarball 検査・link check

## Decision Outcome

未決（proposed）。

### 推奨（私案）：ハイブリッド（消す ＋ 検査する）

- **消す（案E）**：`SECURITY.md` から**版番号を撤去**（「最新リリース版のみサポート」と一般化）。ドリフト源を断つ＝最もフェイルセーフ。
- **検査する（案G・CI 必須ゲート）**：
  - **`publint` ＋ `attw`**（公開正当性・型解決）← 高価値・低コスト。`attw` は ESM-only の `cjs-resolves-to-esm` を `ignoreRules` で除外し、**本当の型不正だけ**を fail させる。
  - **CHANGELOG に現 version の `## [X.Y.Z]` 節**があるか。
  - **README Node バッジが `engines.node` と一致**するか。
- **見送り（任意・将来）**：install スモーク・tarball 検査・link check・Actions SHA ピン留め。
- **適用範囲**：CI の必須チェック（PR 全般で常時。普段は整合＝緑、リリース PR でズレを弾く）。fail はブロック。

方針：「守る対象を最小化（SECURITY は消す）」＋「利用者の壊れに直結する publish/型は仕組みで担保」。薄く・堅く。

> 決定後 accepted にし、実装（SECURITY/バッジ修正・publint/attw・小スクリプトの CI 追加）は**別 PR**で行う。

### Consequences

- （決定後に記入）

## Pros and Cons of the Options

### 案G ゲート

- Good: ミスを確実に捕まえる・迂回しにくい。利用者の壊れに即効。
- Bad: ゲートの保守。手動更新の手間自体は残る（消せる連動は案E で消すのが上位）。

### 案A 自動更新

- Good: 手作業ゼロ。
- Bad: ツール増・文面の機械生成設計。低頻度には過剰。

### 案E 連動除去

- Good: ドリフト源を消す＝最もフェイルセーフ。追加の仕組み不要。
- Bad: 明示性は下がる（ソロ非公式では許容）。CHANGELOG など消せない連動には使えない。

## More Information

- 関連: [ADR-0025][adr25]（リリース自動化）／ [ADR-0026][adr26]（CHANGELOG 形式）。
- ツール: [publint][publint] ／ [are-the-types-wrong][attw]。
- 0.2.0 実測: publint=All good／attw=node16(CJS) ⚠️（ESM-only の設計どおり）。
- 既存の手動レビュー観点（`.claude` の project-review スキル）を一部自動化・補完する位置づけ。

[adr25]: 0025-release-automation.md
[adr26]: 0026-changelog-format.md
[publint]: https://publint.dev/
[attw]: https://github.com/arethetypeswrong/arethetypeswrong.github.io
