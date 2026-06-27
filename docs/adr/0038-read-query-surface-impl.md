# 38. Read クエリ面 `order` / `keywords` / `itemstate` ＋ typed `condition` の詳細設計（F-2）

- Status: proposed
- Date: 2026-06-27
- Deciders: jun.shiromoto (Joymerrevent)

> [[0005-public-api-shape]]（公開 API の形・R-5）が約束した検索クエリ面を実装に落とす**詳細設計**。
> [[0033-post-mvp-direction]] 案F-2（v1 公開面の積み残し）。**公開シェイプの骨子は ADR-0005 で確定済み**
> （`condition` / `order` / `count` / `start`）で再決定しない。本 ADR は **typed `condition` の型モデル・
> `keywords` / `itemstate` の形・値正規化・`itemstate` の condition 制約・エンコード配置**を reference に接地して詰める。
> `proposed`（議論待ち）。

## Context and Problem Statement

現状の公開検索クエリ `SearchQuery`（`src/resources/resource.ts:35-46`）は **`{ field, condition, count, start }` のみ**で、
`condition` は loose な `Record<string, string>`（キーに `Alias:suffix`、値は生文字列。例
`{ "Person.P_Id:eq": "1" }`）。**`order` / `keywords` / `itemstate` は不在**。横断監査（2026-06-22・[reviews][rev]）で
[R-5][prd]（型付き検索面）の積み残しと判明し、[[0033-post-mvp-direction]] 案F-2 として起票された。

[[0005-public-api-shape]] は公開シェイプを `condition: { P_UpdateDate: { ge: "…Z" } }` / `order: [{ P_Id: "desc" }]` と
**スケッチ**したが、型モデル（suffix を Data Type で絞るか）・値正規化（ISO ⇄ PORTERS）・`keywords` / `itemstate` の形・
`itemstate` の condition 制約は詰めていない。これらは reference の **[Read-API-Parameter][param]**（`field`/`condition`/
`keywords`/`order` の語彙・型別 suffix）と **[削除済みデータ取得][del]**（`itemstate` と制約）が正確に定義しており、本 ADR で接地する。

reference が定める事実（要点）:

- **condition**: `[Alias]:[suffix]=[value]` をカンマ結合（項目間 AND）。型別 suffix —
  数値/日付系（Number/Currency/DateTime/Date/Age/System[Id]）= `gt`/`ge`/`eq`(既定)/`le`/`lt`（`or` は Phase Id・Resource Id のみ）、
  テキスト系（SinglelineText/MultilineText/Telephone/Mail/URL）= `full`/`part`(既定)、
  Option = `or`(既定)/`and`（値は `Option.P_xxx` を `:` 区切り）、Link（ユーザー型/部署型/担当者型）= `or`(既定)/`and`（値は ID を `:` 区切り）。
  **上位階層の field は不可**（紐づく上位 ID を持つ項目で ID 検索は可）。**複数 ID・範囲指定は不可**。
- **keywords**: `kw1,kw2,…` をカンマ結合（**AND のみ・OR 不可**）。対象は MultilineText/SinglelineText/Mail/URL（Telephone は数字のみ）。
  **カンマ込み 100 文字まで**。
- **order**: `[Alias]:desc`/`:asc` を複数可。対象 Data Type は **Number/Currency/Age/Date/DateTime/System のみ**。
- **itemstate**: `existing`(既定)/`deleted`/`all`。**削除 API 非提供下で削除済みデータを読む唯一の正規手段**。
  `deleted`/`all` 時、condition に使える field は **`P_Id` / `P_UpdateDate` / `P_UpdatedBy` の 3 種のみ**
  （`P_UpdateDate`=削除日時・`P_UpdatedBy`=削除前の最終更新者）。`deleted`/`all` では**更新日 90 日以内**が自動付与される。
  対象 API は Client/Recruiter/Job/Candidate/Resume/Process/Activity/Contract/Sales。削除状態は `{Resource}.P_Deleted` で表され、
  **取得するには `field` に明示指定が必要**。

問い: **typed `condition` をどの強さで型付けするか**、**`order`/`keywords`/`itemstate` をどう公開するか**、
**値正規化（ISO 日時 → PORTERS 形式）をどこで行うか**、**`itemstate` の condition 制約をどう守るか**、
**エンコードをどこに置き master Read（[[0022-master-read-query-surface]] の bespoke）とどう切り分けるか**。

## Decision Drivers

- **型安全**（[[0004-field-type-model]] / [[0005-public-api-shape]]）: 受け付けない suffix・未知 alias を**型で弾く**。カタログ（`as const`）に Data Type があり活かせる。
- **API 忠実 / 接地**（[[0002-ground-design-in-live-api-docs]]）: reference の語彙・制約に一致させる。受け付けない形を偽装しない。
- **フェイルセーフ**: サーバが 400 にする入力（`keywords` 100 字超・`itemstate` の condition 制約違反）を**送信前に弾く**（既存 `MAX_REQUEST_LENGTH` ガードと同じ思想）。失敗を握り潰さない。
- **薄く・堅く・メンテしやすく**: 型機構を過剰にしない。複雑な mapped type の保守コストと型安全のトレードオフを意識する。
- **日時は ISO（UTC `…Z`）正規化**（`CLAUDE.md` #3 / [R-10][prd] / [[0011-xml-parse-serialize]]）: condition の日付値も ISO で受け、`util/datetime` で PORTERS 形式へ。業務 TZ 変換はしない。
- **既存資産の再利用**: read-core（封筒/ページング）・`util/datetime`・送信前 `PortersConfigError` ガード。
- **MCP が薄く乗れる**（[[0005-public-api-shape]]）: メソッドをそのまま tool から呼べる形を保つ。

## Considered Options

### 軸1: `condition` の型モデル

- **案1a: Data-Type 認識の typed condition（推奨）** — catalog alias をキーに、値は当該 alias の **Data Type から導く suffix-object**。
  Number/日付系 → `{ gt?, ge?, eq?, le?, lt? }`、Text 系 → `{ full?, part? }`、Option → `{ or?, and? }`（値は option alias の配列）、
  Link → `{ or?, and? }`（値は number[] の ID）。日付系の値は **ISO string**、その他スカラは number/string。未知 alias・誤った suffix は**型エラー**。
- **案1b: 一様 suffix-object** — alias をキーに、値は全 suffix の共用体 `{ eq?, ge?, le?, full?, part?, or?, and? }`（Data Type で絞らない）。
  型は軽いが、Number に `part`、Text に `ge` を**型上は許す**（取りこぼし）。
- **案1c: loose `Record<string,string>` 維持 ＋ 型付きビルダー関数** — 最小変更。R-5 の「typed」を満たさず、alias タイポを実行時まで検知できない。

### 軸2: `order` の形と対象制限

- **案2a: 単一キー object の配列（推奨・ADR-0005 スケッチ準拠）** — `order?: Array<{ [alias]: "asc" | "desc" }>`。
  orderable Data Type（Number/Currency/Age/Date/DateTime/System）に**型制限**。
- **案2b: タプル配列** — `order?: Array<[alias, "asc" | "desc"]>`。
  （順序が意味を持つため `Partial<Record<alias, dir>>` は不可＝キー順依存になる。）

### 軸3: `keywords`

- `keywords?: string[]`（カンマ結合・AND 固定）。**送信前にカンマ込み 100 文字ガード** → 超過は `PortersConfigError`
  （クラスは Auth/Resource/Network/**Config** の 4 種のみ・[[0006-error-model]]。送信前のクライアント側ミスユースは既存 `MAX_REQUEST_LENGTH` と同様 Config）。
  Telephone は数字のみ（利用者責務・JSDoc 明示）。

### 軸4: `itemstate` と condition 制約

- `itemstate?: "existing" | "deleted" | "all"`（既定 `existing` → param 省略）。`deleted`/`all` の condition 制約（`P_Id`/`P_UpdateDate`/`P_UpdatedBy` のみ）の守り方:
  - **案4a: 実行時フェイルセーフガード ＋ JSDoc（推奨）** — `deleted`/`all` かつ許可外 alias の condition があれば送信前に `PortersConfigError`（hint で 3 種を案内）。型は素直なまま。
  - **案4b: 型レベルで condition キーを narrow（discriminated overload）** — `itemstate` の値で `condition` の許可キーを切り替える。型安全だが overload/条件型が重く保守負荷大。

### 軸5: 値正規化（datetime）

- Date/DateTime/System[DateTime] alias の condition 値は **ISO（UTC `…Z`）で受け、`isoToPortersDate(Time)` で PORTERS 形式へ正規化**してエンコード。
  Number/Currency/Age/System[Id] は stringify、Text/Mail/URL は生、Option は option alias を `:` 結合、Link は ID を `:` 結合。`order` に値なし・`keywords` は生。

### 軸6: エンコード配置

- **新規 `src/resources/query.ts`**（typed query → wire param 文字列のエンコーダ：condition/order/keywords/itemstate）を `buildReadUrl` が利用。
  `get(id)` 内部 condition は新 typed 形へ追従。**master Read（[[0022-master-read-query-surface]] の bespoke クエリ）は対象外で不変**（マスタは `condition`/`order`/`keywords`/`itemstate` を受けない）。

### 軸7: 後方互換 / semver

- `condition` を loose `Record<string,string>` → typed に変える＝**公開型の破壊的変更**。pre-1.0（0.x）なので semver 上 **minor バンプ**。
  移行は CHANGELOG / guide に明記。loose 併存（`typed | Record`）は型安全を薄めるため**採らない**（clean break）。

## Decision Outcome（recommended・proposed）

> **`proposed`。下記は推奨方針で、accept 前にチームで議論する**（特に軸1 の型モデル＝型安全 vs 保守コスト、軸7 の破壊的変更）。

推奨: **案1a ／ 案2a ／ 軸3 ガード ／ 案4a ／ 値正規化あり ／ 新 `query.ts` ／ clean break**。サブ決定:

- **SD-1 condition = 案1a（Data-Type 認識）**。`Condition<F>` を catalog `F` 上の mapped type とし、各 alias の許可 suffix と値型を `F[alias]` の Data Type から導く。
  未知 alias・誤 suffix は型エラー。複数 alias は AND（reference）。上位階層 field は表現せず、紐づく ID 項目（Reference 型 alias）の `eq`/`or` で ID 検索を表す。
  保守コストが過大なら fallback は**案1b（一様 suffix-object）**（議論ポイント）。
- **SD-2 order = 案2a**（単一キー object 配列）。orderable Data Type（Number/Currency/Age/Date/DateTime/System）に型制限。複数指定はカンマ結合。
- **SD-3 keywords**（軸3）。`string[]` をカンマ結合（AND）。送信前にカンマ込み 100 字ガード → `PortersConfigError`。
- **SD-4 itemstate = 案4a**。union＋既定 `existing` は param 省略。`deleted`/`all` 時は condition を `{P_Id, P_UpdateDate, P_UpdatedBy}` に限る**実行時ガード**（許可外は `PortersConfigError`＋hint）。サーバの 90 日自動フィルタは JSDoc で周知（ライブラリは付与しない）。
- **SD-5 `P_Deleted`**。カタログ非収録で、本 ADR では**カタログへ追加しない**（Data Type 未確定＝Number フラグ想定だが [live-verification][lv] 対象）。
  削除メタ（削除日時＝`P_UpdateDate`・最終更新者＝`P_UpdatedBy`）はカタログ済みで `itemstate` の最小利用は成立。`P_Deleted` フラグは `field: ["{Prefix}.P_Deleted"]` の明示指定で raw 取得可（非カタログ alias は passthrough）。
  型付き fidelity（`P_Deleted` のカタログ追加）は **F-2 のフォローアップ / LV** とする。
- **SD-6 値正規化**（軸5）。Date/DateTime/System[DateTime] は ISO → PORTERS（`util/datetime`）。他は SD で定めた通り stringify / 生 / `:` 結合。
- **SD-7 配置 = 新 `src/resources/query.ts`**（純粋エンコーダ・1 ファイル1責務・[[0013-coding-conventions-class-vs-function]]）。`buildReadUrl` 結線、`get(id)` 追従、master Read 不変。
- **SD-8 エスケープ**。condition/order/keywords はカンマ・コロンを**構造区切りとして組み立ててから** `URLSearchParams.set` に渡す（値内のエンコードは URLSearchParams 任せ・現行踏襲）。`secret`/token は載らない。
- **SD-9 テスト**（[[0014-test-coverage-policy]]・perFile 100 / branch ≥90）。`query.ts` の単体（型別 suffix・多 condition AND・多 order・keywords 100 字境界・itemstate param ＋制約ガード・datetime 正規化）、誤用の型テスト（`@ts-expect-error`）、mock transport（[[0024-mock-transport]]）結線。
- **SD-10 docs**。guide（検索クエリ）＋ JSDoc、CHANGELOG（condition 破壊的変更＝minor）。**反映は accept 後**（[ADR 運用][adr]）。

### Consequences

- Good: [R-5][prd] の積み残しを解消し、reference 忠実で**型安全な検索面**が出荷。`itemstate` で削除済み Read を回復（削除 API 非提供下の唯一手段）。送信前ガードでフェイルセーフ。master Read と責務分離を保つ。
- Bad: 案1a の Data-Type 認識 mapped type は **TS 型機構が増え保守負荷**（薄さとのトレードオフ）。`condition` の loose→typed は**破壊的変更**（pre-1.0 minor・移行周知が要る）。
- Neutral: master Read（[[0022-master-read-query-surface]]）は対象外で不変。`P_Deleted` の型付き fidelity は follow-up / LV に送る。`itemstate=deleted/all` の 90 日自動フィルタ等の実挙動は [live-verification][lv] で接地（契約環境後）。

## Pros and Cons of the Options

### 軸1（condition）

- **案1a**: Good=型安全最大・reference の型別 suffix を忠実に表現・タイポを型で検知。Bad=mapped/条件型が増え保守コスト。
- **案1b**: Good=型が軽い・実装容易。Bad=型上の取りこぼし（Number に part 等）。
- **案1c**: Good=最小変更。Bad=R-5「typed」不達・alias タイポを実行時まで検知不可。

### 軸2（order）

- **案2a**: Good=ADR-0005 スケッチ準拠・alias がキーで読みやすい。Bad=単一キー object の配列は型がやや技巧的。
- **案2b**: Good=実装単純。Bad=タプルは可読性で劣る・alias と dir の対応が緩い。

### 軸4（itemstate 制約）

- **案4a**: Good=型は素直・送信前に明確なエラー。Bad=制約違反を型では防げない（実行時）。
- **案4b**: Good=型で制約を強制。Bad=overload/条件型が重く保守負荷・他軸の型と干渉。

## More Information

- 実装する公開シェイプの正: [[0005-public-api-shape]]（`condition`/`order`/`count`/`start` のスケッチ・R-5）。
- reference 接地: [Read-API-Parameter][param]（field/condition/keywords/order・型別 suffix）、[削除済みデータ取得][del]（itemstate・condition 3 種制約・90 日・P_Deleted）。
- 内部前提: [[0011-xml-parse-serialize]]（decode/値表現）、[[0006-error-model]]（`PortersConfigError`・送信前ガード）、[[0009-http-transport]]（transport seam）、[[0020-read-field-default]]（field 既定）、[[0013-coding-conventions-class-vs-function]]（factory・arrow・type）、[[0024-mock-transport]]（テスト）。
- 責務分離: [[0022-master-read-query-surface]]（master は bespoke・本 ADR 対象外）。
- 位置づけ: [[0033-post-mvp-direction]] 案F-2。横断監査の証拠は [reviews][rev]。要件 [R-5][prd] / 日時 [R-10][prd]。
- 不確実性 → [live-verification][lv]: `P_Deleted` の Data Type、`itemstate=deleted/all` の 90 日自動フィルタ実挙動、Telephone keyword の数字正規化。
- 後続/対象外: 実装は別 PR（ADR 先行 → 実装の順・[[0033-post-mvp-direction]] 案F の進め方）。マルチテナント面（F-3・[[0008-multitenancy-partition]]）・一括書き込み（F-4）は本 ADR 対象外。

[param]: ../../tmp/porters-docs/txt/115008016927-Read-API-Parameter.md
[del]: ../../tmp/porters-docs/txt/360000589007-2018-04-10-Read系APIでの削除済みデータの取得.md
[prd]: ../design/requirements.md
[rev]: ../reviews/2026-06-22-03.md
[lv]: ../live-verification.md
[adr]: README.md
