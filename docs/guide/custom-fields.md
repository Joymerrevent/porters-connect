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

| メソッド             | Data Type                                     | 読み取り値                                                      |
| -------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| `f.number()`         | `Number`（Currency 含む）                     | `number`                                                        |
| `f.singlelineText()` | `SinglelineText`                              | `string`                                                        |
| `f.multilineText()`  | `MultilineText`                               | `string`                                                        |
| `f.mail()`           | `Mail`                                        | `string`                                                        |
| `f.telephone()`      | `Telephone`                                   | `string`                                                        |
| `f.url()`            | `URL`                                         | `string`                                                        |
| `f.date()`           | `Date`                                        | `string`（ISO 8601）                                            |
| `f.dateTime()`       | `DateTime`                                    | `string`（ISO 8601・UTC `…Z`）                                  |
| `f.age()`            | `Age`                                         | `string`（ISO 8601）                                            |
| `f.option()`         | `Option`（Checkbox / Radiobutton / Dropdown） | `string[]`（選択された alias）                                  |
| `f.user()`           | `User`                                        | `UserRef`（`P_Id` / `P_Type` / `P_Name` / `P_Mail`）            |
| `f.image()`          | `Image`                                       | `{ FileName }`（`image` で選べば `ContentType` / `Content` も） |
| `f.link()`           | `Link`                                        | `number`（Contact の ID）／ `UserRef` ／ `DepartmentRef`        |

宣言できるのは**実装済みのデータ系リソース**（`candidate` / `job` / `client` / `recruiter` /
`contact` / `opportunity` / `activity` / `contract` / `sales` / `process` / `resume`）です。マスタ系・Attachment・**Phase** はカスタム項目を持たないため受け付けません
（[ADR-0023][adr23] D6）。リソースが増えるとここも増えます（[ADR-0060][adr60]）。

> **System 系（`System[Id]` / `System[DateTime]` / `System[Reference]`）は宣言できません**。
> システムが管理する標準項目の領分なので、ビルダーに用意していません。

**`Image` と `Link` は、この宣言が唯一の入口です**（[ADR-0064][adr64]。[PRD R-4][prd] で
v1 未対応としていたものを実装しました）。標準項目にこの 2 型は 1 つもなく
（reference 全 17 リソースの Field Type 列で 0 件）、テナントが作った項目としてしか存在しません。
宣言しない限り、型にも読み取り結果にも現れません。

```ts
const fields = defineFields({
  resume: (f) => ({ U_photo: f.image(), U_contact: f.link() }),
});

// Read: 既定は FileName だけ。中身は image で明示的に取りに行きます。
const r = await porters.tenant(1).resume.get(id, {
  image: { U_photo: ["FileName", "Content"] },
});
r?.U_photo; // { FileName: string | null; Content: string | null }

// Link は形で判別します（テナントの設定次第で 3 通り）。
const link = r?.U_contact;
if (typeof link === "number") {
  // Contact の ID。名前などは Contact API で別途取得します
} else if (link && "P_Mail" in link) {
  // ユーザー型（UserRef）
}

// Write: Image は 3 つとも必須、Link は ID のみ。
await porters.tenant(1).resume.update(id, {
  U_photo: { FileName: "photo.png", ContentType: "image/png", Content: base64 },
  U_contact: 10001,
});
```

画像の上限（2MB / 255 バイト / mime 4 種）と、**一括書き込みでは画像を送れない**ことは
[書き込みの制約ガイド][write-constraints]にまとめています。

## 宣言を自動生成する

テナントの項目を調べて手で書き写す必要はありません。**`generateFieldDecls`** が Field Read を読んで
`defineFields` の呼び出しをそのまま出力します（[ADR-0069][adr69]）。

```ts
import { generateFieldDecls } from "@joymerrevent/porters-connect";
import { writeFile } from "node:fs/promises";

const src = await generateFieldDecls(porters.tenant(1), ["candidate", "job"]);
await writeFile("src/porters-fields.ts", src);
```

出てくるのはソース文字列です（ライブラリはファイルを書きません）。中身はこうなります:

```ts
export const myFields = defineFields({
  candidate: (f) => ({
    U_score: f.number(),
    U_source: f.option(),
  }),
  job: (f) => ({
    U_headcount: f.number(),
  }),
});
```

- **既定は「使用中の項目だけ」**（Field Read の `active: 1`）。未使用の項目まで宣言する理由は
  ふつうありません。全部欲しければ `{ active: -1 }` を渡します。
- **項目の日本語名は既定で出しません**（`{ includeNames: true }` で `// 適性スコア` が付きます）。
  生成物はリポジトリにコミットされることが多く、テナントの業務語彙が混ざるのは既定にしたくないためです。
- **ライブラリが宣言できない型はコメントで残ります**（消しません）。「テナントに無い」と
  読み違えないようにするためです。

宣言を作る前に中身だけ見たいときは、`readCustomCatalog` が「alias → Data Type」を返します。

```ts
const catalog = await readCustomCatalog(porters.tenant(1), "candidate");
catalog.fields; // { U_score: "Number", U_source: "Option" }
catalog.undeclarable; // 宣言では表せない項目（理由つき）
```

## 宣言がテナントと合っているか確かめる

宣言と実物がずれると**黙って壊れます**。実物が Option の項目を `f.singlelineText()` と宣言すると、
読み取りは例外も警告も出さずに `null` を返し、「その項目は空だった」と区別が付きません。
`docs/reference/gotchas.md` のとおり **Alias のズレは PORTERS の運用で起きます**（環境間のコピー・
項目の変更削除）。だから確かめる手段が要ります。

```ts
import { verifyFields, assertFieldsMatch } from "@joymerrevent/porters-connect";

const report = await verifyFields(porters.tenant(1), myFields);
if (!report.ok) logger.warn({ report }, "宣言がテナントと合っていません");
```

レポートは 5 つに分かれます。

| 区分           | 意味                                     | 深刻度                             |
| -------------- | ---------------------------------------- | ---------------------------------- |
| `typeMismatch` | 実在するが Data Type が違う              | **最悪**（黙って `null` になる側） |
| `missing`      | 宣言したがテナントに無い                 | 高                                 |
| `unverifiable` | そのリソースのカタログを**読めなかった** | 中（無いのか読めないのかは別）     |
| `undeclared`   | テナントにあるが宣言していない           | 低（素通しで動く＝現状どおり）     |
| `undeclarable` | 存在するが宣言では表せない               | 情報                               |

**`verifyFields` は投げません。** テナント管理者が項目を 1 つ改名しただけでアプリが起動しなくなるのは
安全側ではないので、落とすかどうかは利用側が決めます。起動時に落としたいなら 1 行足します。

```ts
assertFieldsMatch(await verifyFields(porters.tenant(1), myFields));
// PortersConfigError: verifyFields: declarations do not match the tenant
//   candidate.U_source: declared SinglelineText, tenant has Option
```

`assertFieldsMatch` は **`unverifiable` でも投げます**。「確かめられなかった」は「問題なし」ではない
ためです（`field_r` スコープが要ります）。`undeclared` / `undeclarable` では投げません。

> **どれも opt-in です。** `defineFields` 自体は PORTERS を呼びません。この 3 つは呼んだときだけ
> Field Read を叩きます（`field_r` スコープが必要）。CI や起動時フックに置く使い方を想定しています。

### 素の Field Read を使う

生の項目定義が見たいときは `t.field` がそのまま使えます。

```ts
for await (const f of t.field.searchAll({ resource: "candidate" })) {
  console.log(f.P_Alias, f.P_Name, f.P_Type); // 例: Person.U_score, 適性スコア, 3
}
```

`P_Type` は PORTERS の Field Type コードです（3 = Number、5/6/7 = Option、17 = User など。
対応は [Field Type / Data Type][fdt] を参照）。上の 3 つの関数はこの変換を代わりにやっています。

## 検証されること

`defineFields` は**宣言の検証境界**です（[ADR-0023][adr23] D4）。次の 2 つを**同期的に**検査し、
違反すると `PortersConfigError` を投げます。

- **alias が `U_` / `A_` で始まること** — 標準項目（`P_`）は同梱済みなので宣言の対象外です。
- **リソース名が既知であること** — `candidate` / `job` / `client` / `recruiter` / `contact` / `opportunity` / `activity` / `contract` / `sales` / `process` / `resume` のみ。

```ts
defineFields({ candidate: (f) => ({ score: f.number() }) });
// PortersConfigError: custom field alias "score" on "candidate" must start with "U_" or "A_"
```

検証を通った宣言は**ブランド付き**になり、`PortersClient` は再検証しません。
なお `defineFields` は `Promise` を返さないため、**この 2 つだけは同期 throw** です
（`PortersClient` の構築も同様）。それ以外の公開メソッドは常に reject します（[ADR-0046][adr46]）。

## どこまで検証するか

3 つに分かれます。

- **宣言と実データの食い違い**は、読み取り時に `validation` で surface します
  （[ADR-0006][adr6]／黙って `null` にしません）。事前に知りたいなら上記 `verifyFields` です。
- **日時の書式**は書き込み時に検査します。日時だけは**変換する**（ISO 8601 ⇄ PORTERS 形式）ので、
  変換できない値は送れないためです。他の型は変換が無いので検査しません — この非対称は意図したものです。
- **値の妥当性**（桁数・必須・選択肢に存在するか等）は検査せず、PORTERS 側に委ねます。
  手前で厳しく弾くと、サーバーが受け付ける値をライブラリが落としてしまう可能性があるためです
  （安全側ではなく危険側に倒れる）。

> **注意（未処置）**: 現在の実装はこのうち 1 つ目に従っていません。食い違いは `validation` ではなく
> 黙って `null` になり、日時の変換失敗は `PortersError` ではない素の `RangeError` が飛びます。
> [RV-36][rv36] として起票済みで、方針は確定・実装待ちです。

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
[adr64]: ../adr/0064-link-image-types.md
[adr69]: ../adr/0069-tenant-field-catalog-tooling.md
[adr6]: ../adr/0006-error-model.md
[rv36]: ../reviews/rv/0036-write-value-validation-partial.md
[fdt]: ../reference/resource-api/field-data-types.md
[multi-tenancy]: multi-tenancy.md
[write-constraints]: write-constraints.md
[prd]: ../design/requirements.md
