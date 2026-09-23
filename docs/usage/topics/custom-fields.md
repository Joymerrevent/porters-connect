# カスタム項目（`defineFields`）

テナント固有のカスタム項目（`U_` / `A_`）を型付きで読み書きしたいときに読むページです。`defineFields` での
宣言のしかた、宣言を自動生成する方法、宣言がテナントの実際の項目と合っているかを確かめる方法が分かります。

## まず知ること

- **カスタム項目はテナントごとに違う**ので、ライブラリがあらかじめ持っている型には含められません。**利用側が `defineFields` で
  宣言する**と、その項目が読み書きの型に現れます<!-- 根拠: ADR-0004（ハイブリッド方式）・ADR-0023（`defineFields` の詳細設計） -->。
- **宣言は `tenant(id, { fields })` で Partition と一緒に渡します。**
- **宣言していないカスタム項目は型が受け付けません**（コンパイルエラー）。宣言せずに使う方法は別にあります。
- **宣言はテナントの実際の項目と突き合わせられます。** `generateFieldDecls` で自動生成し、`verifyFields` で食い違いを見つけます。
- **テナントが必須にした項目の欠落は型では止まりません。** 必須かどうかは PORTERS 側の設定（`P_Required`）です。

## 最小の例

```ts
import { PortersClient, defineFields } from "@joymerrevent/porters-connect";

const fields = defineFields({
  candidate: (f) => ({ U_score: f.number(), U_source: f.option() }),
});

const porters = new PortersClient({ hostname, appId, appSecret });
const t = porters.tenant(partition, { fields }); // 宣言は partition と一緒に渡す
```

これで `t.candidate` の読み書きに `U_score` / `U_source` が**型付きで**現れます。

宣言を渡す先が `tenant()` なのは、カスタム項目が **partition（Company DB）ごとのもの**だからです
（出典の各リソース記事が `U_` / `A_` を「テナント毎に異なる」としています）<!-- 根拠: ADR-0087 -->。
partition を指定する場所で、その partition の項目の形も決めます。

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
書き込みのどこに書いてもコンパイルエラーです。カスタム項目は**宣言してから使います**。宣言以外に、型付きで使う方法はありません<!-- 根拠: ADR-0074 -->。

**実行時は変わりません。** 型を外せば送れますし（後述の「宣言せずに読み書きする方法」）、応答に知らない項目が混ざっても
エラーにはなりません。止めているのは型で、目的は 2 つ — **値を変換すること**と、**綴りをコンパイラに
検査させること**です。

宣言の有無で何が変わるかを、実際は `Number` のカスタム項目 `U_score`（値は 80）で並べます。
読み取った 1 件を、下の表では `c` と呼びます。「宣言しない」列の値は、後述の「宣言せずに読み書きする方法」で
型を外して読み書きしたときのものです。宣言しないと型では使えないので、そのままでは値も読めません。

<!-- doccheck: fields -->

```ts
const page = await t.candidate.search({ field: ["P_Name", "U_score"] });
const c = page.items[0]; // ← 表の `c`
```

### 読み取り

宣言の有無で、読んだ値の型と実際の値がこう変わります。

|     | 宣言しない                                                                                                                                                                | 宣言する                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 型  | **使えない。** `field: ["U_score"]` がコンパイルエラーになり、`c.U_score` も読めない                                                                                      | **使える。** `field` に書けて、`c.U_score` が `number \| null \| undefined` として読める |
| 値  | 後述の方法で型を外して読むと、**文字列の `"80"`**。変換されないので、日時は `"2026/09/10 12:00:00"`（PORTERS の書式）のまま、`Option` / `User` / `Image` は `null` になる | **数値の `80`。** 日時は ISO 8601、`Option` は選択された alias の配列（`string[]`）      |

### 書き込み

書くときも同じです。宣言が無いと、変換されずにそのまま送られます。

|     | 宣言しない                                                                                                                                            | 宣言する                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 型  | **使えない。** `t.candidate.update(10001, { U_score: 80 })` がコンパイルエラーになる                                                                  | **使える。** `{ U_score: 80 }` が通り、`{ U_score: "80" }` は型エラーになる                                 |
| 値  | 後述の方法で型を外して送ると、**文字列にしてそのまま送られる**。ISO 8601 の日時は `2026-09-10` のまま送られ、配列は `"a,b"` という 1 本の文字列になる | **Data Type に合わせて変換して送る。** 日時は `2026/09/10` に、`Option` は子要素に、`Image` は 3 要素になる |

読み取りにはもう 1 つ、**そもそも要求されるかどうか**の差があります。宣言するとその項目が
`field` 省略時の既定に入り、何も書かなくても返ってきます<!-- 根拠: ADR-0020 -->。
**書き込みにこの差はありません** — `create` / `update` に書いた項目だけが送られるので、
宣言しても送られる項目は変わりません。

### 宣言せずに読み書きする方法

宣言していない項目を使う必要があるなら、**cast（`as`）で型を外せば呼べます**。実行時はそのまま通ります。

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

**毎回こう書くくらいなら宣言してください。** 型を外すと、綴りの検査も値の変換も行われません。

**宣言しても必須項目は増えません。** `create` が必須にするのは各リソースの標準項目だけで
（Candidate なら `P_Owner`。一覧は[書き込みの制約][write-constraints]）、宣言したカスタム項目は
つねに任意です。ビルダーにも必須を宣言する手段はありません。

ただし **PORTERS 側では項目を入力必須に設定できます**。その状態は Field Read の `P_Required`
（`0` = 通常 / `1` = 入力必須）で読めますが、宣言には載らないので**型では止まらず、
PORTERS が弾きます**。必須で運用している項目があるなら、`t.field.of("candidate").search()`
で `P_Required` を見て、アプリ側で確かめてください。

`field` / `condition` / `order` / 書き込みのどこに書いても同じ扱いです。`U_hiredOn` を宣言していなければ、**4 つとも型エラー**になります。

<!-- doccheck: expect-error -->

```ts
await t.candidate.search({ field: ["U_hiredOn"] }); // ← 型エラー
await t.candidate.search({ condition: { U_hiredOn: { ge: "2026-01-01" } } }); // ← 型エラー
await t.candidate.search({ order: [{ U_hiredOn: "desc" }] }); // ← 型エラー
await t.candidate.update(10001, { U_hiredOn: "2026-09-10" }); // ← 型エラー
```

綴り間違いも同じところで止まります。`U_hiredOn` を `U_hireOn` と書けば、宣言していても
コンパイルエラーです<!-- 根拠: ADR-0059 -->。

型を外したときは、**書き込みのほうが危ない**です。読み取りは変換されない文字列が来るだけですが、
書き込みはその値がそのまま PORTERS に届きます。受理されるかどうかは PORTERS 次第で、ライブラリは
検知しません。

宣言していないと **`U_` 以降の綴りも検査されません**。取得漏れを型で防ぎたい項目は、
ここで宣言してください<!-- 根拠: ADR-0059 -->。

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
`contact` / `opportunity` / `activity` / `contract` / `sales` / `process` / `resume`）です。マスタ系・Attachment・**Phase** はカスタム項目を持たないため受け付けません<!-- 根拠: ADR-0023 D6 -->。
リソースが増えるとここも増えます<!-- 根拠: ADR-0060 -->。

> **System 系（`System[Id]` / `System[DateTime]` / `System[Reference]`）は宣言できません**。
> システムが管理する標準項目にしか無いので、ビルダーに用意していません。
>
> **時分型（PORTERS 9.3.0）も `f.dateTime()` で宣言します。** 専用のメソッドはありません — API 上は
> 年月日時分型と同じ Field Type 12 で、ライブラリは Field Read からも区別できないためです。
> 値は ISO のまま読み書きし、時刻（`"09:00"` / `"26:00"`）との変換は `decodeTimeOfDay` /
> `encodeTimeOfDay` で行います（[日時と時分型][datetime] の「時分型」節）<!-- 根拠: ADR-0086 -->。

**`Image` と `Link` の項目は、宣言しないと使えません**<!-- 根拠: ADR-0064・PRD R-4（v1 で未対応としていたものを実装） -->。標準項目にこの 2 型は 1 つもなく
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
});
const t = porters.tenant(1, { fields });

// Read: 既定は FileName だけ。中身は image で明示的に取りに行きます。
const r = await t.resume.get(id, {
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
await t.resume.update(id, {
  U_photo: { FileName: "photo.png", ContentType: "image/png", Content: base64 },
  U_contact: 10001,
});
```

画像の上限（2MB / 255 バイト / ContentType は jpeg・gif・png・bmp の 4 種）と、**一括書き込みでは画像を送れない**ことは
[書き込みの制約ガイド][write-constraints]にまとめています。

## 宣言を自動生成する

テナントの項目を調べて手で書き写す必要はありません。**`generateFieldDecls`** が Field Read を読んで
`defineFields` の呼び出しをそのまま出力します<!-- 根拠: ADR-0069 -->。

```ts
import { generateFieldDecls } from "@joymerrevent/porters-connect";
import { writeFile } from "node:fs/promises";

const src = await generateFieldDecls(porters.tenant(1), ["candidate", "job"]);
await writeFile("src/porters-fields.ts", src);
```

出力は TypeScript のソースコードの文字列です（ライブラリはファイルを書きません）。中身はこうなります:

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

できた `myFields` は、そのテナントのスコープに渡します — `porters.tenant(1, { fields: myFields })`。

- **既定は「使用中の項目だけ」**（Field Read の `active: 1`）。未使用の項目まで宣言する理由は
  ふつうありません。全部欲しければ `{ active: -1 }` を渡します。
- **項目の日本語名は既定で出しません**（`{ includeNames: true }` で `// 適性スコア` が付きます）。
  生成物はリポジトリにコミットされることが多く、テナントの業務上の項目名が混ざるのは既定にしたくないためです。
- **ライブラリが宣言できない型はコメントで残ります**（消しません）。「テナントに無い」と
  読み違えないようにするためです。
- **Field Type 12 の行には注記が付きます**（`f.dateTime(), // FT-12: …`）。時分型は年月日時分型と
  同じ `12` で、Field Read からは区別できないためです。その項目が時刻だけを持つなら、読み書きで
  `decodeTimeOfDay` / `encodeTimeOfDay` を当ててください（[日時と時分型][datetime]）。

宣言を作る前に中身だけ見たいときは、`readCustomCatalog` が「alias → Data Type」を返します。

```ts
const catalog = await readCustomCatalog(porters.tenant(1), "candidate");
catalog.fields; // { U_score: "Number", U_source: "Option" }
catalog.undeclarable; // 宣言では表せない項目（理由つき）
```

## 宣言がテナントと合っているか確かめる

宣言と実際の項目がずれると読み取りが壊れます。実際は Option の項目を `f.singlelineText()` と宣言すると、
読み取りは **`PortersResourceError`（`category: "validation"`）になります** — 入れ子が来るはずの
ところに単一の値が来た（またはその逆）は、宣言が違うことしか意味しないためです<!-- 根拠: RV-36 -->。

テキストの項目を `f.number()` や `f.date()` と宣言した場合もエラーになります — 数値・日時に**読めない値**は
変換できないためです（`Link` の単一の値の形＝Contact の ID も同じ）<!-- 根拠: RV-36・RV-58 -->。

**エラーにならないずれ方もあります。** 形が同じ単一の値どうしで変換を伴わない組み合わせ（実際は `Number` の項目を
`f.singlelineText()` と宣言した、など）は検知できず、値が**文字列のまま**入ります（`"123"`）。

[ハマりどころ][gotchas]のとおり **Alias のズレは PORTERS の運用で起きます**（環境間のコピー・
項目の変更削除）。だから確かめる手段が要ります。

```ts
import { verifyFields, assertFieldsMatch } from "@joymerrevent/porters-connect";

const report = await verifyFields(porters.tenant(1), myFields);
if (!report.ok) logger.warn({ report }, "宣言がテナントと合っていません");
```

レポートは 5 つに分かれます。

| 区分           | 意味                                                  | 深刻度                                                 |
| -------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| `typeMismatch` | 実在するが Data Type が違う                           | **最悪**（読み取りがエラーになるか、型が違う値が入る） |
| `missing`      | 宣言したがテナントに無い                              | 高                                                     |
| `unverifiable` | そのリソースの項目定義を PORTERS から**読めなかった** | 中（無いのか読めないのかは別）                         |
| `undeclared`   | テナントにあるが宣言していない                        | 低（そのまま動く＝現状どおり）                         |
| `undeclarable` | 存在するが宣言では表せない                            | 情報                                                   |

**`verifyFields` は例外を投げません。** テナント管理者が項目を 1 つ改名しただけでアプリが起動しなくなるのは
安全側ではないので、止めるかどうかは利用側が決めます。起動時に止めたいなら 1 行足します。

```ts
assertFieldsMatch(await verifyFields(porters.tenant(1), myFields));
// PortersConfigError: verifyFields: declarations do not match the tenant
//   candidate.U_source: declared SinglelineText, tenant has Option
```

`assertFieldsMatch` は **`unverifiable` でも例外を投げます**。「確かめられなかった」は「問題なし」ではない
ためです（`field_r` スコープが要ります）。`undeclared` / `undeclarable` では例外を投げません。

> **どれも、呼んだときだけ動きます。** `defineFields` 自体は PORTERS を呼びません。`generateFieldDecls` / `verifyFields` / `assertFieldsMatch` の 3 つは、呼んだときだけ
> Field Read を呼びます（`field_r` スコープが必要）。CI や起動時フックに置く使い方を想定しています。

### Field Read をそのまま使う

生の項目定義が見たいときは `t.field` がそのまま使えます。

```ts
for await (const f of t.field.of("candidate").searchAll()) {
  console.log(f.P_Alias, f.P_Name, f.P_Type); // 例: Person.U_score, 適性スコア, 3
}
```

`P_Type` は PORTERS の Field Type コードです（3 = Number、5/6/7 = Option、17 = User など。
対応は [Field Type / Data Type][fdt] を参照）。`generateFieldDecls` / `verifyFields` / `assertFieldsMatch` は、この変換を代わりに行います。

## 検証されること

`defineFields` は、次の 2 つを**呼んだその場で**検査し、違反すると `PortersConfigError` を投げます<!-- 根拠: ADR-0023 D4 -->。

- **alias が `U_` / `A_` で始まること** — 標準項目（`P_`）はライブラリがあらかじめ型を持っているので、宣言の対象外です。
- **リソース名が既知であること** — `candidate` / `job` / `client` / `recruiter` / `contact` / `opportunity` / `activity` / `contract` / `sales` / `process` / `resume` のみ。

```ts
defineFields({ candidate: (f) => ({ score: f.number() }) });
// PortersConfigError: defineFields: custom field alias "score" on "candidate"
//   must start with "U_" or "A_" (standard P_ fields are built in)
```

検証を通った宣言は、`tenant()` で再検証されません。
なお `defineFields` は `Promise` を返さないため、**この 2 つの検査だけは同期 throw** です
（`PortersClient` の構築も同様）。それ以外の公開メソッドは常に reject します<!-- 根拠: ADR-0046 -->。

## どこまで検証するか

3 つに分かれます。

- **宣言と実データの食い違い**は、読み取り時に `validation` のエラーとして返します
  （黙って `null` にしません）<!-- 根拠: ADR-0006 -->。事前に知りたいなら上記 `verifyFields` です。
- **変換を伴う値**は検査します。日時（ISO 8601 ⇄ PORTERS 形式）は**読み書きとも**、数値（文字列 →
  `number`）は**読み取りで**。変換できない値は送れず、読めもしないためです。他の型は変換が無いので
  検査しません。この差は意図したものです。
- **値の妥当性**（桁数・必須・選択肢に存在するか等）は検査せず、PORTERS 側に委ねます。
  送る前の検査を厳しくしすぎると、サーバーが受け付ける値をライブラリが弾いてしまう可能性があるためです
  （安全側ではなく危険側に倒れる）。

**`verifyFields` は時分型を見分けません。** 時分型も年月日時分型も Field Type は `12` なので、
`f.dateTime()` と宣言してあれば一致と判定します（それで正しい — 宣言はどちらも `dateTime()` です）。
どの項目が時分型かは管理者に確かめ、読み書きのところで `decodeTimeOfDay` / `encodeTimeOfDay` を
当ててください（[日時と時分型][datetime]）。

食い違いの検出は**形の違い**（単一の値が来るべき所に入れ子、またはその逆）と、**変換できない値**
（日時・数値に読めない文字列）に絞っています。それより細かい違い（入れ子の中の想定外のタグなど）は
許容して `null` にします — 値が本当に無いこともあり、弾くと偽の警報になるためです。
**変換を伴わない単一の値どうしのずれ**（`Number` の項目を `f.singlelineText()` と宣言した、など）は
検出されず、文字列のまま入ります（気づけないのはここだけなので、`verifyFields` で確かめます）。
詳しくは[エラーと再試行][error-handling]にあります<!-- 根拠: RV-36 -->。

## テナントごとに宣言を渡す

宣言は **`tenant()` ごと**に渡します<!-- 根拠: ADR-0087 -->。カスタム項目は partition（Company DB）
ごとのものなので、partition を指定する呼び出しが、その partition の項目の形も決めます。
別のテナントの宣言が気づかないうちに適用される、という状態はありません — `{ fields }` を渡し忘れたスコープで
`U_` の項目を使えば、コンパイルエラーです。

```ts
import type { PartitionId } from "@joymerrevent/porters-connect";

// SaaS: partition ↔ 宣言の対応は自分の DB から引く（ライブラリの責務ではありません）
const t = porters.tenant(partition, { fields: fieldsFor(partition) });

// 項目構成が同じテナント群: 1 行の関数にして使い回す
const tenant = (p: PartitionId) => porters.tenant(p, { fields: myFields });
const t2 = tenant(2);
```

**`A_` を App 共通、`U_` をテナント固有にする**なら、共通部分を関数にして各テナントの宣言に
spread します。ライブラリは `A_` と `U_` を区別しません（PORTERS の公式記事はどちらも「テナント毎に異なる」と
しているため）。合成は宣言の側で行います。

```ts
import { defineFields } from "@joymerrevent/porters-connect";
import type { FieldBuilder } from "@joymerrevent/porters-connect";

// App 共通（A_）の宣言は関数にして 1 か所に置く
const appCandidate = (f: FieldBuilder) => ({ A_score: f.number() });

// テナント A: 共通 ＋ 自分の U_ ／ テナント B: 共通だけ
const tenantA = defineFields({
  candidate: (f) => ({ ...appCandidate(f), U_memo: f.singlelineText() }),
});
const tenantB = defineFields({ candidate: appCandidate });

const a = porters.tenant(1, { fields: tenantA }); // A_score と U_memo が型付き
const b = porters.tenant(2, { fields: tenantB }); // A_score だけ
```

client を分けるのは**トークンを分けたいとき**だけです（[複数テナント][multi-tenancy] の「認証を分けるか」）。
項目が違うだけなら、同じ client（同じトークン）から `tenant(id, { fields })` を作り分けます。

## 関連

- 主題: [項目と値のかたち][fields]（alias と Data Type）／[Partition とテナントスコープ][tenant]（宣言を渡す場所）／
  [書き込み][write]／[エラーと再試行][error-handling]（宣言と実データの食い違い）
- リソース別: [Field][r-field]（項目定義の Read）／[Option][r-option]（選択肢の alias）
- 実践例: [複数テナント][multi-tenancy]（宣言をテナントごとに持つ・スコープを関数に渡す）
- リファレンス: [Field Type / Data Type][fdt]
- ほかの目的から探す: [目次][index]

<!-- 根拠:
- 決定: ADR-0023（`defineFields` の詳細設計）／ADR-0004（型モデル）／
  ADR-0087（宣言は `tenant()` で渡す）
- 型の由来: ADR-0016（Data Type の粒度）／ADR-0017（Option は常に `string[]`）
- 既定 field: ADR-0020／`field` の alias: ADR-0059
-->

[error-handling]: errors.md
[fdt]: ../reference/resource-api/field-data-types.md
[multi-tenancy]: ../recipes/multi-tenant.md
[write-constraints]: limits.md
[index]: ../index.md
[gotchas]: ../reference/gotchas.md
[datetime]: datetime.md
[fields]: fields.md
[tenant]: tenant.md
[write]: write.md
[r-field]: ../resources/field.md
[r-option]: ../resources/option.md
