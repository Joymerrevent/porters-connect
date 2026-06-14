# 5. 公開 API の形（PortersClient・アクセサ・宣言 DSL・返り値/エラー）

- Status: accepted
- Date: 2026-06-13
- Deciders: jun.shiromoto (Joymerrevent)

> 案1 ＋ SD 全採用で `accepted`（2026-06-13）。エラーの**型詳細**は別 ADR（エラーモデル）、
> XML の値エンコードは別 ADR（XML パース/シリアライズ）で詰める。本 ADR は**外から見える形**を確定。

## Context and Problem Statement

[ADR-0004][0004] で型モデル（標準 `P_` は静的型、カスタム `U_`/`A_` は利用者が宣言）を決めた。
次は**利用者が実際に触る外部インターフェース全体**を決める：クライアント構築・リソースアクセサ・
カスタム項目の宣言 DSL・検索/ページングの公開面・返り値とエラーの契約・第2層 MCP が内部呼び出しできる形。
最優先は **DX「簡単」**・**型安全**・**フェイルセーフ**・**薄く**（[requirements][prd]）。

## Decision Drivers

- **DX「簡単」**＝デファクト（第一想起）の条件。学習曲線を低く、定型作業を消す。
- **型安全**（[ADR-0004][0004] と整合：標準は補完、カスタムは宣言で型付き）。
- **フェイルセーフ**：失敗を握り潰さない・未知に強い。
- **薄く・堅く**：依存を増やさない（宣言 DSL は自前軽量）。
- **MCP が上に薄く乗れる**：メソッドをそのまま tool から呼べる。
- **契約なしで使える**：transport 注入でモック動作。

## Considered Options（アクセサのスタイル）

- **案1: 名前空間付き型付きアクセサ** `porters.candidate.search()`（推奨）
- **案2: 汎用** `porters.resource("candidate").search()`
- **案3: 関数型** `searchCandidates(client, ...)`

## Decision Outcome

**採用: 案1（名前空間アクセサ）** ＋ 以下の形。

### クライアント構築

```ts
const porters = new PortersClient({
  host: process.env.PORTERS_HOST!, // 既定 api-hrbc-jp.porterscloud.com
  appId: process.env.PORTERS_APP_ID!,
  appSecret: process.env.PORTERS_APP_SECRET!,
  scopes: ["candidate_r", "candidate_w", "user_r", "option_r"],
  partition: 999999, // 既定 partition（呼び出し毎に上書き可）
  fields: myFields, // カスタム項目の宣言（後述・任意）
  transport, // 注入可能（モック/テスト）。既定は fetch ベース
  tokenStore, // 既定インメモリ
});
```

### 読み取り / 取得 / 書き込み

```ts
const page = await porters.candidate.search({
  field: ["P_Id", "P_Name", "P_Mail"], // 既定は P_Id のみ
  condition: { P_UpdateDate: { ge: "2026-01-01T00:00:00Z" } },
  order: [{ P_Id: "desc" }],
  count: 50,
  start: 0,
});
// page.items: Candidate[] / page.total / page.count / page.start

const one = await porters.candidate.get(1234);

const created = await porters.candidate.create({
  P_Owner: 5, // User/参照は ID で指定
  P_Name: "山田 太郎",
}); // P_Id=-1 はライブラリが付与
await porters.candidate.update(1234, { P_Name: "山田 花子" });
// delete は存在しない（型にも無い）
```

### カスタム項目の宣言 DSL（[ADR-0004][0004] の宣言部・自前軽量）

```ts
// flavor B（ビルダー・推奨）: 実行時検証と型推論が一体
const myFields = defineFields({
  candidate: (f) => ({
    U_score: f.number(),
    U_source: f.option(),
    U_resume: f.image(),
  }),
});
// → porters.candidate.get(id) の結果に U_score: number | null 等が型付きで生える
```

`defineFields()` は**検証の境界**：不正な宣言（alias 書式・重複・未対応型）は同期で
`PortersConfigError` を throw する（→ エラーモデルの ADR）。通過後の `myFields` は branded で安全＝
`PortersClient` は再検証しない。ただし「項目がテナントに実在するか」は実行時にフェイルセーフ検証する。

### ページング

```ts
const page = await porters.candidate.search({ count: 200 }); // 1 ページ
for await (const c of porters.candidate.searchAll({ condition: { ... } })) {
  // 200 件刻みを内部処理（上限/中断可能）
}
```

### 返り値 / エラー（throw 型付きエラー）

```ts
try {
  await porters.candidate.search({ ... });
} catch (e) {
  if (e instanceof PortersError) {
    e.category; // "auth" | "permission" | "validation" | "rateLimit" | … 全 11 種は ADR-0006
    e.code; // PORTERS の生コード（例 401/403/100…）
    e.hint; // 対処ヒント（既定英語）
  }
}
```

### 第2層 MCP の接ぎ目

メソッド群を**純粋に呼べる**形にし、状態は `PortersClient` に閉じる。第2層 MCP は
`porters.candidate.search` 等を tool ハンドラから**そのまま呼ぶだけ**にできる（ロジック重複なし）。

## サブ決定（確定）

- **SD-1 返り値契約 → throw 型付きエラー**（idiomatic・低摩擦、リッチな型でフェイルセーフ担保）。`Result` 型は採らない。
- **SD-2 宣言 DSL → ビルダー `f.number()`**（依存ゼロ・検証と推論が一体）。型マップ案は不採用。
- **SD-3 field 選択と返り値型 → 簡易**（全既知項目を持つ型・選択は実行時）。選択で型を絞る案は将来（P1）。

### Consequences

- Good: 型付きで補完が効き、定型（XML/OAuth/ページング）が消える。MCP が薄く乗る。モックで契約なし利用可。
- Bad: 宣言 DSL と型生成の実装コスト。field 選択の型を簡易にすると「取得していない項目」も型に出る（実行時 undefined）。
- Neutral: エラーの型詳細・XML エンコード・ページング内部は後続 ADR。

## Pros and Cons of the Options

### 案1: 名前空間アクセサ

- Good: 補完が効く・読みやすい・リソース毎に型を出しやすい・MCP 化しやすい。
- Bad: リソース毎にアクセサ定義が要る（生成で軽減）。

### 案2: 汎用 `resource("candidate")`

- Good: 実装が少ない。
- Bad: 文字列キー＝補完/型が弱い。型安全の目標に反しがち。

### 案3: 関数型 `searchCandidates(client, ...)`

- Good: tree-shaking に強い。
- Bad: 名前空間の発見性が弱い・`client` を毎回渡す冗長さ。

## More Information

- 前提/依存: [ADR-0004][0004]（型モデル）、[requirements][prd]（R-2/R-3/R-5/R-6/R-9/R-12）。
- 後続: エラーモデル ADR（`PortersError` の型詳細）、XML パース/シリアライズ ADR（値エンコード）、ページング ADR（内部）。
- 関連: [[0004-field-type-model]]。

[0004]: 0004-field-type-model.md
[prd]: ../design/requirements.md
