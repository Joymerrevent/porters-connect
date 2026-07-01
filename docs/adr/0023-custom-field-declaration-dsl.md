# 23. カスタム項目宣言 DSL（`defineFields`）の詳細設計（R-16 実装）

- Status: accepted
- Date: 2026-06-17
- Deciders: jun.shiromoto (Joymerrevent)

> [ADR-0004][0004]（型モデル・案H）と [ADR-0005][0005]（公開 API・SD-2 ビルダー）が決めた
> 「標準 `P_` は静的型／カスタム `U_`・`A_` は利用者が宣言 → 型導出＋実行時検証」の**実装**を確定する。
> 本 ADR は新しい方針を作るのではなく、両 ADR を**詳細設計レベルで接地**する。

## Context and Problem Statement

[requirements][prd] R-16（P1）は、テナント固有のカスタム項目 `U_[Name]`（ユーザー作成）/
`A_[Name]`（アプリ作成）を**型安全＋フェイルセーフ**に扱うことを求める。
標準 `P_` 項目はカタログ駆動の静的型で実装済み（[ADR-0019][0019]）だが、カスタム項目は現状
**型が付かず**、decode は raw string・encode は Text にフォールバックする「素通し」だけである
（`src/resources/read-core.ts` / `src/xml/encode.ts`）。宣言 DSL `defineFields` は
プレースホルダ（`src/fields/index.ts`）のままで、[ADR-0005][0005] が示した姿が未実装。

問い: **[ADR-0005][0005] のビルダー `defineFields` を、既存のカタログ駆動の型機構（`ReadRecord` /
`decoderFor` / `encodeField` / `WritableKeys`）にどう接続して、宣言したカスタム項目が
`porters.candidate.get()` 等に型付きで生え、宣言した Data Type で decode/encode されるようにするか？**
特に、型を `PortersClient` から各 accessor までどう流すか・検証境界をどこに置くか・どこまでを v1 スコープにするか。

## Decision Drivers

- **型安全**（[ADR-0004][0004] R-13）: 宣言したカスタム項目に補完が効き、`any` を撒かない。
- **フェイルセーフ**: 不正な宣言は早期に同期で弾く。未宣言項目はクラッシュさせず素通し。
- **薄く・堅く**: 依存ゼロの自前ビルダー。既存のカタログ駆動機構を再利用し、新しい並行経路を作らない。
- **DX「簡単」**（[ADR-0005][0005]）: 既定（カスタム無し）は現状と完全に同一の使い勝手。
- **段階導入**: P1 として、まず「宣言 → 型付き＋正しい decode/encode ディスパッチ」を出す。重い検証は後続。

## Considered Options

型を accessor まで流す方式（D1）:

- **案1: `PortersClient<C>` をジェネリック化**し、コンストラクタの `fields` から `C` を推論。
- **案2: 別エントリ** `porters.withFields(myFields).candidate...` を生やす。
- **案3: グローバル module augmentation** で `ReadRecord` を拡張。

宣言 DSL の形（D2、[ADR-0005][0005] SD-2 で決定済み）:

- **ビルダー** `defineFields({ candidate: (f) => ({ U_x: f.number() }) })`（採用済み）／型マップ案（不採用）。

## Decision Outcome

**採用: 案1（ジェネリック `PortersClient<C>`）＋ ビルダー `defineFields`**。[ADR-0005][0005] の
コンストラクタ例（`fields: myFields`）に最も忠実で、既存のカタログ駆動機構をそのまま再利用できる。

- **D1 ジェネリック client**: `PortersClient<C extends DeclaredCatalogs = {}>`。コンストラクタが
  `options.fields`（`DefinedFields<C>`）から `C` を推論する。既定 `C = {}` で**現状と同一**
  （カスタム無し＝既存利用者は無変更）。データリソースの accessor を
  `Resource<静的カタログ & CustomFor<C, 名前>, Req>` に拡張する。
- **D2 宣言 DSL = ビルダー**（[ADR-0005][0005] SD-2）: `defineFields({ candidate: (f) => ({...}) })`。
  各 `f.X()` は `FieldDef<DataType>`（`{ readonly dataType }`）を返す。結果は **branded**
  （phantom symbol）＝「検証済み」マークで、`PortersClient` は再検証しない。
- **D3 ビルダーの型**: カスタム項目に適用しうる Data Type のみ公開する＝
  `number` / `singlelineText` / `multilineText` / `mail` / `telephone` / `url` /
  `date` / `dateTime` / `age` / `option` / `user`。
  System 系（`System[Id]` / `System[DateTime]` / `System[Reference]`）は**システム管理＝標準項目の領域**
  なので公開しない。Image / Link は内部 `DataType`（`src/xml/decode.ts`）に未モデルのため対象外。
  Reference / Image 型のカスタム項目は将来課題。
- **D4 検証境界 = `defineFields`（同期）**: ここが唯一の検証点（[ADR-0005][0005]）。
  alias は `U_` / `A_` 接頭辞のみ許可し、`P_*`（静的カタログの領域）や他形式は `PortersConfigError`
  （category `config` — [ADR-0006][0006]）を同期 throw。リソースキーは既知のデータリソース集合
  （candidate / job / client / process / resume）で検証し、未知キー（タイポ）も throw（フェイルセーフ）。
  通過後の `myFields` は branded ＝ `PortersClient` は再検証しない。
- **D5 実行時検証はディスパッチのみ**（v1 スコープ）: 宣言済み項目は declared Data Type で
  decode / encode される。**値レベルの厳格検証**（declared 型に合致しない値を判別可能エラーで弾く）と、
  **ライブ Field Read による「テナント実在」検証 ／ 宣言雛形の自動生成**（[ADR-0004][0004] の P2 opt-in
  dev ツール）は本 ADR のスコープ外＝follow-up。現状でも「宣言済みは正しい型で処理／未宣言は素通し」で
  フェイルセーフは満たす。
- **D6 対象スコープ**: データリソース 5 種（candidate / job / client / process / resume）。
  Attachment（専用アクセサ・カタログ非利用）とマスタ Read（Partition / User / Field / Option・読み取り専用）
  は対象外。Attachment のカスタム項目は将来課題。
- **D7 マージ意味論**: 各リソース工場で `{ ...静的FIELDS, ...custom }` を実行時マージし、型は
  `静的カタログ & C` で表す（`U_`/`A_` は `P_` と衝突しないので交差が正しい）。カスタムは
  `requiredOnCreate` に入らない（常に任意）。書き込み可否は declared Data Type が決める（既存 `WritableKeys`）。

### Consequences

- Good: 宣言したカスタム項目が補完つき・正しい Data Type で decode/encode。既定は無変更。
  既存のカタログ駆動機構の再利用で**コア追加は薄い**。検証境界が一点（`defineFields`）に集約。
- Bad: `PortersClient` がジェネリックになり型機構（条件型・brand）が増える。値レベル検証は未対応
  （declared 型と異なる値はディスパッチされるが弾かれない）。
- Neutral: 公開 API に `defineFields` / `FieldDef` / `FieldBuilder` / `DefinedFields` が増える。
  Attachment / Reference / Image のカスタム項目と厳格検証は後続 ADR / PR。

## Pros and Cons of the Options

### 案1: ジェネリック `PortersClient<C>`

- Good: [ADR-0005][0005] の `fields: myFields` に忠実。型が自然に accessor まで流れる。既定 `{}` で無変更。
- Bad: クラスのジェネリック化と条件型のメンテ。

### 案2: 別エントリ `withFields()`

- Good: client を非ジェネリックに保てる。
- Bad: [ADR-0005][0005] の確定形（コンストラクタ `fields`）から乖離。経路が二系統に分裂。

### 案3: グローバル module augmentation

- Good: 呼び出し側の記述が最小。
- Bad: 複数テナント／複数 client を 1 プロセスで扱えない（グローバル汚染）。フェイルセーフに反する。却下。

## More Information

- 前提/接地対象: [ADR-0004][0004]（型モデル・案H＝静的＋宣言）、[ADR-0005][0005]（公開 API・SD-2 ビルダー）。
- 関連: [ADR-0016][0016]（内部 Data Type 粒度）、[ADR-0019][0019]（カタログ導出の静的型）、
  [ADR-0006][0006]（`PortersConfigError`）、[requirements][prd] R-16。
- 関連実装: `src/fields/`（新規 DSL）、`src/resources/*.ts`（工場のマージ）、`src/client.ts`（ジェネリック化）。
- follow-up（本 ADR スコープ外）: 値レベルの実行時検証 ／ ライブ Field Read 検証・宣言雛形生成（[ADR-0004][0004] P2）
  ／ Attachment・Reference・Image 型のカスタム項目。

[prd]: ../design/requirements.md
[0004]: 0004-field-type-model.md
[0005]: 0005-public-api-shape.md
[0006]: 0006-error-model.md
[0016]: 0016-field-type-granularity.md
[0019]: 0019-static-resource-types.md
