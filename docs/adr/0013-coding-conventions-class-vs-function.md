# 13. コーディング規約：クラス／関数の使い分けと関数スタイル

- Status: proposed
- Date: 2026-06-14
- Deciders: jun.shiromoto (Joymerrevent)

> 実装が本格化する前（PoC 上層で状態を持つ内部協調子＝既定 `TokenProvider`・throttle・retry・transport が
> 増える直前）に、「いつクラス／いつ関数」「アロー／関数宣言」を決め、PR ごとの再議論とスタイル揺れを防ぐ。
> [CLAUDE.md] のコーディング規約を具体化。`proposed`（判断は議論後）。

## Context and Problem Statement

現状コードは既に定番の使い分けに沿っている（[errors=class][err]・[client=class][cli]・util/xml=`function`・コールバック=arrow）。
だが**規約として明文化されておらず**、かつ**1 点が未決**：状態を持つ内部協調子（既定 `TokenProvider` 実装、
token-bucket、retry ラッパ、fetch transport）を **`class implements Interface`** にするか
**`createX(): Interface`（factory ＋ closure）** にするか。seam は [ADR-0005][0005]/[ADR-0007][0007] で
interface として確定済みなので、ここは**実装スタイルの選択**であり、上層着手前に決めておきたい。

## Decision Drivers

- **薄く・堅く・フェイルセーフ**：クラスは最小に、`this` 束縛の事故を避ける、テスト容易。
- **インターフェースに対してプログラムする**：seam は interface（[ADR-0005][0005]/[ADR-0007][0007]）。実装は差し替え可能。
- **一貫性は仕組みで守る**：eslint で強制（[CLAUDE.md] の「人の記憶でなく仕組み」＝MD054 と同思想）。
- **DX／慣習**：SDK エントリは `new PortersClient()` が自然（[ADR-0005][0005] で確定）。
- **デバッグ容易性**：スタックトレースに名前が出る。

## Considered Options

- 案A: クラス中心（OOP 寄り）
- 案B: 関数中心（factory ＋ closure）＋必須箇所だけクラス
- 案C: ハイブリッド（用途で使い分け・明文化）

## Decision Outcome

**提案（推奨）: 案C ハイブリッドを明文化**。

**クラスを使うのは 2 種だけ**：

1. `Error` 派生（`PortersError` 階層）＝**class が必須**。
2. 公開エントリ `PortersClient`＝`new` の DX（[ADR-0005][0005] で確定）。多テナントで多数生成され得るため prototype 共有も有利。

**それ以外の「状態を持つ内部協調子」は factory 関数で interface 型を返す**（`createDefaultTokenProvider(opts): TokenProvider` 等）：

- `this` 束縛の落とし穴なし／closure で**真の private**／戻り値が interface＝**モック容易**／合成しやすい／クラスを最小に保てる。
- 例外：将来「テナント毎に大量生成」かつ性能が問題になる協調子は class（prototype 共有）に切替可（その時 ADR 追補）。

**純粋変換（datetime/decode/classify）は引数→戻り値の純関数**。

**関数スタイル**：

- **モジュール直下の名前付き関数 = `function` 宣言**（巻き上げ・スタックトレースに名前・可読）。
- **コールバック／ローカル／レキシカル `this` が要る箇所 = アロー**。
- factory が返すメソッドはオブジェクトメソッド（メソッド短縮 or arrow）。

**強制**：eslint（`func-style` を declaration 基調＋`allowArrowFunctions`、`prefer-arrow-callback` 等）で機械的に守る。既存コードへの影響を確認して導入。

### Consequences

- Good: クラス最小・テスト容易・`this` 事故なし・一貫。既存コードはほぼ準拠＝手戻り小。
- Bad: factory closure は 1 インスタンスにつきメソッド再生成（通常無視できる。多数生成時のみ留意）。
- Neutral: eslint ルール追加。accepted 後に [CLAUDE.md] へ反映。

## Pros and Cons of the Options

### 案A: クラス中心

- Good: 馴染み・DI 親和・prototype で効率。
- Bad: `this` 事故・モックが面倒・「薄く」に反しがち・過剰 OOP。

### 案B: 関数中心

- Good: 最小・FP 親和・テスト容易。
- Bad: `Error` は class 必須・SDK で `new` が欲しい場面と齟齬・多数生成で効率低下。

### 案C: ハイブリッド（推奨）

- Good: 用途最適・既存コードに整合・規約で揺れを止める。
- Bad: 「どちらか」を都度判断＝明文化＋eslint で解消。

## More Information

- 前提/依存: [ADR-0005][0005]（`new PortersClient`・seam=interface）、[ADR-0007][0007]（`TokenProvider`/`TokenStore` interface）、[CLAUDE.md] コーディング規約。
- 反映（accepted 後）: [CLAUDE.md] に追記＋eslint ルール。
- 関連: [[0005-public-api-shape]], [[0007-oauth-public-surface]]。

[CLAUDE.md]: ../../CLAUDE.md
[err]: ../../src/errors/index.ts
[cli]: ../../src/client.ts
[0005]: 0005-public-api-shape.md
[0007]: 0007-oauth-public-surface.md
