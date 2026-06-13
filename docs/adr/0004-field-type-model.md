# 4. リソース／フィールドの型モデル（標準 `P_` ＋ テナント動的 `U_` / `A_`）

- Status: proposed
- Date: 2026-06-13
- Deciders: （チーム議論中。提案: jun.shiromoto / Claude）

> `proposed` 段階。チーム議論で `accepted` になってから、依存する設計（公開 API・XML エンコード）と
> `CLAUDE.md` 等へ反映する。基本設計の背骨。

## Context and Problem Statement

PORTERS の各リソースのフィールドは 2 層に分かれる（[field-data-types][fdt] / [resources][res]）:

- **標準フィールド `P_*`**: 公式ドキュメントに記載・リソース毎に概ね安定（例 `Person.P_Id`, `Person.P_Name`）。
- **テナント毎カスタム `U_[Name]`（ユーザー作成）/ `A_[Name]`（アプリ作成）**: **Partition（Company DB）ごとに異なり**、静的ドキュメントに無い。`Field Read API`（`/v1/field`）でしか分からない。

さらに **Field Type が値の形を決め**（Number/Option/Date/DateTime/Reference/User/Link/Image…）、
**Read と Write で表現が非対称**（例: Option は Read で入れ子・Write で末端 alias、参照/User/Link は Read で入れ子・Write で ID のみ）。

PRD（[requirements][prd] R-13/R-16）は「**公開サーフェスに any を撒かない型安全**」「**カスタム項目も扱える**」「**契約なしで評価・テストできる**」「**フェイルセーフ**」「**薄く・堅く**」を要求する。
問題: **静的に分かる標準項目と、実行時/テナント依存のカスタム項目を、どう型安全に両立するか？**

## Decision Drivers

- **型安全**: 標準項目は静的に型・補完が効く。`any` を撒かない。
- **契約なしで動く**: 型のためにライブラリ利用者へ「契約＋ライブ Field Read」を強制しない（評価可能性 R-12/R-17）。
- **フェイルセーフ**: 未知項目・型不一致でクラッシュさせず、安全に倒す（落とす前に検知・明示）。
- **薄く・堅く**: 重いコード生成やビルド時 API 依存をコアに持ち込まない。
- **テナント差の吸収**: カスタム項目の差異を利用側が無理なく扱える。
- **保守容易**: 標準項目の型を更新しやすい（[docs/reference][res] から再生成できる等）。

## Considered Options

- **案A: 標準 `P_` の静的手書き型のみ**＋カスタムはゆるい型のエスケープハッチ
- **案B: テナントの `Field Read` からコード生成**（その環境専用の厳密型）
- **案C: スキーマ宣言駆動**（利用者が使う項目を宣言 → 型導出＋実行時検証）
- **案D: ゆるい型**（`Record<string, unknown>` 等）
- **案H（ハイブリッド）: A ＋ C**（＋ B を将来の opt-in 開発ツールとして）

## Decision Outcome

**提案: 案H（ハイブリッド）**。

- **標準 `P_` フィールド**は**同梱の静的型**（案A）。[docs/reference][res] の Field List から起こし、再生成可能にする。即・補完あり・契約不要。
- **カスタム `U_`/`A_` フィールド**は**利用者がフィールド定義（alias → 型）を宣言**し、ジェネリクスで型導出＋**実行時に検証**（案C）。
  「利用者が自分のテナントのフィールドマップを持ち込む」形。契約不要・テナント差を吸収・検証でフェイルセーフ。
- **`Field Read` からの生成（案B）は将来の opt-in 開発ツール（P2）**: ライブ接続できる人が「カスタム項目の宣言（スキーマ雛形）」を自動生成できる補助。コアには入れない。
- **未知/未宣言の項目はクラッシュさせない**: 型は `unknown` 相当で露出し、検証エラーは判別可能エラー（→ エラーモデルの ADR）で返す（フェイルセーフ）。

> per-Field-Type の**値エンコード/デコード（Option の入れ子・参照の ID 化・Read/Write 非対称・Image/Base64 等）**は
> **別 ADR（XML パース/シリアライズ）**で詳細化する。本 ADR は「静的 vs 動的の型戦略」を決める。

### Consequences

- Good: 標準項目は即・型安全・補完。**契約なしで評価/テスト可**。カスタムも宣言すれば型安全＋実行時検証＝フェイルセーフ。コアは薄い。
- Bad: カスタム項目は「宣言の一手間」が要る。標準型の手動/半自動メンテが要る。宣言 DSL（フィールド定義 API）の設計が必要。
- Neutral: 値エンコードは XML ADR 待ち。コード生成は将来。公開 API の形（→ 公開 API の ADR）に影響する。

## Pros and Cons of the Options

### 案A: 標準 P\_ の静的型のみ

- Good: 単純・即・契約不要・補完が効く。実装が軽い。
- Bad: カスタム項目が型安全にならない（補完なし）。テナント固有要件に弱い。

### 案B: Field Read からコード生成

- Good: カスタム含め最も厳密な型。
- Bad: **生成にライブ契約が要る**（評価可能性に反する）。ビルド時 API 依存・型がテナント専用で同梱不可・再生成運用が重い。「薄く」に反する。

### 案C: スキーマ宣言駆動

- Good: 使う項目だけ正確に型付け＋実行時検証（フェイルセーフ）。契約不要。テナント差を吸収。
- Bad: 利用者に宣言の手間。標準項目まで宣言させると冗長（→ A と併用で解消）。

### 案D: ゆるい型

- Good: 実装が最小。
- Bad: 型安全の目標に反する（`any` 相当）。PRD/CLAUDE 規約違反。却下。

## More Information

- 依存/前提: [requirements][prd]（R-13 型安全・R-16 カスタム項目）、[field-data-types][fdt]、[resources][res]。
- 後続: **XML パース/シリアライズ ADR**（データ型別の値エンコード・Read/Write 非対称）、**公開 API の ADR**（宣言 DSL とアクセサ形）。
- 関連: [[0002-ground-design-in-live-api-docs]]。

[prd]: ../design/requirements.md
[fdt]: ../reference/field-data-types.md
[res]: ../reference/resources.md
