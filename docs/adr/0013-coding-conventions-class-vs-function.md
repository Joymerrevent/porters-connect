# 13. コーディング規約：クラス／関数・関数スタイル・型定義（type/interface）

- Status: accepted
- Date: 2026-06-14
- Deciders: jun.shiromoto (Joymerrevent)

> 実装が本格化する前（PoC 上層で状態を持つ内部協調子＝既定 `TokenProvider`・throttle・retry・transport が
> 増える直前）に、クラス/関数の使い分け・関数スタイル・型定義を決め、PR ごとの再議論とスタイル揺れを防ぐ。
> [CLAUDE.md] のコーディング規約を具体化。`accepted`（2026-06-14）：内部協調子は factory／関数は全 arrow（const）／
> 型定義は全 `type`（interface 不使用）。

## Context and Problem Statement

状態を持つ内部協調子（既定 `TokenProvider` 実装、token-bucket、retry ラッパ、fetch transport）を
**`class implements Interface`** にするか **`createX(): Contract`（factory ＋ closure）** にするか、
**関数を `function` 宣言と arrow のどちらに揃えるか**、そして **型定義を `type` と `interface` のどちらに揃えるか**を、
上層着手前に決める（seam の「形」は [ADR-0005][0005]/[ADR-0007][0007] で確定済み。本 ADR はその**表現スタイル**を決める）。
現状コードは概ね定番（[errors=class][err]・[client=class][cli]・純粋変換=関数・object=interface・union=type）。

## Decision Drivers

- **薄く・堅く・フェイルセーフ**：クラスは最小に、`this` 束縛の事故を避ける、テスト容易。
- **予測可能性**：宣言マージのような暗黙挙動を避ける（事故を仕組みで封じる）。
- **一貫性は仕組みで守る**：eslint で強制（[CLAUDE.md] の「人の記憶でなく仕組み」＝MD054 と同思想）。
- **インターフェースに対してプログラムする**：seam は契約型（[ADR-0005][0005]/[ADR-0007][0007]）。実装は差し替え可能。
- **DX／慣習**：SDK エントリは `new PortersClient()` が自然（[ADR-0005][0005] で確定）。

## Considered Options

- クラス/関数: 案A クラス中心／案B 関数中心（factory＋closure）＋必須箇所だけクラス／案C ハイブリッド（用途で使い分け）
- 関数スタイル: 全 arrow（const）に統一／`function` 宣言（直下）＋ arrow（callback）
- 型定義: 全 `type` に統一／object は `interface`・union 等は `type` の使い分け

## Decision Outcome

**採用**（`accepted`）。

**クラスを使うのは 2 種だけ**：

1. `Error` 派生（`PortersError` 階層）＝**class が必須**。
2. 公開エントリ `PortersClient`＝`new` の DX（[ADR-0005][0005] で確定）。

**状態を持つ内部協調子は factory 関数で「契約（型）」のオブジェクトを返す**
（`createDefaultTokenProvider(opts): TokenProvider` 等）。`this` 事故なし／closure で真の private／
戻り値が契約型＝モック容易／クラス最小。`implements` は使わず**構造的に**満たす。
（例外：将来テナント毎に大量生成し性能が問題化する協調子のみ class に切替可＝その時 ADR 追補。）

**純粋変換（datetime/decode/classify）は引数→戻り値の純関数**。

**関数スタイル＝全 arrow（const）に統一**：

- トップレベルの名前付きも `export const f = (...) => {...}`。コールバック/ローカルも arrow。factory の
  クロージャと書き味を一致させ、単一ルールにする（`this` が原理的に出ない）。
- 失う「巻き上げ」は **eslint `no-use-before-define`** で定義順を機械強制して塞ぐ。overload が要る稀な箇所は
  型注釈の call-signature で表現する。
- 強制：`func-style: ["error", "expression"]` ＋ `no-use-before-define`。

**型定義＝全 `type`（`interface` 不使用）**：

- 宣言マージを原理的に封じて**予測可能**にする（誤マージ事故ゼロ）。factory 採用で `implements` を使わないため、
  `interface` の利点（implements/extends・augmentation）は不要。
- 合成は `&`（intersection）、**alias には必ず名前を付ける**（エラーメッセージを名前で出すため）。
- カスタム項目（[ADR-0004][0004]）はビルダー＋ジェネリクスで augmentation 非依存＝失うものなし。
- 強制：`@typescript-eslint/consistent-type-definitions: ["error", "type"]`。

### Consequences

- Good: クラス最小・テスト容易・`this` 事故なし・宣言マージ事故ゼロ・単一スタイルで一貫。
- Bad: factory closure は 1 インスタンスにつきメソッド再生成（通常無視可）。全 arrow は定義順依存
  （`no-use-before-define` で担保）。`type` 合成は `&`（深い合成はエラーメッセージがやや冗長＝名前付きで緩和）。
- Neutral: 既存コード（`function` 宣言→arrow、`interface`→`type`）の追従と eslint ルール追加を accepted 後に実施。[CLAUDE.md] へ反映。

## Pros and Cons of the Options

### クラス/関数

- 案A クラス中心: Good 馴染み・DI 親和・prototype で効率。Bad `this` 事故・モックが面倒・「薄く」に反しがち。
- 案B 関数中心: Good 最小・FP 親和・テスト容易。Bad `Error` は class 必須・SDK で `new` が欲しい場面と齟齬。
- 案C ハイブリッド（採用）: Good 用途最適・既存コードに整合・規約で揺れを止める。Bad 都度判断＝明文化＋eslint で解消。

### 関数スタイル

- 全 arrow（採用）: Good 単一ルール・`const` 不変・factory と一致・`this` 不出現。Bad 巻き上げ無し（`no-use-before-define` で担保）・overload は型注釈。
- 宣言＋callback: Good 巻き上げ（新聞紙構成）・ネイティブ overload。Bad 2 ルール併用。

### 型定義

- 全 `type`（採用）: Good 宣言マージ封じ＝予測可能・1 ルール・factory なら `implements` 不要。Bad 合成が `&`・`interface` よりエラーメッセージ/型チェックが僅かに不利（名前付きで緩和）。
- 使い分け（object=`interface`）: Good エラーメッセージ良好・augmentation 可。Bad 宣言マージの事故余地・2 ルール。

## More Information

- 前提/依存: [ADR-0005][0005]（`new PortersClient`・seam）、[ADR-0007][0007]（`TokenProvider`/`TokenStore`）、[ADR-0004][0004]（カスタム項目はビルダー＝augmentation 非依存）、[CLAUDE.md] コーディング規約。
- 反映（accepted 後）: [CLAUDE.md] に追記、eslint ルール追加、既存コードを規約へ追従（`function`→arrow・`interface`→`type`）。
- 関連: [[0004-field-type-model]], [[0005-public-api-shape]], [[0007-oauth-public-surface]]。

[CLAUDE.md]: ../../CLAUDE.md
[err]: ../../src/errors/index.ts
[cli]: ../../src/client.ts
[0004]: 0004-field-type-model.md
[0005]: 0005-public-api-shape.md
[0007]: 0007-oauth-public-surface.md
