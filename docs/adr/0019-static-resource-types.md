# 19. 静的リソース型の実装（カタログ導出の Read/Write 型・SD-3）

- Status: accepted
- Date: 2026-06-17
- Deciders: jun.shiromoto (Joymerrevent)

> 議論の結果 **案A（カタログ導出）＋案W2（create/update で入力型を分離・create は必須項目を型で要求）
> ＋案U1（既知 `P_` のみ型付け）** で accepted（2026-06-17）。コードへの反映（`createResource` の generic 化・
> `DataType→値型` マップ・各カタログへの required-on-create マーク・型テスト）は本 ADR を受けて別 PR で行う。

## Context and Problem Statement

[ADR-0004][0004] で「標準 `P_` は同梱の静的型」、[ADR-0005][0005] で `porters.candidate.get()` が
型付き `Candidate` を返し `create()` が型付き入力を取る形を決めた（**SD-3 = 簡易**: 全既知項目を持つ型・
field 選択は実行時。選択で型を絞る案は将来 P1）。

しかし現状の実装は型が付いていない:

- Read: `Candidate = ResourceItem = Record<string, FieldValue>`
- Write: `CandidateInput = ResourceInput = Record<string, WriteValue>`
- 真実源は各リソースのランタイム `Map<string, DataType>` カタログ（型レベルから読めない）

問い: **標準 `P_` の静的 Read/Write 型をどう実装するか**（カタログとの整合をどう保つか）、
**Write 型の厳密さ**（除外・必須・任意）、**`U_`/`A_` カスタム項目をどう開くか**。

## Decision Drivers

- **型安全・DX（補完）**: [ADR-0005][0005] の最優先目標。
- **single source of truth**: 型とランタイムのカタログでズレを作らない（薄く・堅く）。
- **フェイルセーフ**: 未取得項目・未知キーに強い。誤りを握り潰さない。
- **依存ゼロ**: 型のみ・自前。codegen やスキーマライブラリを増やさない。
- **既存決定との整合**: [ADR-0016][0016]（`System[DateTime]` は Write 不可）・[ADR-0017][0017]（Option=`string[]`）。
- **公開値表現は不変**: 内部実装の変更であり、利用者が受け取る値・README 表記は変えない。

## Considered Options

### 軸1: 静的型の導出メカニズム

- **案A: カタログを `as const` 化し型マップで導出** — カタログ 1 箇所を真実源に、`DataType → 値型`
  の型マップで Read/Write 型を自動導出。
- **案B: リソース毎に静的型を手書き** — カタログと型を二重管理。
- **案C: スキーマファイルから codegen** — 別形式から型生成。

### 軸2: Write 型の厳密さ

- **案W1: 簡易** — `P_Id`（System[Id]）と `System[DateTime]`（登録日/更新日）を型から除外。残りは任意・値型付き。
- **案W2: 厳密** — `create` は `P_Owner` 等を必須、`update` は任意、という差を型で表現。

### 軸3: `U_`/`A_` カスタム項目

- **案U1: 既知 `P_` のみ型付け（閉じる）** — `U_`/`A_` は defineFields（[ADR-0005][0005] SD-2）の将来作業で型注入。
- **案U2: open index signature** — 任意キーを許容。実行時は維持だが補完・誤キー検知が弱まる。
- **案U3: 折衷** — 既知 `P_` ＋ `U_`/`A_` 接頭辞限定の緩い index。

## Decision Outcome

採用: **案A ＋ 案W2 ＋ 案U1**。

- **A**: カタログを単一の真実源にできゼロドリフト。`createResource<const TFields>` を generic 化し、
  `DataType → 復号値型`／`DataType → 書込値型` の型マップで Read/Write 型を導出する。型のみで実行時挙動は不変。
- **W2**: `create` と `update` でメソッドが分かれている以上、入力型も分けるのが自然で安全。`create` は
  新規作成で必須の項目（`P_Owner` 等。リソース毎に PORTERS 仕様から required を確定）を**型で必須**にし、
  `update` は全項目任意。`P_Id`・`System[DateTime]` はいずれも型から除外（[ADR-0016][0016] の Write 制限を実現）。
  required の根拠は各カタログに **required-on-create マーク**を持たせ、型と実行時で共有する。
- **U1**: 公開型は既知 `P_` を精密にし、`U_`/`A_` は SD-2（defineFields）の将来作業に委ねる。本 ADR では
  open index を入れない（誤キー検知＝フェイルセーフを優先）。ただし**実行時は未知キーも従来どおり raw 通過**し、
  挙動は壊さない。

### Consequences

- Good: 補完・型安全。カタログ 1 箇所が真実源でズレ無し。`System[DateTime]` が型レベルで書けない。
  **create の必須項目漏れをコンパイル時に検知**できる。
- Bad: 型マップ＋generic の実装と、全リソースの `as const` カタログへの移行。各リソースの**必須項目を
  PORTERS 仕様から洗う調査**と、`create`/`update` の入力型分岐が要る。
- Neutral: field 選択での型絞り込み・`U_`/`A_` 型注入は将来（P1）。

## Pros and Cons of the Options

### 軸1

- **案A**: Good=単一真実源・ゼロドリフト・依存ゼロ・型のみで実行時不変。Bad=やや高度な型（mapped/const 型引数）。
- **案B**: Good=型が素直で読みやすい。Bad=カタログと二重管理＝ドリフトの温床（フェイルセーフに反する）。
- **案C**: Good=大量リソースに強い。Bad=ビルド工程・別形式の維持コスト。MVP 規模に過剰。

### 軸2

- **案W1**: Good=薄い・SD-3「簡易」と整合・除外で安全側。Bad=必須項目を型で防げない（PORTERS エラーに委ねる）。
- **案W2**: Good=create の必須漏れを型で検知。Bad=create/update で型が分岐し複雑。required の正確な把握も要る（リソース毎調査）。

### 軸3

- **案U1**: Good=既知項目の補完が最も鋭い・誤キー検知。Bad=`U_`/`A_` は当面 raw（型補助なし、SD-2 待ち）。
- **案U2**: Good=任意キーをそのまま書ける。Bad=誤キーが型を通る＝フェイルセーフに反する。
- **案U3**: Good=折衷。Bad=index の緩さで結局誤検知が残る・規則が複雑。

## More Information

- 前提/依存: [ADR-0004][0004]（型モデル）・[ADR-0005][0005]（公開 API・SD-3）・[ADR-0016][0016]（DataType）・[ADR-0017][0017]（Option）。
- 関連実装: `src/resources/resource.ts`（`createResource` / `Resource` / `ResourceItem` / `ResourceInput`）、
  各 `src/resources/*.ts` のカタログ、`src/xml/decode.ts`（`DataType` / `FieldValue`）、`src/xml/encode.ts`（`WriteValue`）。
- 将来（P1）: field 選択での返り値型の絞り込み（[ADR-0005][0005] SD-3）・`U_`/`A_` の型注入（SD-2 defineFields）。

[0004]: 0004-field-type-model.md
[0005]: 0005-public-api-shape.md
[0016]: 0016-field-type-granularity.md
[0017]: 0017-option-read-shape.md
