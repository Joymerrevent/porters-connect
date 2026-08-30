# カスタム項目（`defineFields`）

PORTERS のテナントは、標準項目（`P_`）に加えて**テナント固有のカスタム項目**を持ちます。
ユーザーが作った項目は `U_[Name]`、アプリが作った項目は `A_[Name]` という alias になります。

カスタム項目は**テナントごとに違う**ので、ライブラリに同梱の静的な型には含められません。
代わりに、**利用側が `defineFields` で宣言する**と、その項目が読み書きの型に現れるようになります
（[ADR-0004][adr4] のハイブリッド方式／宣言 DSL の詳細設計は [ADR-0023][adr23]）。

## 3 行で

```ts
import { PortersClient, defineFields } from "@joymerrevent/porters-connect";

const fields = defineFields({
  candidate: (f) => ({ U_score: f.number(), U_source: f.option() }),
});

const porters = new PortersClient({
  host,
  appId,
  appSecret,
  partition,
  fields,
});
```

これで `t.candidate` の読み書きに `U_score` / `U_source` が**型付きで**現れます。

```ts
const one = await t.candidate.get(10001);
one?.U_score; // number | null | undefined
one?.U_source; // string[] | null | undefined（Option は選択された alias の配列）

await t.candidate.update(10001, { U_score: 80 }); // 型チェックされる
await t.candidate.update(10001, { U_score: "80" }); // ← 型エラー
```

## 宣言しないとどうなるか

**エラーにはなりません。** カタログに無い alias は、読み取りでは**生の文字列**、
書き込みでは**テキストとして**そのまま通ります。つまり宣言は「動かすため」ではなく
**型と値の変換を効かせるため**のものです。

宣言しない場合との違いは 3 つあります。

|            | 宣言しない                      | 宣言する                                                                              |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------------- |
| 型         | 現れない（`as` で cast が要る） | `Candidate` / `CreateInput` / `UpdateInput` / `SearchQuery` に現れる                  |
| 読み取り値 | 生の文字列                      | Data Type どおり（`Number` → `number`、`Option` → `string[]`、`DateTime` → ISO 8601） |
| 既定 field | 送られない（明示指定が要る）    | `field` 省略時に**自動で要求される**（[ADR-0020][adr20]）                             |

3 つ目が実務では効きます。宣言していないカスタム項目は、`field` を明示しない限り
**そもそも取得されません**。

なお `field` に書くだけなら宣言は要りません（`U_` / `A_` で始まる名前は未宣言でも通ります）。
ただし**宣言していないと `U_` 以降の綴りは検査されない**ので、
取得漏れを型で防ぎたいものはここで宣言してください（[ADR-0059][adr59]）。

## 宣言できる型

ビルダー `f` のメソッドが、そのまま Data Type に対応します。

| メソッド             | Data Type                                     | 読み取り値                                           |
| -------------------- | --------------------------------------------- | ---------------------------------------------------- |
| `f.number()`         | `Number`（Currency 含む）                     | `number`                                             |
| `f.singlelineText()` | `SinglelineText`                              | `string`                                             |
| `f.multilineText()`  | `MultilineText`                               | `string`                                             |
| `f.mail()`           | `Mail`                                        | `string`                                             |
| `f.telephone()`      | `Telephone`                                   | `string`                                             |
| `f.url()`            | `URL`                                         | `string`                                             |
| `f.date()`           | `Date`                                        | `string`（ISO 8601）                                 |
| `f.dateTime()`       | `DateTime`                                    | `string`（ISO 8601・UTC `…Z`）                       |
| `f.age()`            | `Age`                                         | `string`（ISO 8601）                                 |
| `f.option()`         | `Option`（Checkbox / Radiobutton / Dropdown） | `string[]`（選択された alias）                       |
| `f.user()`           | `User`                                        | `UserRef`（`P_Id` / `P_Type` / `P_Name` / `P_Mail`） |

宣言できるのは**実装済みのデータ系リソース**（`candidate` / `job` / `client` / `recruiter` /
`contact` / `process` / `resume`）です。マスタ系と Attachment はカスタム項目を持たないため受け付けません
（[ADR-0023][adr23] D6）。リソースが増えるとここも増えます（[ADR-0060][adr60]）。

> **System 系（`System[Id]` / `System[DateTime]` / `System[Reference]`）は宣言できません**。
> システムが管理する標準項目の領分なので、ビルダーに用意していません。
> `Image` / `Link` は現時点で未対応です（[PRD R-4][prd] で v1 未対応と明記）。

## テナントの項目を調べる

どんなカスタム項目があるかは **Field Read** で分かります。宣言を書く前の下調べに使ってください。

```ts
const fields = await t.field.searchAll({ resource: "candidate" });

for await (const f of fields) {
  console.log(f.P_Alias, f.P_Name, f.P_Type); // 例: U_score, 適性スコア, 3
}
```

`P_Type` は PORTERS の Field Type コードです（3 = Number、5/6/7 = Option、17 = User など。
対応は [Field Type / Data Type][fdt] を参照）。`active: 1` を渡すと**実際に使われている項目だけ**に絞れます。

## 検証されること

`defineFields` は**宣言の検証境界**です（[ADR-0023][adr23] D4）。次の 2 つを**同期的に**検査し、
違反すると `PortersConfigError` を投げます。

- **alias が `U_` / `A_` で始まること** — 標準項目（`P_`）は同梱済みなので宣言の対象外です。
- **リソース名が既知であること** — `candidate` / `job` / `client` / `recruiter` / `contact` / `process` / `resume` のみ。

```ts
defineFields({ candidate: (f) => ({ score: f.number() }) });
// PortersConfigError: custom field alias "score" on "candidate" must start with "U_" or "A_"
```

検証を通った宣言は**ブランド付き**になり、`PortersClient` は再検証しません。
なお `defineFields` は `Promise` を返さないため、**この 2 つだけは同期 throw** です
（`PortersClient` の構築も同様）。それ以外の公開メソッドは常に reject します（[ADR-0046][adr46]）。

## 値レベルの検証はしません

宣言は**型と変換**に効きますが、**値の妥当性**（桁数・必須・選択肢に存在するか等）は検査しません。
PORTERS 側の検証に委ねています。手前で厳しく弾くと、サーバーが受け付ける値をライブラリが
落としてしまう可能性があるためです（安全側ではなく危険側に倒れる）。

## 複数テナントで項目が違う場合

`defineFields` の結果は**クライアント単位**です。テナントごとにカスタム項目が違うなら、
**テナントごとに `PortersClient` を構築**してください。

```ts
const clientFor = (partition: number, fields: DefinedFields) =>
  new PortersClient({ host, appId, appSecret, partition, fields });
```

`porters.tenant(id)` は partition を差し替えるスコープで、**カタログは共有**します
（[マルチテナント ガイド][multi-tenancy]）。項目構成が同じテナント群には `tenant(id)`、
違うなら別クライアント、と使い分けます。

## 関連

- 決定: [ADR-0023][adr23]（宣言 DSL の詳細設計）／[ADR-0004][adr4]（型モデル）
- 型の由来: [ADR-0016][adr16]（Data Type の粒度）／[ADR-0017][adr17]（Option は常に `string[]`）
- 既定 field: [ADR-0020][adr20]／`field` の alias: [ADR-0059][adr59]
- API 事実: [Field Type / Data Type][fdt]

[adr4]: ../adr/0004-field-type-model.md
[adr16]: ../adr/0016-field-type-granularity.md
[adr17]: ../adr/0017-option-read-shape.md
[adr20]: ../adr/0020-read-field-default.md
[adr23]: ../adr/0023-custom-field-declaration-dsl.md
[adr46]: ../adr/0046-guard-error-contract.md
[adr59]: ../adr/0059-read-field-bare-alias.md
[adr60]: ../adr/0060-full-resource-coverage-direction.md
[fdt]: ../reference/resource-api/field-data-types.md
[multi-tenancy]: multi-tenancy.md
[prd]: ../design/requirements.md
