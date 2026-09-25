# 95. 複数の ID でまとめて読む `getMany(ids)` を足す

- Status: proposed
- Date: 2026-09-25
- Deciders: jun.shiromoto (Joymerrevent)

> 起票元は stakeholder の問い（2026-09-25）:「`get` は ID を 1 つしか受けない。ID を複数渡して取得できるメソッドは
> あったほうがいいのではないか」。
>
> [ADR-0005][adr5] の公開 API の形（`get(id)` は 1 件）に、複数の ID を受けるメソッドを足す案。`get` 自体は変えない。

## Context and Problem Statement

### いまの形

データ系のアクセサの `get(id, { expand?, image? })` は、`search` に `{idAlias}:eq=<id>` の `condition` と `count=1` を付けて
1 件だけ読み、見つからなければ `undefined` を返す（`src/resources/resource.ts` の `get`）。`get` を持つのは汎用の
アクセサ 12 種（Attachment を除くデータ系 11 種 ＋ Phase）と、専用の Attachment。マスタ 5 種（Partition / User / Field /
Option / Department）は PORTERS の Read が ID の条件を受けないので `get` を持たない。

複数の ID で読みたい利用者の選択肢は、いまは次の 2 つ:

1. `get` を ID の数だけ呼ぶ。確実に動くが、リクエストが ID の数だけ出る（Read は 1 分あたり 2000 回が上限で、
   ライブラリの間引きが待たせる）。
2. `searchAll({ condition: { P_Id: { or: [...] } } })`。`condition` の型は `System[Id]` に `or` を許している
   （`src/resources/query.ts` の `IdCondition`）。ただし使い方ドキュメントにこの書き方の例は無く、
   次に書く「`or` が効くか」の問題と、URL の長さの問題が利用者に残る。

### `P_Id` に `or` が効くか — 出典の記述が割れている

- Read - Condition の記事（`Read API - Parameter`）の `or` の行は「**Phase API の Id および Resource Id にしか
  使用できません**」と書き、その同じ行の例が `Job.P_Id:or=10003:43405` になっている。
- Job Read と Opportunity Read の記事は、例に `condition=Job.P_Id:or=1234:1235` /
  `condition=Opportunity.P_Id:or=1234:1235` を載せている。
- Phase Read の記事は「複数の Id を指定して or 検索する場合は、condition パラメータに Phase の Id を指定」と、
  Phase については明記している。
- ライブラリの reference（`docs/usage/reference/resource-api/README.md`）は「Phase の Id は `or` も可」と狭く要約し、
  [ADR-0038][adr38] は「`or` は Phase Id・Resource Id のみ」と書いた上で、`IdCondition` にはすべてのリソースで `or` を
  許している。

「Resource Id」を「各リソースの ID（`P_Id`）」と読めば例と本文は合うが、「Phase の `ResourceId` 項目」と読めば
Phase 以外の `P_Id` には効かない。**どちらなのかは実機でしか確かめられない**。いまの live-verification にこの項目は無い。

### 効かなかったときに何が起きるか

PORTERS が効かない条件をエラーで返すなら、利用者はエラーを見て気づける。怖いのは、**条件を無視して先頭から
`count` 件を返す**場合で、そのまま返すと、頼んでいない ID のレコードを頼んだものとして渡すことになる。
複数の ID を受けるメソッドを作るなら、この失敗を静かに通さない形にする必要がある。

### 長さの上限

`or` の値はコロン区切りで URL に載る。Read の URL には既定の `field`（カタログのすべての項目。[ADR-0020][adr20]）も
載るので、ID を載せられる残りはリソースごとに違う。約 15000 文字を超えると送る前に設定エラーで止まる
（`MAX_REQUEST_LENGTH`）が、分けて送り直しはしない。Write の一括処理（`src/resources/bulk-write.ts`）は、
同じ上限に収まるように分けて送る仕組みをすでに持っている。1 回の Read で返る件数の上限は `count` の 200。

### 問い

複数の ID でまとめて読むメソッドを足すか。足すなら、どう送り、何を返し、どのリソースに付けるか。

## Decision Drivers

- **フェイルセーフ**: 頼んでいない ID のレコードを返さない。PORTERS の応答が前提と違えば、黙って返さずにエラーにする。
- **出典の割れを実装で隠さない**: 実機で確かめるまでは仮定として記録する（live-verification）。
- **`get` と揃える**: 受けるオプション（`expand` / `image`）と「見つからなければ `undefined`」を同じにする。
- **利用者に長さの計算をさせない**: 上限に収まる分け方はライブラリが引き受ける。
- **公開 API を増やしすぎない**: メソッドは 1 つ。リソースごとに違う名前を作らない。

## Considered Options

### 軸1: 送り方

- **案1a: `{idAlias}:or=` で束ねて送り、返ってきた ID を突き合わせる**（推奨）
- 案1b: ID ごとに `get` と同じリクエストを送る（`:eq=` を N 回）
- 案1c: メソッドは足さず、`searchAll` と `P_Id: { or }` の書き方を使い方ドキュメントに載せる

### 軸2: 戻り値の形

- **案2a: 渡した順に並べた配列 `(T | undefined)[]`**（推奨）
- 案2b: 見つかったものだけの `Map<number, T>`
- 案2c: 見つかったものだけの配列（PORTERS が返した順）

### 軸3: 付けるリソース

- **案3a: 汎用のアクセサ 12 種（データ系 11 種 ＋ Phase）に付け、Attachment とマスタには付けない**（推奨）
- 案3b: Phase だけに付ける（出典が明記しているものだけ）。データ系は実機で確かめてから
- 案3c: Attachment にも付ける

## Decision Outcome

**未決（proposed）**。以下は推奨案（1a ＋ 2a ＋ 3a）で書いた場合の形。

### 決めること（推奨案）

- 名前は `getMany(ids, { expand?, image? })`。`get` と同じオプションを受け、同じ型のレコードを返す。
- **送り方（案1a）**:
  - 重複した ID は 1 回だけ送る。空の配列ならリクエストを送らずに `[]` を返す。
  - ID を「1 本あたり 200 件まで」かつ「URL が上限に収まるまで」の組に分け、組ごとに `{idAlias}:or=<id>:<id>:…` と
    `count=<組の件数>` で 1 回ずつ読む。組は順に送る（間引きはこれまでどおりライブラリが行う）。
  - 1 つの組でも失敗したら、その失敗をそのまま投げる（途中までの結果は返さない。Read なので呼び直せば同じ結果になる）。
  - **突き合わせ**: 返ってきたレコードの ID が、その組で頼んだ ID の中に無ければ、`PortersResourceError`
    （`category: "unknown"`）で止める。応答の `Total` が組の件数を超えたときも同じ（条件が効いていないことの印）。
    PORTERS が `or` を無視して先頭から返したとき、頼んでいないレコードを返さないため。
- **戻り値（案2a）**: 渡した `ids` と同じ長さ・同じ順の配列。見つからなかった位置は `undefined`（`get` と同じ）。
  同じ ID を 2 回渡したら、両方の位置に同じレコードが入る。
- **付けるリソース（案3a）**: 汎用のアクセサ（`src/resources/resource.ts` の factory）で作る 12 種。Phase は `Id:or`、
  それ以外は `P_Id:or`（`idAlias` を使うので分岐は要らない）。
- **付けないもの**:
  - Attachment。Read の ID 指定は `condition` ではなく専用の `id` パラメータで、1 つしか受けない。また本体
    （1 ファイル 10MB まで）を運ぶのは `get` だけにしている（[ADR-0075][adr75]・[ADR-0081][adr81]）。
  - マスタ 5 種。Read が ID の条件を受けない。
  - `itemstate`（削除済みも読む）。`get` と同じく削除されていないものだけを読む。

### 推奨案を採る理由

- **案1a**: 1 回で最大 200 件読めるので、`get` を繰り返すより Read の回数が 1〜2 桁少ない。出典の割れは、
  突き合わせで「効かなければエラー」に倒せる。前提が外れても被害は「エラーになる」で止まり、誤ったレコードは返らない。
- **案1b** は確実に動くが、`get` を `Promise.all` で呼ぶのと同じで、ライブラリが足す価値が小さい。1000 件で 1000 回の
  Read になり、1 分あたりの上限の半分を使う。**案1a の前提が実機で外れたときの切り替え先**として残す。
- **案1c** は何も増やさないが、長さの計算・突き合わせ・`or` が効くかの確認を利用者ごとに書くことになる。
- **案2a**: `get` の「見つからなければ `undefined`」をそのまま配列にした形で、`ids[i]` と `result[i]` が対応する。
  見つからなかった ID を調べるのに、利用者が突き合わせを書かなくて済む。
- **案2b** は ID から引くのに向くが、見つからなかった ID は `ids` と `Map` を比べて探すことになる。案2a の結果から
  `Map` を作るのは 1 行でできる（逆は `ids` が要る）。
- **案2c** は `search` の結果と同じで、専用メソッドにする意味が薄い。
- **案3a**: 汎用の factory に 1 か所足せば 12 種に付く。リソースごとの差は `idAlias` だけ。
- **案3b** は出典に最も忠実だが、データ系を待たせる理由が「出典の書き方が割れている」だけで、それは突き合わせで
  安全側に倒せる。
- **案3c** は本体つきのファイルを何件もまとめて読むことになり、[ADR-0075][adr75] で本体を `get` だけに閉じた理由
  （1 件ずつなら大きさが読める）に反する。

### Consequences

- Good: 複数の ID で読むのが 1 行になり、Read の回数が減る。見つからなかった ID が位置で分かる。
- Good: `P_Id` の `or` が効くかどうかが live-verification に載り、契約後に確かめる項目になる。
- Bad: 公開メソッドが 1 つ増える（汎用のアクセサ 12 種すべて）。
- Bad: `P_Id` の `or` が実機で効かなかった場合、`getMany` はデータ系でエラーになり、送り方を案1b に替える
  変更が要る（公開 API の形は変わらない）。
- Neutral: `search` の `condition` で `P_Id: { or }` を書けることは変えない（同じ前提の上にあるので、
  live-verification の結果で一緒に見直す）。

## 信じている入力

| 値                             | 出どころ        | 誰が書けるか | 守り方                                                         | 誤っていたら                                                                 |
| ------------------------------ | --------------- | ------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `{idAlias}:or` が効くこと      | PORTERS の Read | PORTERS      | 返ってきた ID が頼んだ ID に含まれるか・`Total` を突き合わせる | 条件を無視されればエラーで止まる。条件をエラーで返されればそのエラーを投げる |
| 返ってきたレコードの `idAlias` | PORTERS の応答  | PORTERS      | 突き合わせに使う。無いレコードもエラーにする                   | 位置に置けないレコードは返さず、エラーで止まる                               |
| 利用者が渡す `ids`             | 利用者のコード  | 利用者       | 型は `readonly number[]`。重複はまとめる                       | 存在しない ID は `undefined` になる（`get` と同じ）                          |

## Pros and Cons of the Options

- 案1a — Good: Read の回数が少ない。前提が外れてもエラーで止まる。Bad: 出典の割れた記述に乗る（実機で確かめるまで仮定）。
- 案1b — Good: `get` と同じリクエストなので確実。Bad: Read が ID の数だけ出る。ライブラリが足す価値が小さい。
- 案1c — Good: 何も増えない。Bad: 長さ・突き合わせ・前提の確認が利用者に残る。
- 案2a — Good: `ids` と位置で対応し、見つからなかった ID が分かる。Bad: 見つかったものだけ欲しいときは `filter` が要る。
- 案2b — Good: ID から引ける。Bad: 見つからなかった ID を探すのに `ids` と比べる必要がある。
- 案2c — Good: `search` と同じ形。Bad: 専用メソッドの意味が薄い。
- 案3a — Good: 1 か所の変更で 12 種に付く。Bad: データ系は仮定の上に乗る。
- 案3b — Good: 出典が明記したものだけ。Bad: 需要の大きいデータ系が待たされる。
- 案3c — Good: すべてのデータ系で揃う。Bad: 本体を何件も運ぶことになり、[ADR-0075][adr75] に反する。

## More Information

- 実装（accepted 後・別 PR）: `src/resources/resource.ts`（`getMany` と組分け・突き合わせ）、組分けを
  `bulk-write.ts` の詰め方と共有するかは実装で決める、テスト（組の境目・重複・空・突き合わせの失敗・`Total` 超過）、
  フェイクサーバーでの結線（`test/fake/query.ts` はすでに `or` を扱う）、API リファレンスの生成し直し、
  使い方ドキュメント（リソース別のページと「検索」の章）、changeset（minor・破壊的変更なし）。
- 同じ実装 PR で live-verification に「`P_Id:or` がデータ系で効くか」を足し、コードに対応する `VERIFY(live)` を置く。
- reference（`docs/usage/reference/resource-api/README.md`）の「Phase の Id は `or` も可」は、出典の記述が割れていることが
  分かるように書き直す（実装 PR と同じか、その前の docs の PR）。

[adr5]: 0005-public-api-shape.md
[adr20]: 0020-read-field-default.md
[adr38]: 0038-read-query-surface-impl.md
[adr75]: 0075-attachment-search-all.md
[adr81]: 0081-attachment-read-parameters.md
