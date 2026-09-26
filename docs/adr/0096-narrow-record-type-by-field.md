# 96. `field` で読み取りの戻り値の型を絞る

- Status: accepted
- Date: 2026-09-25
- Deciders: jun.shiromoto (Joymerrevent)

> 起票元は [ADR-0095][adr95] の議論（2026-09-25）。`get` と `getMany` に `field` を足すときに「戻り値の型を `field` で
> 絞るか」が問いになり、`search` / `searchAll` とまとめて別の ADR で決めることにした。
>
> [ADR-0005][adr5] SD-3「`field` 選択と返り値型 → 簡易（全既知項目を持つ型・選択は実行時）。選択で型を絞る案は将来」を**改める**
> （SD-3 が「将来」とした案を、この ADR で採る）。[ADR-0059][adr59] が射程外とした「`field` で取れる項目と戻り型を連動させること」も
> この ADR で扱う。
>
> **decider が案1b ＋ 案2a を選択し `accepted`（2026-09-25）。** 実装は accept 後・別 PR（[ADR-0095][adr95] の実装の後）。

## Context and Problem Statement

### いまの形

データ系の読み取り（`search` / `searchAll`、[ADR-0095][adr95] 以降は `get` / `getMany` も）は `field` で取得する項目を
選べる。戻り値のレコードの型は、`field` に何を渡しても**リソースの全項目のキーを省略可能で持つ** `ReadRecord`
（`src/resources/read-core.ts`）。

```ts
type ReadRecord<F> = { [K in keyof F]?: DecodedValue<F[K]> | null };
```

実行時の値は次のとおり（デコーダーは応答に出てきたタグだけをレコードに入れる。`decoderFor`）:

- 読んだ項目で値がある → デコードした値
- 読んだ項目で PORTERS 側が空 → `null`
- 読んでいない項目 → キーが無い（`undefined`）

```ts
const page = await t.candidate.search({ field: ["P_Id", "P_Name"] });
const c = page.items[0]!;
c.P_Name; // 型 string | null | undefined → 読んだので値か null
c.P_Mail; // 型 string | null | undefined → 読んでいないので必ず undefined。型エラーにならない
```

型は実際の値について嘘をつかない（全部省略可能なので）が、**読んでいない項目に触るコードをコンパイル時に止められない**。
`field` に足し忘れた項目は、実行時にいつも `undefined` として静かに読まれる。

### `expand` と `image` は値の形だけを変えている

`expand` / `image` は指定に合わせて型を変える（`ExpandedReadRecord` / `ImageReadRecord`）。ただし変えるのは**値の形**
（ID → 参照先のレコード、ファイル名 → 選んだサブタグ）で、キーは省略可能のまま。どの項目のキーがあるかは、
いまはどの読み取りも型に表していない。

### 応答に何が来るかの前提

- `field` を省略すると、ライブラリは知っている項目をすべて送る（[ADR-0020][adr20]）。
- `field: []` は `field` を送らず、PORTERS の既定＝主キーだけが返る。
- `expand` / `image` で選んだ項目は、`field` に無くてもライブラリが `field` の並びに足す（`applyExpand` / `applyImage`）。
  ただし `field: []` のときは `field` 自体を送らないので、`expand` / `image` も送られない。
- **要求した項目のタグが、値が空でも必ず応答に出るか**は、出典に書かれていない。Read の記事の応答例は値のある項目しか
  載せていない。live-verification にもこの項目は無い。
- `field` に主キーを入れなかったとき、PORTERS が主キーを返すかどうかも出典に書かれていない。

### 問い

`field`（と `expand` / `image`）で要求した項目に合わせて、戻り値の型を絞るか。絞るなら、どこまで絞り、どの読み取りに
当てはめるか。

## Decision Drivers

- **型安全**: 読んでいない項目に触るコードをコンパイル時に止める。
- **フェイルセーフ（型が実際より強いことを言わない）**: 出典で確かめられない前提（空の項目のタグが出るか）の上に、
  「必ずある」と型で約束しない。型が実際より弱いのは安全側、強いのは危険側。
- **読み取りの間で揃える**: 同じ `field` を渡したら、`search` / `searchAll` / `get` / `getMany` で同じ型になる。
- **1.0 前**: 型の破壊的変更を入れるなら今が安い。

## Considered Options

### 軸1: 何を絞るか

- 案1a: 絞らない（いまのまま）
- **案1b: 読んでいない項目のキーを型から外す。読んだ項目のキーは省略可能のまま**（推奨）
- 案1c: 案1b ＋ 読んだ項目のキーを必ずあるものにする（`?:` を外す）。応答にタグが無ければデコーダーが `null` で埋める

### 軸2: 当てはめる読み取り

- **案2a: `search` / `searchAll` / `get` / `getMany` のすべて**（推奨）
- 案2b: `get` / `getMany` だけ

## Decision Outcome

採用: **案1b ＋ 案2a**（decider が 2026-09-25 に選択）。

### 決めること

- 読み取りの戻り値の型のキーを、**要求した項目**に絞る。要求した項目は次の和:
  - `field` に渡した alias（`field` を省略したときは、知っている項目すべて＝いまと同じ型）
  - `expand` / `image` で選んだ alias（ライブラリが `field` に足すので）
  - `get` / `getMany` では ID の項目（[ADR-0095][adr95] でライブラリが必ず足して読むので）
- 絞ったあとも、各キーは**省略可能のまま**（`?:`）。値の型（`DecodedValue | null`、`expand` / `image` の形）はいまと同じ。
- `field: []` は、`get` / `getMany` では ID の項目だけ、`search` / `searchAll` ではキーを持たない型にする。
  ~~`field: []` と `expand` / `image` を一緒に渡したときは、送られるのが主キーだけなので、`expand` / `image` のキーも型に
  入れない（実際の送り方に型を合わせる）。~~
  **訂正（実装時 2026-09-25）**: ①この記述は `search` / `searchAll` の場合だけ正しかった。`get` / `getMany` は `field` に
  ID の項目を足して送る（[ADR-0095][adr95]）ので `field` が空にならず、`expand` / `image` も実際に送られる。②実装では、
  `search` / `searchAll` の `field: []` は `expand` / `image` のキーも型に入れず、`get` / `getMany` の `field: []` は ID と
  `expand` / `image` のキーを型に入れる。③「実際の送り方に型を合わせる」という決定そのものは変わらない。
- `field` が型引数から読めない（`string[]` の変数など、リテラルでない）ときは、知っている項目すべてに戻す
  （いまと同じ型になる）。
- 型に無い項目を読みたいときの逃げ道は、いまある `rawValue` を使う。

### 推奨案を採る理由

- **案1b**: 読み忘れ（`field` に足していない項目に触る）をコンパイル時に止めるという、この問いの主な効き目がすべて
  得られる。型が言うのは「このキーは無い」だけで、それは要求していないので正しい。
- **案1a** は、読み忘れがいつも静かに `undefined` になる状態を残す。
- **案1c** は `undefined` を気にしなくてよくなるが、「空の項目のタグが必ず出るか」という確かめられない前提に乗る。
  デコーダーで `null` を埋めれば型は守れるが、「PORTERS が返さなかった」と「空だった」の区別が消える
  （[ADR-0059][adr59] で潰した「要求したものが黙って返らない」を、値の側で作り直すことになる）。
  実機で「要求した項目は必ずタグが出る」と確かめられたら、別の ADR で 1c に進める。
- **案2a**: 同じ `field` で読み取りごとに型が変わると、`get` から `search` に書き換えたときなどに迷う。
- **案2b** は影響が小さいが、`search` / `searchAll` の読み忘れは止まらず、4 つのメソッドで型の振る舞いが食い違う。

### Consequences

- Good: 読んでいない項目に触ると型エラーになる。`field` に足し忘れた項目にコンパイル時に気づける。
- Good: `field` を省略したコードの型は変わらない。
- Bad: **型の破壊的変更**。`field` を渡していて、渡していない項目に触っているコードは型エラーになる（そのコードは
  実行時にいつも `undefined` を読んでいたので、見つかるのは潜在的な誤り）。使い方ドキュメントと README には `field` を
  渡す例が 38 行あり（2026-09-25 に数えた）、例示コードの検査で確かめる。
- Bad: 型の定義が増える（`field` / `expand` / `image` の和を取る型）。
- Neutral: 読んだ項目も省略可能のままなので、`undefined` の確認はいまと同じく要る。

## 信じている入力

| 値                             | 出どころ        | 誰が書けるか | 守り方                                                     | 誤っていたら                                                              |
| ------------------------------ | --------------- | ------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| 要求していない項目は返らない   | PORTERS の Read | PORTERS      | 型から外すだけ。デコーダーは返ってきたものをそのまま入れる | 返ってきても型から見えないだけ（`rawValue` で読める）。誤った値は返さない |
| 要求した項目のタグが必ず出るか | PORTERS の Read | PORTERS      | 前提にしない（キーは省略可能のまま）                       | —                                                                         |
| 利用者が渡す `field`           | 利用者のコード  | 利用者       | リテラルなら型で読む。読めなければ全項目の型に戻す         | 型が広いまま（いまと同じ）になるだけ                                      |

## Pros and Cons of the Options

- 案1a — Good: 何も変えない。Bad: 読み忘れが静かに `undefined` になる。
- 案1b — Good: 読み忘れが型エラーになる。確かめられない前提に乗らない。Bad: 型の破壊的変更。型の定義が増える。
- 案1c — Good: 読んだ項目の `undefined` を気にしなくてよい。Bad: 確かめられない前提に乗る。「返らなかった」と「空」が区別できなくなる。
- 案2a — Good: 4 つのメソッドで型が揃う。Bad: `search` / `searchAll` の利用者にも破壊的変更が及ぶ。
- 案2b — Good: 影響が小さい。Bad: 4 つのメソッドで型の振る舞いが食い違う。

## More Information

- 実装（accepted 後・別 PR。[ADR-0095][adr95] の実装の後）: `src/resources/read-core.ts` / `expand.ts` / `image.ts`
  （要求した項目で絞る型）、`src/resources/resource.ts`（`search` / `searchAll` / `get` / `getMany` の型引数に `field` を
  足す）、型のテスト（`@ts-expect-error` で読んでいない項目・リテラルでない `field`・`field: []` と `expand` の組）、
  API リファレンスの生成し直し、使い方ドキュメント（「検索」の章の `field` の節）、changeset（minor・型の破壊的変更）。
- **実装時の補足（2026-09-25）**: `field` を型引数で受けるようにしたら、宣言が違うスコープ（例: `U_score` を宣言した
  スコープと `U_memo` を宣言したスコープ）を取り違えても型エラーにならなくなった。それまでは `field` の引数の型が、
  「一方の項目名がもう一方にすべて含まれるときだけ通る」比べ方を担っていた（[ADR-0074][adr74] D1 の「項目が違えば
  スコープの型も違う」）。同じ比べ方をする印のメソッド（型だけ・実行時には無い）をリソースの型に置いて保った。
  使い方ドキュメントの例（`doccheck: expect-error`）が、この後退を見つけた。
- 実機で確かめたい点（「空の項目のタグが出るか」「`field` に主キーが無いとき主キーが返るか」）は、実装 PR で
  live-verification に足す。案1c に進むかの判断材料になる。

## パスの注記

<!-- 決定の本文は書き換えない。本文に書いたパスが移ったり名前が変わったりしたら、ここに今の場所を足す。 -->

本文に書いたパスのうち、あとで移したもの・名前を変えたものの今の場所（本文は決定したときのまま）:

- `src/resources/read-core.ts` → 送信は `src/resources/core/read.ts`、項目の一覧の型は `core/catalog.ts`、応答の変換は `core/decoder.ts`、ページ送りは `core/paging.ts`、`field` の組み立ては `core/field-param.ts`（2026-09-25 に `core/read.ts` へ移し（ADR-0097）、2026-09-26 に分けた）
- `src/resources/resource.ts` → データ系の factory は `src/resources/core/data-resource.ts`（読み込みは `core/read-data.ts`、書き込みは `core/write-data.ts`）、`ResourceDescriptor` は `core/descriptor.ts`、書き込みの URL と結果の読み取りは `core/write.ts`、マスタは `core/master-resource.ts` / `core/read-master.ts`（2026-09-25 に `core/` へ移して分け（ADR-0097）、2026-09-26 にさらに分けた）

[adr5]: 0005-public-api-shape.md
[adr20]: 0020-read-field-default.md
[adr59]: 0059-read-field-bare-alias.md
[adr95]: 0095-get-many-by-ids.md
[adr74]: 0074-custom-field-declaration-required.md
