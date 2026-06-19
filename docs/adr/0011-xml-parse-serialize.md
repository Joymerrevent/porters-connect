# 11. XML パース／シリアライズ内部（データ型別エンコード・Read/Write 非対称）

- Status: accepted
- Date: 2026-06-14
- Deciders: jun.shiromoto (Joymerrevent)

> [ADR-0004][0004]（型モデル）/ [ADR-0005][0005]（XML 非露出）の実装。値エンコードは両 ADR が本 ADR に委譲。
> 本 ADR は**パーサ設定とデータ型別デコード/エンコードの方式・PoC 範囲**の詳細設計。`accepted`（2026-06-14）：
> パーサは素の文字列（`parseTagValue:false`）、型変換は型駆動デコーダに一元化（silent な誤変換をしない）。

## Context and Problem Statement

Read 応答（[resource-api][rapi]）は `<{Resource} Total Count Start><Code>0</Code><Item><Alias>value</Alias>…`。
**Field Type ごとに XML 表現が異なり**（[field-data-types][fdt]）、**Read と Write で非対称**:

- **Option**: Read は `<Field><OptionRoot><OptionAlias>…</OptionAlias></OptionRoot></Field>`（末端 alias のみ）／ Write は末端 alias 指定。
- **System[Reference] / User**: Read は入れ子（参照先項目）／ Write は `{Resource}.P_Id`（User は `User.P_Id`）のみ。
- **Image**: `FileName`/`ContentType`/`Content`(Base64)。**Link**: ID（version 2 必須）。
- **日時**: `yyyy/mm/dd HH:MM:SS`（UTC）/ `yyyy/mm/dd`。新規 Write は `P_Id=-1`。

`fast-xml-parser` の設定と、型別デコード/エンコードの置き方、PoC でどこまで復号するかを決める。

## Decision Drivers

- **XML を漏らさない**（[ADR-0005][0005]）・**型安全**（[ADR-0004][0004]）。
- **フェイルセーフ**: 未知 Field/型不一致はクラッシュさせず [ADR-0006][0006] の `validation` で surface（silent な誤変換をしない）。
- **薄く・保守容易**: 型別ロジックを 1 箇所に集約（[field-data-types][fdt] と対応）。
- **日時は集約**: `util/datetime`（PRD R-10）に委ね、本層では呼ぶだけ。
- **Read/Write 非対称**を型と変換の両方で吸収。

## Considered Options

- デコード設計: 案A **型駆動の汎用デコーダ**（Field Type → encode/decode のマップ）／ 案B リソース別の手書きマッパー／ 案C スキーマ駆動（`fields` 宣言から構築）
- PoC のデコード範囲: **現実的サブセット**（Id/DateTime/text/User 入れ子/Option 末端）/ スカラのみ最小

## Decision Outcome

**採用: 案A 型駆動デコーダ**で `accepted`。Field Type ごとの decode/encode を 1 箇所に持ち、標準 `P_`・カスタム
`U_`/`A_`（[ADR-0004][0004]）双方が同じ変換を通る。

- **パーサは素の文字列を返す（`parseTagValue: false`）**。`fast-xml-parser` の自動型変換は使わず、`Number→number` /
  `Telephone`・`Zipcode`→`string`（変換しない）/ `DateTime→ISO` など**全変換を型駆動デコーダ側**で行う。
  自動変換は `0012→12`・電話の先頭ゼロ消失など **silent なデータ破壊**を生むため（フェイルセーフ）。
- `ignoreAttributes: false`（`Total`/`Count`/`Start` を読む）、`<Item>` と Option の選択肢ノードは
  **常に配列化**（`isArray`、件数 1 でも配列）。DTD/外部エンティティは扱わない。
- **欠損の表現**: 値が空（`<P_Name/>`）→ **`null`**／そもそも未取得（`field=` に無い）→ **`undefined`**
  （[ADR-0005][0005] SD-3 / [ADR-0006][0006]）。
- **エラー経路**: XML 層がまず `<{Resource}><Code>`（resource）/ `<Authentication><Error>`（auth）を判定し、
  `0` 以外なら [ADR-0006][0006] のエラーへ**ルーティングしてからデータ復号**（HTTP200+`<Code>≠0` を data として読まない）。
- **alias のタグ名**: 接頭辞付き（`{Resource}.P_xx`、Candidate は `Person.P_Id`）を既定の想定とするが、**decoder は
  接頭辞の有無どちらでも正規化**できるようにする（仕様が断定しづらいため、PoC で実/サンプル XML を fixture 化して確定）。
  未知 alias は**生のまま保持して落とさない**（[ADR-0004][0004]「unknown 相当で露出」）。

**PoC のデコード範囲＝現実的サブセット（推奨）**:

- `System[Id]` → `number`（`P_Id`）
- `DateTime` / `System[DateTime]` → ISO `…Z`（`util/datetime`）
- `SinglelineText` / `MultilineText` / `Telephone` / `Mail` / `URL` → `string`
- `User` → 入れ子オブジェクト `{ P_Id, P_Type, P_Name, P_Mail }`
- `Option`（単一） → 末端 alias `string`

**後続（MVP）**: `Image`/`Link`/`Reference`、Option 複数、そして**全 Write エンコード**（参照/User の ID 化・`P_Id=-1` 付与・サイズガード連携）。

### Consequences

- Good: PoC で「XML 隠蔽＋入れ子復号（User/Option）」という核を実証。型別ロジック集約で保守容易・段階拡張。
- Good: パーサ自動変換を切り型駆動に一元化＝郵便番号/電話の **silent 破壊を防止**（フェイルセーフ）。null/undefined を分けて欠損が曖昧にならない。
- Bad: 型別マトリクスの網羅は段階的（PoC では一部のみ）。alias タグ名の最終確定は実 XML 待ち（fixture で吸収）。
- Neutral: Write エンコードと双方向の対称性検証は後続 ADR/実装で。

## Pros and Cons of the Options

### 案A: 型駆動の汎用デコーダ（推奨）

- Good: 1 箇所集約・Read/Write 非対称を型別に表現・カスタム項目も同経路。
- Bad: 初期の型別マップ整備コスト。

### 案B: リソース別手書きマッパー

- Good: 各リソースに最適化しやすい・最初は単純。
- Bad: リソース×型で重複・保守が分散・カスタム項目に弱い。

### 案C: スキーマ駆動（fields 宣言から）

- Good: 宣言と検証が一体（[ADR-0004][0004] の `defineFields` と親和）。
- Bad: 標準 `P_` まで宣言依存にすると重い。案A を土台にした上の最適化が妥当。

## More Information

- 前提/依存: [ADR-0004][0004]（型モデル）、[ADR-0005][0005]（XML 非露出）、[ADR-0006][0006]（未知/不一致の surface）、[resource-api][rapi]（Read XML）、[field-data-types][fdt]、[write-format][wf]、[requirements][prd]（R-4/R-10）。
- 後続: Write エンコード詳細・型別網羅（MVP）。
- 関連: [[0004-field-type-model]], [[0005-public-api-shape]]。

[prd]: ../design/requirements.md
[rapi]: ../reference/resource-api/README.md
[fdt]: ../reference/resource-api/field-data-types.md
[wf]: ../reference/resource-api/write-format.md
[0004]: 0004-field-type-model.md
[0005]: 0005-public-api-shape.md
[0006]: 0006-error-model.md
