# 57. `itemstate: "existing"` を明示指定されたときに送るか

- Status: accepted
- Date: 2026-08-22
- Deciders: jun.shiromoto (Joymerrevent)

> [ADR-0038][adr38] **SD-4 の再検討**（amend であって全体の supersede ではない）。
> `existing` は API の既定なので param を省略すると決めたが、**利用者が明示的に `existing` と
> 書いたときも省いている**。PORTERS が将来この既定を変えたら、**明示指定した利用者が
> 黙って削除済み混じりのデータを受け取る**。
>
> **案A で `accepted`（2026-08-22）**: **明示指定は送り、省略時は送らない**。
> `undefined`（既定に委ねる）と `"existing"`（生存のみを要求する）は**別の意思表示**なので、
> wire でも区別する。公開型・戻り値・エラーは変わらず、変わるのは送信 URL だけ。
> **[LV-15][lv] を登録する**（`itemstate=existing` の明示送信は実機実績が無い）。実施は本 ADR とは別 PR。

## Context and Problem Statement

reference（[Resource API 概要][rapi]「Read パラメータ」）は `itemstate` をこう定義している。

| パラメータ  | 必須 | 内容                                                              |
| ----------- | ---- | ----------------------------------------------------------------- |
| `itemstate` |      | `existing`（既定）/ `deleted` / `all`。削除済みデータの取得制御。 |

ライブラリの公開型もこの 3 値を写している（`src/resources/query.ts`）。

```ts
export type ItemState = "existing" | "deleted" | "all";
// SearchQuery:
itemstate?: ItemState;
```

**型の上では 4 通りある** — 省略（`undefined`）・`"existing"`・`"deleted"`・`"all"`。
ところが送信側は前の 2 つを**同じ扱いに畳んでいる**（[ADR-0038][adr38] SD-4「既定 `existing` は param 省略」）。

```ts
// `existing` is the API default — omit it to keep URLs minimal (and stable vs. pre-F-2 reads).
if (q.itemstate !== undefined && q.itemstate !== "existing") {
  p.set("itemstate", q.itemstate);
}
```

### 省略と明示は違う意思表示である

| 呼び出し                            | 利用者が言っていること     | 送信される URL      |
| ----------------------------------- | -------------------------- | ------------------- |
| `search({})`                        | itemstate は**気にしない** | （param なし）      |
| `search({ itemstate: "existing" })` | **生存のみが欲しい**       | （param なし）      |
| `search({ itemstate: "deleted" })`  | 削除済みのみが欲しい       | `itemstate=deleted` |
| `search({ itemstate: "all" })`      | 両方欲しい                 | `itemstate=all`     |

**2 行目で、利用者が渡した情報を捨てている。** 現行の PORTERS では結果が同じなので実害は出ないが、
それは**「PORTERS の既定が `existing` である」というサーバー側の仕様に寄りかかっている**からで、
明示指定を明示指定として扱っているからではない。

### 既定が変わったときに何が起きるか

仮に PORTERS の既定が `all` に変わったとする。

- `search({})` — 「既定に委ねる」と言った利用者が既定の変更を受ける。**筋が通っている**。
- `search({ itemstate: "existing" })` — **生存のみを求めた利用者に削除済みが混ざる**。

後者が問題で、しかも**静かに壊れる**。例外も Result Code も出ず、レコードが増えるだけ。
[ADR-0056][adr56] を入れた今なら `P_Deleted` を見れば判別できるが、**明示指定した人は
そもそも判別する必要が無いと思っている**ので見に行かない。
[RV-1][rv1]（`field` 省略時に主キーしか返らない）と同系統の「**要求したものと違うものが黙って返る**」失敗である。

これはフェイルセーフの向きが逆になっている。「壊れたときに安全側へ倒れる」なら、
**明示された意思は明示的に送る**のが正しい向きになる。

### 現行の省略理由をいま評価すると

コメントに残っている 2 つの理由は、どちらも弱い。

- **URL を短く保つ** — `&itemstate=existing` は **18 文字**。送信前ガードは**約 15000 文字**
  （`MAX_REQUEST_LENGTH`）で、既定 field リストだけで数百文字使う。桁が違う。
- **F-2 以前の Read と URL を揃える** — F-2 の移行期の都合で、**いまは意味を持たない**。

### なぜ今か

[ADR-0056][adr56] の実施で `P_Deleted` が入り、`itemstate: "all"` が実用になった。
3 値の区別が実際に意味を持つようになったので、`existing` の扱いを詰める価値が出た。
論点自体は F-2 から存在していたが、**削除済みを判別できない間は誰も 3 値を使い分けていなかった**。

## Decision Drivers

- **フェイルセーフ** — 想定外（既定の変更）が起きたときに被害を広げない。明示された意思を保つ
- **利用者が渡した情報を捨てない**。型が持っている区別を wire で潰さない
- **サーバー側の既定への依存を必要な場所だけに閉じる**（省略時は依存してよい。明示時は依存すべきでない）
- **URL を短く保つ**（`MAX_REQUEST_LENGTH` ガード）— ただし 18 文字の重みで判断する
- **既存利用者の挙動を壊さない**（現行 PORTERS では結果は同一のはず）
- **accepted 済みの決定を軽々に覆さない**（[ADR-0038][adr38] SD-4）

## Considered Options

- **案A: 明示指定は送る／省略時は送らない** — `undefined` と `"existing"` を区別する。
- **案B: 現状維持** — `"existing"` は常に省略する（[ADR-0038][adr38] SD-4 のまま）。
- **案C: 常に送る** — 省略時も `itemstate=existing` を補って送る。
- **案D: 型から `"existing"` を外す** — `ItemState = "deleted" | "all"` にし、生存のみは省略で表す。

## Decision Outcome

**採用: 案A**（明示指定は送り、省略時は送らない。decider 判断・2026-08-22）。

```ts
// 明示された itemstate はそのまま送る。省略（undefined）だけがサーバーの既定に委ねる。
if (q.itemstate !== undefined) p.set("itemstate", q.itemstate);
```

`undefined` と `"existing"` が**別の意思表示**である以上、wire でも区別するのが素直で、
[ADR-0038][adr38] SD-4 が畳んだのは（当時の理由に照らしても）得るものが小さい。
変更は送信側の 1 条件だけで、公開型・戻り値・エラーは一切変わらない。

案C を採らないのは、**省略もまた意思表示**だから。「既定に委ねる」と言った利用者を
`existing` に固定してしまうと、今度は逆向きに情報を捨てることになる。全 Read URL が伸びる副作用もある。

案D は曖昧さを**値ごと消す**という点では筋が通るが、**reference が 3 値を定義している**のに
ライブラリの語彙を 2 値にすることになる（[ADR-0016][adr16] の「PORTERS に忠実」から離れる）。
公開型の破壊的変更でもあり、得るものに対して代償が大きい。

### 実施時の合意事項（accept 後の別 PR）

1. **`appendReadQuery` の条件から `&& q.itemstate !== "existing"` を外す**（`src/resources/query.ts`）。
   残すのは `q.itemstate !== undefined` だけ。
2. **`ItemState` の JSDoc を直す**。現在「Omitting (or `existing`) reads live data」と書いてあり、
   2 つを同一視している。**省略は「サーバーの既定に委ねる」／`existing` は「生存のみを要求する」**と書き分ける。
3. **テストの期待値を更新**（`src/resources/query.test.ts` の
   「sets deleted / all but omits existing and undefined」）。`existing` は**載る**、`{}` は**載らない**へ。
4. **フェイクは変更不要**。`parseReadQuery` の `?? "existing"` は明示・省略のどちらでも同じ結果になる。
   ただし**明示指定が実際に URL に載ることを L1 で pin する**。
5. **[Read クエリ ガイド][rq]に「送信されるか」を書く**。3 値の表に、省略と `existing` の違い
   （結果は同じだが、既定が変わったときに意味が分かれる）を注記する。
6. **semver は patch**。公開型・戻り値・例外は変わらず、変わるのは送信 URL だけ。
   ただし **CHANGELOG には理由を書く**（「なぜ 1 文字も結果が変わらない変更を入れたか」が後から分かるように）。
7. **[LV-15][lv] を登録する**（decider 判断で登録と決定）。reference は `existing` を**値として明記**して
   いるので仮定とまでは言えないが、**明示送信の実績はゼロ**で、外れたときの形が
   「`existing` を明示指定した Read が**全部** Result Code 133 で落ちる」と重い。
   `appendReadQuery` に `VERIFY(live)` を置き、契約後の最初のスモークで確かめる。

### Consequences

- Good: **明示指定が明示的に送られる**。PORTERS が既定を変えても、`existing` と書いた利用者は
  生存のみを受け取り続ける（安全側に倒れる）。省略と明示の**区別が wire まで通る**。
  サーバー側の既定への依存が、依存してよい場所（省略時）だけに閉じる。
- Bad: **`itemstate=existing` を実機に送った実績が無い**。reference に値として載っているので
  拒否されるとは考えにくいが、ゼロではない（Result Code 133）→ **[LV-15][lv]** で追う。
  明示指定している Read の URL が 18 文字伸びる。
- Neutral: **現行 PORTERS では結果は 1 件も変わらない**。この変更の価値は将来の仕様変更に対する
  保険であって、いま何かが直るわけではない。

## Pros and Cons of the Options

### 案A: 明示指定は送る／省略時は送らない（推奨）

- Good: 型が持つ区別が wire まで通る。既定変更時に安全側へ倒れる。変更は 1 条件だけで
  公開型は不変。省略の意味（既定に委ねる）も保たれる。
- Bad: 送信実績の無い値を送ることになる。URL が 18 文字伸びる。
  [ADR-0038][adr38] SD-4 を amend する必要がある。

### 案B: 現状維持（`existing` は常に省略）

- Good: 何もしなくてよい。URL が最短。実機で送った実績のある形のまま。
- Bad: **明示指定を黙って捨て続ける**。既定が変わったら静かに壊れる。
  型が持つ区別を wire で潰したままになる。

### 案C: 常に送る（省略時も補う）

- Good: 送信形が 1 つに定まり、既定に一切依存しなくなる。
- Bad: **省略という意思表示を潰す**（既定に委ねたい利用者を `existing` に固定する）。
  全 Read の URL が伸びる。既存利用者の URL が変わる範囲が最大になる。

### 案D: 型から `"existing"` を外す

- Good: 曖昧さが値ごと消える。省略＝生存のみ、と 1 対 1 になる。
- Bad: **reference が定義している 3 値をライブラリが 2 値に削る**（[ADR-0016][adr16] の
  「PORTERS に忠実」から離れる）。公開型の**破壊的変更**。
  `all` / `deleted` から「生存のみに戻す」コードが `undefined` を書くことになり、読みにくい。

## More Information

- 改める対象: [ADR-0038][adr38] **SD-4**（`itemstate` の詳細設計。案4a「既定 `existing` は param 省略」）。
  ADR-0038 の他の決定（typed condition・order・keywords・condition の 3 種制約ガード）は**そのまま有効**。
- reference 接地: [Resource API 概要][rapi]（Read パラメータ表・`itemstate` の 3 値と既定）。
  Result Code 133「itemstate 値が無効」は [result-codes][codes]。
- 削除済みの判別が可能になった経緯: [ADR-0056][adr56]（`P_Deleted` をカタログに載せる）／[RV-26][rv26]。
- 同系統の「黙って違うものが返る」失敗: [RV-1][rv1]（`field` 省略時に主キーしか返らない）。
- 起票の経緯: [ADR-0056][adr56] 実施 PR のレビュー中、stakeholder から
  「将来ポーターズの仕様が変わった場合に `existing` 指定しているのに `existing` にならないのは
  問題になる。指定されたら送った方が安全ではないか」と問われて論点化した（2026-08-22）。

[adr16]: 0016-field-type-granularity.md
[adr38]: 0038-read-query-surface-impl.md
[adr56]: 0056-deleted-flag-typing.md
[codes]: ../reference/resource-api/result-codes.md
[lv]: ../live-verification.md
[rapi]: ../reference/resource-api/README.md
[rq]: ../guide/read-query.md
[rv1]: ../reviews/rv/0001-read-field-default-missing.md
[rv26]: ../reviews/rv/0026-deleted-flag-unsupported.md
