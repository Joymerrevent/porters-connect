# カスタム項目（`defineFields`）

PORTERS のテナントは、標準項目（`P_`）に加えて**テナント固有のカスタム項目**を持ちます。
ユーザーが作った項目は `U_[Name]`、アプリが作った項目は `A_[Name]` という alias になります。

カスタム項目は**テナントごとに違う**ので、ライブラリに同梱の静的な型には含められません。
代わりに、**利用側が `defineFields` で宣言する**と、その項目が読み書きの型に現れるようになります
（[ADR-0004][adr4] のハイブリッド方式／`defineFields` の詳細設計は [ADR-0023][adr23]）。

## 3 行で

```ts
import { PortersClient, defineFields } from "@joymerrevent/porters-connect";

const fields = defineFields({
  candidate: (f) => ({ U_score: f.number(), U_source: f.option() }),
});

const porters = new PortersClient({ hostname, appId, appSecret, fields });
const t = porters.tenant(partition);
```

これで `t.candidate` の読み書きに `U_score` / `U_source` が**型付きで**現れます。

<!-- doccheck: fields expect-error -->

```ts
const one = await t.candidate.get(10001);
one?.U_score; // number | null | undefined
one?.U_source; // string[] | null | undefined（Option は選択された alias の配列）

await t.candidate.update(10001, { U_score: 80 }); // 型チェックされる
await t.candidate.update(10001, { U_score: "80" }); // ← 型エラー
```

## 宣言しないとどうなるか

**型が受け付けません。** 宣言していないカスタム項目は、`field` / `condition` / `order` /
書き込みのどこに書いてもコンパイルエラーです。カスタム項目は**宣言してから使う** — 入口は
この 1 つです（[ADR-0074][adr74]）。

**実行時は変わりません。** 型を外せば送れますし（後述の逃げ道）、応答に知らない項目が混ざっても
落ちません。止めているのは型で、狙いは 2 つ — **値の変換を効かせること**と、**綴りを機械に
検査させること**です。

宣言の有無で何が変わるかを、実物が `Number` のカスタム項目 `U_score`（値は 80）で並べます。
読み取った 1 件を、下の表では `c` と呼びます。

<!-- doccheck: fields -->

```ts
const page = await t.candidate.search({ field: ["P_Name", "U_score"] });
const c = page.items[0]; // ← 表の `c`
```

### 読み取り

|     | 宣言しない                                                                                                                                                           | 宣言する                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 型  | **受け付けない。** `field: ["U_score"]` がコンパイルエラーになり、`c.U_score` も読めない                                                                             | **付く。** `field` に書けて、`c.U_score` が `number \| null \| undefined` になる    |
| 値  | cast で型を外して読むと、**文字列の `"80"`**。変換されないので、日時は `"2026/09/10 12:00:00"`（PORTERS の書式）のまま、`Option` / `User` / `Image` は `null` になる | **数値の `80`。** 日時は ISO 8601、`Option` は選択された alias の配列（`string[]`） |

### 書き込み

|     | 宣言しない                                                                                                                                       | 宣言する                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 型  | **受け付けない。** `t.candidate.update(10001, { U_score: 80 })` がコンパイルエラーになる                                                         | **付く。** `{ U_score: 80 }` が通り、`{ U_score: "80" }` は型エラーになる                                   |
| 値  | cast で型を外して送ると、**文字列にしてそのまま送られる**。ISO 8601 の日時は `2026-09-10` のまま送られ、配列は `"a,b"` という 1 本の文字列になる | **Data Type に合わせて変換して送る。** 日時は `2026/09/10` に、`Option` は子要素に、`Image` は 3 要素になる |

読み取りにはもう 1 つ、**そもそも要求されるかどうか**の差があります。宣言するとその項目が
`field` 省略時の既定に入り、何も書かなくても返ってきます（[ADR-0020][adr20]）。
**書き込みにこの差はありません** — `create` / `update` に書いた項目だけが送られるので、
宣言しても送られる項目は変わりません。

### 逃げ道 — 宣言せずに読み書きする

宣言していない項目に触る必要があるなら、**cast で型を外せば呼べます**。実行時は今までどおり通ります。

```ts
import { rawValue } from "@joymerrevent/porters-connect";
import type {
  CandidateSearchQuery,
  CandidateUpdateInput,
} from "@joymerrevent/porters-connect";

// 読み取り: field に入れるのは cast、受け取るのは rawValue
const page = await t.candidate.search({
  field: ["P_Name", "U_score"] as CandidateSearchQuery["field"],
});
const raw = rawValue(page.items[0], "U_score"); // "80"（文字列。変換されない）

// 書き込み: 入力の型を外す（日時や Option はこの形では壊れる）
await t.candidate.update(10001, { U_score: 80 } as CandidateUpdateInput);
```

`rawValue` は**レコードが持っているものをそのまま返します** — 応答に無ければ `undefined`、
入れ子（`Option` / `User` / `Image`）なら `null`、あれば生の文字列です。変換はしません。

**毎回こう書くくらいなら宣言してください。** 型を外すと、綴りの検査も値の変換も効きません。

**宣言しても必須項目は増えません。** `create` が必須にするのは各リソースの標準項目だけで
（Candidate なら `P_Owner`。一覧は[書き込みの制約][write-constraints]）、宣言したカスタム項目は
つねに任意です。ビルダーにも必須を宣言する手段はありません。

ただし **PORTERS 側では項目を入力必須に設定できます**。その状態は Field Read の `P_Required`
（`0` = 通常 / `1` = 入力必須）で読めますが、宣言には載らないので**型では止まらず、
PORTERS が弾きます**。必須で運用している項目があるなら、`t.field.of("candidate").search()`
で `P_Required` を見て、アプリ側で確かめてください。

入口はどれも同じ扱いです。`U_hiredOn` を宣言していなければ、**4 つとも型エラー**になります。

<!-- doccheck: expect-error -->

```ts
await t.candidate.search({ field: ["U_hiredOn"] }); // ← 型エラー
await t.candidate.search({ condition: { U_hiredOn: { ge: "2026-01-01" } } }); // ← 型エラー
await t.candidate.search({ order: [{ U_hiredOn: "desc" }] }); // ← 型エラー
await t.candidate.update(10001, { U_hiredOn: "2026-09-10" }); // ← 型エラー
```

綴り間違いも同じところで止まります。`U_hiredOn` を `U_hireOn` と書けば、宣言していても
コンパイルエラーです（[ADR-0059][adr59]）。

型を外したときは、**書き込みのほうが危ない**です。読み取りは変換されない文字列が来るだけですが、
書き込みはその値がそのまま PORTERS に届きます。受理されるかどうかは PORTERS 次第で、ライブラリは
検知しません。

宣言していないと **`U_` 以降の綴りも検査されません**。取得漏れを型で防ぎたい項目は、
ここで宣言してください（[ADR-0059][adr59]）。

## 宣言できる型

ビルダー `f` のメソッドが、そのまま Data Type に対応します。

| メソッド             | Data Type                                     | 読み取り値                                                      | 書き込み値                                           |
| -------------------- | --------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| `f.number()`         | `Number`（Currency 含む）                     | `number`                                                        | `number`                                             |
| `f.singlelineText()` | `SinglelineText`                              | `string`                                                        | `string`                                             |
| `f.multilineText()`  | `MultilineText`                               | `string`                                                        | `string`                                             |
| `f.mail()`           | `Mail`                                        | `string`                                                        | `string`                                             |
| `f.telephone()`      | `Telephone`                                   | `string`                                                        | `string`                                             |
| `f.url()`            | `URL`                                         | `string`                                                        | `string`                                             |
| `f.date()`           | `Date`                                        | `string`（ISO 8601）                                            | `string`（ISO 8601）                                 |
| `f.dateTime()`       | `DateTime`                                    | `string`（ISO 8601・UTC `…Z`）                                  | `string`（ISO 8601・UTC `…Z`）                       |
| `f.age()`            | `Age`                                         | `string`（ISO 8601）                                            | `string`（ISO 8601 の生年月日）                      |
| `f.option()`         | `Option`（Checkbox / Radiobutton / Dropdown） | `string[]`（選択された alias）                                  | `string[]`（選択する alias）                         |
| `f.user()`           | `User`                                        | `UserRef`（`P_Id` / `P_Type` / `P_Name` / `P_Mail`）            | `number`（ユーザーの ID だけ）                       |
| `f.image()`          | `Image`                                       | `{ FileName }`（`image` で選べば `ContentType` / `Content` も） | `{ FileName, ContentType, Content }`（3 つとも必須） |
| `f.link()`           | `Link`                                        | `number`（Contact の ID）／ `UserRef` ／ `DepartmentRef`        | `number`（参照先の ID だけ）                         |

**`User` / `Link` / `Image` は読み書きが対称ではありません**。読み取りは入れ子で返りますが、
書き込みは `User` / `Link` が ID ひとつだけ、`Image` は 3 要素そろって必要です
（日時は読み書きとも ISO 8601 で、PORTERS 形式との変換はライブラリがやります）。

宣言できるのは**実装済みのデータ系リソース**（`candidate` / `job` / `client` / `recruiter` /
`contact` / `opportunity` / `activity` / `contract` / `sales` / `process` / `resume`）です。マスタ系・Attachment・**Phase** はカスタム項目を持たないため受け付けません
（[ADR-0023][adr23] D6）。リソースが増えるとここも増えます（[ADR-0060][adr60]）。

> **System 系（`System[Id]` / `System[DateTime]` / `System[Reference]`）は宣言できません**。
> システムが管理する標準項目の領分なので、ビルダーに用意していません。

**`Image` と `Link` は、この宣言が唯一の入口です**（[ADR-0064][adr64]。[PRD R-4][prd] で
v1 未対応としていたものを実装しました）。標準項目にこの 2 型は 1 つもなく
（reference 全 17 リソースの Field Type 列で 0 件）、テナントが作った項目としてしか存在しません。
宣言しない限り、型にも読み取り結果にも現れません。

<!-- doccheck: fields -->

```ts
const fields = defineFields({
  resume: (f) => ({ U_photo: f.image(), U_contact: f.link() }),
});

const porters = new PortersClient({
  hostname: process.env.PORTERS_HOST ?? "",
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
  fields,
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

宣言と実物がずれると読み取りが壊れます。実物が Option の項目を `f.singlelineText()` と宣言すると、
読み取りは **`PortersResourceError`（`category: "validation"`）で落ちます** — 入れ子が来るはずの
ところにスカラが来た（またはその逆）は、宣言が違うことしか意味しないためです（[RV-36][rv36]）。

**落ちないずれ方もあります。** 形が同じスカラどうし（実物 `SinglelineText` を `f.number()` と
宣言した、など）は検知できず、`Number(値)` の結果＝**`NaN` が入ります**。`Link` は
形そのものが判別子なので検査対象外で、同じく `NaN` になります。

[ハマりどころ][gotchas]のとおり **Alias のズレは PORTERS の運用で起きます**（環境間のコピー・
項目の変更削除）。だから確かめる手段が要ります。

```ts
import { verifyFields, assertFieldsMatch } from "@joymerrevent/porters-connect";

const report = await verifyFields(porters.tenant(1), myFields);
if (!report.ok) logger.warn({ report }, "宣言がテナントと合っていません");
```

レポートは 5 つに分かれます。

| 区分           | 意味                                     | 深刻度                                      |
| -------------- | ---------------------------------------- | ------------------------------------------- |
| `typeMismatch` | 実在するが Data Type が違う              | **最悪**（読み取りが落ちるか `NaN` になる） |
| `missing`      | 宣言したがテナントに無い                 | 高                                          |
| `unverifiable` | そのリソースのカタログを**読めなかった** | 中（無いのか読めないのかは別）              |
| `undeclared`   | テナントにあるが宣言していない           | 低（素通しで動く＝現状どおり）              |
| `undeclarable` | 存在するが宣言では表せない               | 情報                                        |

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
for await (const f of t.field.of("candidate").searchAll()) {
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
// PortersConfigError: defineFields: custom field alias "score" on "candidate"
//   must start with "U_" or "A_" (standard P_ fields are built in)
```

検証を通った宣言は**ブランド付き**になり、`PortersClient` は再検証しません。
なお `defineFields` は `Promise` を返さないため、**この 2 つだけは同期 throw** です
（`PortersClient` の構築も同様）。それ以外の公開メソッドは常に reject します（[ADR-0046][adr46]）。

## どこまで検証するか

3 つに分かれます。

- **宣言と実データの食い違い**は、読み取り時に `validation` で surface します
  （[ADR-0006][adr6]／黙って `null` にしません）。事前に知りたいなら上記 `verifyFields` です。
- **日時の書式**は**読み書きとも**検査します。日時だけは**変換する**（ISO 8601 ⇄ PORTERS 形式）ので、
  変換できない値は送れず、読めもしないためです。他の型は変換が無いので検査しません — この非対称は
  意図したものです。
- **値の妥当性**（桁数・必須・選択肢に存在するか等）は検査せず、PORTERS 側に委ねます。
  手前で厳しく弾くと、サーバーが受け付ける値をライブラリが落としてしまう可能性があるためです
  （安全側ではなく危険側に倒れる）。

食い違いの検出は**形の違いだけ**に絞っています（スカラが来るべき所に入れ子、またはその逆）。
それより細かい違いは許容して `null` にします — 値が本当に無いこともあり、弾くと偽の警報になるためです。
**スカラどうしのずれは形では捕まらない**ので、`f.number()` と宣言した項目が実はテキストなら
`NaN` になります（気づけないのはここだけ＝`verifyFields` の出番）。
詳しくは[エラーハンドリング ガイド][error-handling]にあります（[RV-36][rv36] で実装済み）。

## 複数テナントで項目が違う場合

`defineFields` の結果は**クライアント単位**です。テナントごとにカスタム項目が違うなら、
**テナントごとに `PortersClient` を構築**してください。

```ts
const clientFor = (fields: DefinedFields) =>
  new PortersClient({ hostname, appId, appSecret, fields });

// partition は tenant(id) で束ねます（ADR-0055）
const t = clientFor(myFields).tenant(partition);
```

`porters.tenant(id)` は partition を差し替えるスコープで、**カタログは共有**します
（[マルチテナント ガイド][multi-tenancy]）。項目構成が同じテナント群には `tenant(id)`、
違うなら別クライアント、と使い分けます。

> [!NOTE]
> **client を分けてもスロットルは分かれません。** 1 分あたりの上限を自制するバケットは
> **ホストごと**だからです（[ADR-0073][adr73]）。テナントごとに client を立てても、合計は
> 上限に収まります。

## 宣言したクライアントを関数に渡す

アプリが育つと、クライアントや `tenant(id)` のスコープを**引数に取る関数**を切り出したくなります。
そのとき型をどう書くかで、**カスタム項目が残るかどうか**が変わります。

```ts
import { defineFields, PortersClient } from "@joymerrevent/porters-connect";
import type {
  DeclaredCatalogs,
  TenantScope,
} from "@joymerrevent/porters-connect";

const fields = defineFields({
  candidate: (f) => ({ U_score: f.number() }),
});

const porters = new PortersClient({
  hostname: process.env.PORTERS_HOST ?? "",
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
  fields,
});

// (1) 自分の宣言で受ける — カスタム項目が型付きのまま
const topScorers = async (t: TenantScope<typeof fields>) => {
  const page = await t.candidate.search({ field: ["P_Name", "U_score"] });
  return page.items.filter((c) => (c.U_score ?? 0) > 80);
};

// (2) どの宣言のクライアントでも受ける
const listPartitions = (client: PortersClient<DeclaredCatalogs>) =>
  client.partition.search();

// 呼ぶ側
const t = porters.tenant(123);
for (const c of await topScorers(t)) {
  console.log(c.P_Name, c.U_score); // string | null | undefined / number | null | undefined
}

const partitions = await listPartitions(porters);
console.log(partitions.items.map((p) => p.P_Name));
```

**(2) はカスタム項目が返り値の型に出ません。** `DeclaredCatalogs` は「何か宣言されているかも
しれない」としか言っていないので、読み取り結果は標準項目（`P_`）だけになります。`field` に
書くことはできる（`U_` / `A_` で始まる alias は常に要求できます）のに、受け取る側で型が
付かない、という形です。

<!-- doccheck: expect-error -->

```ts
import type {
  DeclaredCatalogs,
  TenantScope,
} from "@joymerrevent/porters-connect";

const wide = async (t: TenantScope<DeclaredCatalogs>) => {
  const page = await t.candidate.search({ field: ["U_score"] }); // 要求はできる
  return page.items[0]?.U_score; // ✗ 型エラー：宣言が分からないので型には出ない
};
```

使い分けはこうなります。

| 書き方                          | 受けられるクライアント | カスタム項目の型      |
| ------------------------------- | ---------------------- | --------------------- |
| `TenantScope<typeof fields>`    | その宣言のものだけ     | **付く**              |
| `TenantScope<DeclaredCatalogs>` | どれでも               | 付かない（`P_` のみ） |

**カスタム項目を触る関数は (1)、触らない共通処理は (2)** です。1 リソース分のカタログだけ
取り出したいときは `CustomFor<typeof fields, "candidate">` が使えます（名前の一覧は
`CustomFieldResource`）。

`typeof porters` で書く手もありますが、**値が先に無いと書けません**。関数を別ファイルに
切り出すなら、上の型名で書くほうが素直です。

### 宣言が違うクライアントは渡せません

`TenantScope<typeof fields>` は**その宣言のスコープだけ**を受け取ります。`U_score` を宣言して
いないクライアントの `tenant()` を渡すと型エラーです。

<!-- doccheck: expect-error -->

```ts
import { defineFields, PortersClient } from "@joymerrevent/porters-connect";
import type { TenantScope } from "@joymerrevent/porters-connect";

const fields = defineFields({ candidate: (f) => ({ U_score: f.number() }) });
const other = defineFields({
  candidate: (f) => ({ U_memo: f.singlelineText() }),
});

const topScorers = async (t: TenantScope<typeof fields>) => {
  const page = await t.candidate.search({ field: ["U_score"] });
  return page.items[0]?.U_score;
};

const porters = new PortersClient({
  hostname,
  appId,
  appSecret,
  fields: other,
});
void topScorers(porters.tenant(1)); // ✗ 型エラー：U_score を宣言していない
```

カタログの alias が `field` / `condition` / `order` / 書き込みの型を決めているので、**項目が違えば
スコープの型も違います**（[ADR-0074][adr74] D1）。(2) の `TenantScope<DeclaredCatalogs>` が
どの宣言でも受け取れるのは、そちらが「何か宣言されているかもしれない」＝**広いカタログ**だから
です。狭いものは広いほうへ渡せる、という向きだけが通ります。

それでも**宣言はプロジェクトに 1 か所置いて export する**のが素直です
（`generateFieldDecls` の出力先がその置き場になります）。宣言が複数要るなら、クライアントと
それを受ける関数を同じモジュールに閉じます。

### 設定を切り出すときも同じ

構築オプションの型は `PortersClientOptions` です。これも型引数を取るので、**宣言つきの設定を
関数や別ファイルに切り出すなら、型引数も渡します**。

```ts
import type { PortersClientOptions } from "@joymerrevent/porters-connect";

const fields = defineFields({
  candidate: (f) => ({ U_score: f.number() }),
});

const options: PortersClientOptions<typeof fields> = {
  hostname: process.env.PORTERS_HOST ?? "",
  appId: process.env.PORTERS_APP_ID ?? "",
  appSecret: process.env.PORTERS_APP_SECRET ?? "",
  fields,
};

const porters = new PortersClient(options);
```

型引数を省いて `PortersClientOptions` とだけ書いても**代入は通ります**（`fields` は受け取れます）。
落ちるのはそのあとで、**作ったクライアントからカスタム項目が消えます** — 注釈が
`EmptyCatalog` に固定するためです。

<!-- doccheck: expect-error -->

```ts
import type { PortersClientOptions } from "@joymerrevent/porters-connect";

const fields = defineFields({
  candidate: (f) => ({ U_score: f.number() }),
});

const bare: PortersClientOptions = {
  hostname: "xxxxx.example.com",
  appId: "a",
  appSecret: "s",
  fields, // 代入は通る
};

const score = async () => {
  const page = await new PortersClient(bare)
    .tenant(1)
    .candidate.search({ field: ["U_score"] });
  return page.items[0]?.U_score; // ✗ 型引数を省いたので、型からは消えている
};
```

## 関連

- 決定: [ADR-0023][adr23]（`defineFields` の詳細設計）／[ADR-0004][adr4]（型モデル）
- 型の由来: [ADR-0016][adr16]（Data Type の粒度）／[ADR-0017][adr17]（Option は常に `string[]`）
- 既定 field: [ADR-0020][adr20]／`field` の alias: [ADR-0059][adr59]
- API 事実: [Field Type / Data Type][fdt]
- ほかの目的から探す: [目次][index]

[adr4]: ../../adr/0004-field-type-model.md
[adr74]: ../../adr/0074-custom-field-declaration-required.md
[adr16]: ../../adr/0016-field-type-granularity.md
[adr17]: ../../adr/0017-option-read-shape.md
[adr20]: ../../adr/0020-read-field-default.md
[adr23]: ../../adr/0023-custom-field-declaration-dsl.md
[adr46]: ../../adr/0046-guard-error-contract.md
[adr59]: ../../adr/0059-read-field-bare-alias.md
[adr60]: ../../adr/0060-full-resource-coverage-direction.md
[adr64]: ../../adr/0064-link-image-types.md
[adr69]: ../../adr/0069-tenant-field-catalog-tooling.md
[adr6]: ../../adr/0006-error-model.md
[rv36]: ../../reviews/rv/0036-write-value-validation-partial.md
[error-handling]: handle-failures.md
[fdt]: ../reference/resource-api/field-data-types.md
[multi-tenancy]: multi-tenant.md
[write-constraints]: ../concepts/limits.md
[prd]: ../../design/requirements.md
[index]: ../index.md
[gotchas]: ../reference/gotchas.md
[adr73]: ../../adr/0073-throttle-sharing.md
