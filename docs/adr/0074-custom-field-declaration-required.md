# 74. 未宣言のカスタム項目を `field` からも外す（宣言必須へ揃える）

- Status: accepted
- Date: 2026-09-14
- Deciders: jun.shiromoto (Joymerrevent)
- Implemented: 0.16.0

> ドキュメント見直し（[#286][pr286]）の途中で、**`field` には書けるのに受け取れない**という
> 非対称が見つかった。説明に 1 段落を要する形になっており、その説明自体が設計の徴候と判断して起票する。
>
> **decider が案B を選択し `accepted`（2026-09-14）。** 実装は accept 後・別 PR。

## Context and Problem Statement

カスタム項目（`U_` / `A_`）を使う入口は 4 つある。**そのうち 3 つは既に宣言必須**で、`field` だけが
未宣言の alias を受け付ける。

| 入口                | 未宣言の alias | 根拠                                                         |
| ------------------- | -------------- | ------------------------------------------------------------ |
| `field`             | **書ける**     | `ReadFieldAlias` が `U_${string}` を許す（[ADR-0059][0059]） |
| `condition`         | 書けない       | `Condition<F>` は `keyof F` のみ                             |
| `order`             | 書けない       | `OrderableKeys<F>` は `keyof F` のみ                         |
| `create` / `update` | 書けない       | `WritableKeys<F>` は `keyof F` のみ                          |

しかも `field` に書けても**受け取れない**。`ReadRecord<F>` はカタログの alias だけを持つため、
`c.U_score` はコンパイルエラーになる（`src/resources/read-core.ts`）。

```ts
const page = await t.candidate.search({ field: ["U_score"] }); // 要求はできる
page.items[0]?.U_score; // ✗ 型エラー：結果の型には出ない
```

これは**検討したうえで引いた線ではない**。2 つの決定の隙間に残ったものと見ている。

**要求側は決めてある。** [ADR-0059][0059] は Decision Drivers に「**逃げ道を塞がない**」と掲げ、
宣言していない `U_` / `A_` も `field` に書けることを意図して守った。

**受け取り側は決めていない。** `ReadRecord<F>` がカタログの alias だけを持つ理由は、ソースの
コメントに残っている（`src/resources/read-core.ts`）。

> Custom `U_`/`A_` aliases are not in the catalog, so they are not typed here
> (access via a cast until the declaration DSL lands — ADR-0005 SD-2)

ここでいう declaration DSL が `defineFields` のことで、`defineFields` は
[ADR-0023][0023] で入った。つまりこのコメントは「**`defineFields` ができるまでの暫定**」を
書いたものであって、線引きとして選んだものではない。**そして DSL が入ったとき、この暫定は
見直されていない。**

問い: **`field` の未宣言 alias を許し続けるか。許すなら受け取れるようにするか、いっそ塞ぐか。**

## Decision Drivers

- **一貫性**: カスタム項目の使い方を 1 つのルールで説明できること。いまは「要求と受け取りは別」と
  いう説明が要り、ガイドで 1 段落を使っている。
- **フェイルセーフ**: 型が嘘をつかないこと。実行時は寛容なまま（未知の値で落ちない）を保つこと。
- **綴りを機械が検査する**（[ADR-0059][0059] が「要求したものが黙って返らない」を潰した基準）。
- **逃げ道**: 宣言していない項目に触れなくなる不便。ただし**どこまで実用的な逃げ道か**を測ってから
  重みを決める。
- **移行コスト**: 0.x とはいえ破壊的変更は利用者のコードに触る。

### 逃げ道はリテラルにしか効いていない（実測）

ADR-0059 が守った「逃げ道」が実際に何を救っているかを確かめた。**実行時に見つけた alias は
今でも通らない**。

```ts
const found: string = "U_memo"; // t.field.search で見つけた alias
await t.candidate.search({ field: [found] }); // ✗ 型エラー（string は `U_${string}` に入らない）
```

つまり逃げ道が効くのは `field: ["U_memo"]` と**直接書ける場合だけ**で、それは
`defineFields({ candidate: (f) => ({ U_memo: f.singlelineText() }) })` の 1 行で置き換えられる。
動的な発見は**元から cast が必要**で、この ADR の選択に影響されない。

### 未宣言のまま読むと何が返るか（実測）

`decoderFor` を実行して確認した。

| 応答のノード                          | 返る値            |
| ------------------------------------- | ----------------- |
| スカラ（`<U_score>80</U_score>`）     | 生の文字列 `"80"` |
| 入れ子（`Option` / `User` / `Image`） | `null`            |

日時も変換されないので `"2026/09/10 12:00:00"`（PORTERS の書式）のまま返る。

## Considered Options

- **案A**: 未宣言 alias を**返り値の型にも出す**（`string | null | undefined`）。緩い側へ揃える
- **案B**: `field` からも未宣言 alias を**外す**。厳しい側へ揃える（推奨）
- **案C**: 現状維持（要求できるが受け取れない）

## Decision Outcome

決定点は 2 つ。**型は宣言必須に締め、逃げ道には名前を付ける**（D1 と D2 は裏表で、逃げ道が要るのは
締めたから）。decider が 2026-09-14 に選択。

### D1: `field` からも未宣言 alias を外す（案B）

採用: **案B**（`field` からも未宣言 alias を外し、宣言必須に揃える）。

理由は 3 つ。

1. **すでに 3/4 が宣言必須**。`field` を揃えるほうが、他の 3 つを緩めるより小さい変更で、
   結果として「**カスタム項目は宣言してから使う**」の 1 ルールになる。
2. **逃げ道の実用価値が小さい**（上記の実測）。救われるのは 1 行で宣言できるケースだけ。
3. **説明が消える**。ガイドの「要求と受け取りは別です」という段落は、設計が説明を要する形である
   ことの徴候だった。案B ならその段落ごと不要になる。

案A も型が嘘にならない点は成立する（未宣言の値は実測どおり `string | null`）。ただし
`U_hiredOn` を `string` として受け取れるようにすると、**PORTERS 書式の日時をそのまま表示に流して
気づかない**という静かな失敗が新たに生まれる。いまは型エラーで止まるので、宣言するか cast するかを
選ばされる。案A を採るならここの手当て（型名・ドキュメント）が別途要る。

### D2: 逃げ道に名前を付ける（`rawValue` を公開 API に足す）

D1 で締めても、知らない alias の値が手元に来ることはある（下の Consequences に挙げた 3 経路）。
いまそれを読むには型リテラル込みの cast が要る。

```ts
const v = (c as { U_unknown?: string | null } | undefined)?.U_unknown;
```

D1 のあとは `field` 側にも cast が要るので**さらに醜くなる**。`as` が散らばると「どこで型を外したか」
も追えない。そこで**逃げ道を 1 つの関数に集める**。

```ts
import { rawValue } from "@joymerrevent/porters-connect";

const v = rawValue(c, "U_unknown"); // string | null | undefined
```

逃げ道を通しで書くとこうなる（D1 後）。`field` は型が受け付けないので、そちらも cast する。

```ts
import { rawValue } from "@joymerrevent/porters-connect";
import type { CandidateSearchQuery } from "@joymerrevent/porters-connect";

const page = await t.candidate.search({
  field: ["P_Name", "U_memo"] as CandidateSearchQuery["field"],
});
const memo = rawValue(page.items[0], "U_memo"); // string | null | undefined
```

実行時は今までどおり通る（実測: 送られる `field` は `Person.P_Name,Person.U_memo`、
`U_memo` の値は生の文字列で返る）。**型を外した箇所が 2 つとも見える**のがこの形の値打ちで、
`as` の行を消せば宣言に戻せる。

戻り値は **`ReadRecord` と同じ規約**に揃える。`undefined` = その alias が応答に無かった、
`null` = あったがスカラでない（入れ子）か空、`string` = 生の値。畳んで `string | null` にする案も
あったが、**「返ってこなかった」と「空だった」を潰す**ので採らない（[ADR-0020][0020] 以来、
ライブラリはこの 2 つを別の状態として扱っている）。

検討した形は 2 つ。

- **ガイドに 4 行のヘルパーを載せるだけ**（公開 API を増やさない）— 利用者ごとに書き方が割れ、
  規約（`undefined` と `null` の意味）も各自の解釈になる
- **ライブラリが export する**（採用）— 逃げ道が 1 か所になり、規約をライブラリが保証する。
  `bytesToBase64` と同じく小さなユーティリティの前例がある

### Consequences

- Good: カスタム項目の入口 4 つがすべて「宣言必須」で揃う。ガイドから非対称の説明が消える。
- Good: `U_` 以降の綴りも**すべての入口で**機械に検査される。
- Bad: **破壊的変更**。`field: ["U_memo"]` は型エラーになる。semver は minor（0.x、[ADR-0055][0055] の前例）。
  移行は「宣言を 1 行足す」で機械的、`generateFieldDecls`（[ADR-0069][0069]）で生成もできる。
- Bad: [ADR-0059][0059] の Decision Driver「逃げ道を塞がない」を**覆す**。本 ADR がその一点を
  supersede する（bare alias・接頭辞を書かせない決定は維持）。
- Neutral: **実行時は変えない**。応答に知らない alias が混ざっても、**キーは残したまま**素通しで
  decode する（スカラは生の文字列、入れ子は `null`。実測）。したがって「できない」は**型の話**で、
  cast すれば送れる。知らない alias が届く経路は 3 つ — cast で `field` に入れた場合、`expand` した
  参照先レコードの中（`decodeReferenceRecord` も同じ扱い）、PORTERS が要求していない項目を足して
  返した場合。ライブラリは毎回 `field` を明示して送るので、通常は 3 つ目は起きない。
- Neutral: Attachment の `field?: string[]`（カタログを持たない緩い形）は射程外。揃えるなら別 ADR。
- Good（D2）: `as` が散らばらない。逃げ道を使った場所が `rawValue` で grep できる。
- Bad（D2）: 公開 API が 1 つ増える。値の変換はしないので、**日時は PORTERS 書式のまま返る**
  （それが「生の値」の意味だとドキュメントで示す必要がある）。
- Neutral（D2）: 型は `string | null | undefined` で固定。`Option` / `User` / `Image` の中身を
  取り出す用途には使えない（入れ子は `null`）。そこまで要るなら宣言する。

## 信じている入力

この決定は**公開型の形**だけを変え、外部から受け取る値の扱いは変えない。

| 値                         | 出どころ                | 誰が書けるか   | 守り方                                                                   | 取れなかったら               | 誤っていたら                              |
| -------------------------- | ----------------------- | -------------- | ------------------------------------------------------------------------ | ---------------------------- | ----------------------------------------- |
| 応答に含まれる未知の alias | PORTERS の Read 応答    | テナント管理者 | **仕組み**（`decoderFor` が素通しで decode）                             | キーごと現れない             | 値は生のまま。宣言済みなら形の検査が働く  |
| 宣言した alias / Data Type | 利用者の `defineFields` | 利用者         | **仕組み**（`defineFields` が同期検査／`verifyFields` がテナントと突合） | `PortersConfigError`（同期） | `verifyFields` で実テナントと突き合わせる |

案B は**型で書けるものを狭めるだけ**なので、応答側の寛容さ（取れなかった／知らない alias が来た
ときの倒れ方）は現状から動かない。

## Pros and Cons of the Options

### 案A: 未宣言 alias を返り値の型にも出す

- Good: `field` に書けたものが読める。要求と受け取りが揃う。
- Good: 型が嘘にならない（未宣言の値は実測で `string` か `null`）。
- Bad: **静かな失敗が増える**。日時が PORTERS 書式の `string` として素通しで使えてしまう。
- Bad: `search` の型引数が 3 つ目（`field` の const 捕捉）になる。`searchAll` も同じ扱いが要る。
- Bad: 宣言する動機が弱まる。変換・既定 field・綴り検査という本来の理由は残るが、説明が増える。

### 案B: `field` からも未宣言 alias を外す（推奨）

- Good: 入口 4 つが 1 ルールで揃う。ガイドの非対称の説明が消える。
- Good: 型引数は増えない。`ReadFieldAlias` から `U_${string}` / `A_${string}` を落とすだけ。
- Bad: 破壊的変更。既存の `field: ["U_memo"]` が壊れる。
- Bad: ADR-0059 の driver を覆す判断が要る。
- Neutral: cast は残る（実行時は寛容なまま）。

### 案C: 現状維持

- Good: 何もしない。破壊的変更なし。
- Bad: 「要求できるのに受け取れない」をガイドで説明し続けることになる。
- Bad: 隙間に残った状態を**決定として追認**することになる。

## More Information

- 関連: [ADR-0059][0059]（`field` を接頭辞なしの型付き alias で受ける）／
  [ADR-0023][0023]（宣言 DSL）／[ADR-0020][0020]（`field` の既定挙動）／
  [ADR-0069][0069]（宣言の自動生成）
- 実装は accept 後・別 PR（ADR と実装は分ける）。対象は `src/resources/read-core.ts` の
  `ReadFieldAlias`（D1）、`rawValue` の追加と `src/index.ts` からの export（D2。置き場所は実装時に
  決める）、およびガイド（[Read クエリ][rq]・[カスタム項目][cf]）の書き換え。
- 案B を採る場合、ガイドから消える説明: 「要求と受け取りは別です」「未宣言のカスタム項目は
  『読めるだけ』」「未宣言のまま押し通すなら自分で型を当てます」。

## パスの注記

<!-- 決定の本文は書き換えない。本文に書いたパスが移ったり名前が変わったりしたら、ここに今の場所を足す。 -->

本文に書いたパスのうち、あとで移したもの・名前を変えたものの今の場所（本文は決定したときのまま）:

- `src/resources/read-core.ts` → 送信は `src/resources/core/read.ts`、項目の一覧の型は `core/catalog.ts`、応答の変換は `core/decoder.ts`、ページ送りは `core/paging.ts`、`field` の組み立ては `core/field-param.ts`（2026-09-25 に `core/read.ts` へ移し（ADR-0097）、2026-09-26 に分けた）
- `src/resources/core/` → `src/accessor/`（2026-09-26・ADR-0101）。上に書いた `src/resources/core/…` と `core/…` のファイルは、いまは `src/accessor/` の中にある
- `query-encode.ts` と `read.ts`（`src/accessor/`）: `query-encode.ts` は `append-read-query.ts` / `build-read-params.ts` に、`read.ts` は `page-reader.ts` / `run-read.ts` / `page-url.ts` / `resource-page.ts` に分けた（2026-09-26・ADR-0101 の追記＝1 ファイルに主な export は 1 つ）。上に書いたこの 2 つのファイルは、いまは分けた先にある

[pr286]: https://github.com/Joymerrevent/porters-connect/pull/286
[0020]: 0020-read-field-default.md
[0023]: 0023-custom-field-declaration-dsl.md
[0055]: 0055-partition-binding-guard.md
[0059]: 0059-read-field-bare-alias.md
[0069]: 0069-tenant-field-catalog-tooling.md
[rq]: ../usage/topics/query.md
[cf]: ../usage/topics/custom-fields.md
