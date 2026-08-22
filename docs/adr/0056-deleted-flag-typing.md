# 56. `P_Deleted`（削除フラグ）の扱い

- Status: proposed
- Date: 2026-08-21
- Deciders: jun.shiromoto (Joymerrevent)

> [findings RV-26][rv26] の是正案。F-2（[ADR-0038][adr38]）で `itemstate: "deleted" | "all"` を実装したが、
> **削除状態を表す `P_Deleted` がカタログに無い**ため、`"all"` で読んだときに
> どれが削除済みかを利用者が判別できない。
> 決定は decider が行う（自己 accept しない）。実施は accept 後の別 PR。
>
> **推奨は 2 度変わっている**（議論の経緯として残す）。
> 起票時の「新しい Data Type `System[Deleted]` を導入する」案は **[ADR-0016][adr16] 案B に違反**しており
> 撤回した（下記「撤回した案」）。次に推した「型付けせず 2 回呼ぶ運用の文書化」も、
> **案B のコスト見積もりが誤り（過大）だった**ことが分かったため次善へ下げた。
> 現在の推奨は **`FieldCatalog` の値を `DataType | null` に広げ、正典の「ー」をそのまま記録する**案。

## Context and Problem Statement

**PORTERS に削除 API は無い**。`itemstate` は削除済みレコードを読む唯一の手段で、
`"all"` は**生存と削除済みを混ぜて**返す（[ADR-0038][adr38]）。
ところが削除状態を表す **`P_Deleted` がカタログに無い**ため、
**返ってきたレコードのどれが削除済みかが分からない**。読む手段だけがあって、
**結果を解釈する手段が無い**状態になっている。

### PORTERS は `P_Deleted` に Data Type を与えていない

原記事（[Field Type & Data Type List][fdt-src]）を確認した。**Data Type は PORTERS が定義する列挙**で、
`SinglelineText` / `MultilineText` / `Number` / `Date` / `Option` / `Age` / `URL` / `Mail` /
`System[Id]` / `System[DateTime]` / `System[Reference]` / `System[Department]` / `DateTime` /
`Telephone` / `User` / `Image` / `Link` の 17 種。**`Deleted` に相当する値は無い**。
`P_Deleted` は **System Field List にも載っていない**。

各リソースの項目表でも `P_Deleted` は **Field Type 欄・Data Type 欄とも「ー」**である。

### ここが制約になる

[ADR-0016][adr16] は **案B（PORTERS Data Type に整合）**で accepted 済みで、こう定めている。

> Data Type は **PORTERS 自身が定義する「値の形」**であり、**独自の粒度を発明せず忠実**。
> （中略）**PORTERS がしない区別は発明しない**。**型ラベルは Data Type に一致**させる。

そして [ADR-0019][adr19] のカタログは **alias → Data Type** の対応で、
**公開型（Read 型・Write 入力型）も能力（書ける / 並べ替えられる / 条件に使える）も
すべてそこから導出**される。

つまり **カタログに載せるには型ラベルが要るのに、PORTERS はこの項目に Data Type を与えていない**。
ここが本 ADR の核心で、選択肢は 3 つに絞られる —
**(a) 型を発明する**（[ADR-0016][adr16] 違反・不可）、**(b) 載せない**（機能が半分のまま）、
**(c) 「型が無い」ことを記録する**（正典の「ー」を写す）。

### 「ー」には 2 種類ある

Data Type が「ー」の項目は 2 系統あり、**理由が違う**。

|                              | Data Type | 理由                                                         | いまの扱い                  |
| ---------------------------- | --------- | ------------------------------------------------------------ | --------------------------- |
| `Reference`（Field Type 16） | ー        | 「**当該項目自体にデータを持つことはありません**」（原記事） | カタログ外（正しい）        |
| `P_Deleted`                  | ー        | **値は持つ**（0/1）が、PORTERS が型を割り当てていない        | カタログ外（本 ADR の論点） |

現在の突合テスト（[RV-29][rv29]）は両者をまとめて `NOT_IN_CATALOG` で除外している。
`Reference` は正しい除外だが、`P_Deleted` は**値を持つのに除外されている**点が違う。

## Decision Drivers

- **機能を半分で終わらせない** — 削除済みを読めるなら、どれが削除済みかも分かるべき
- **PORTERS が定義しないものを発明しない**（[ADR-0016][adr16] 案B）。**Data Type の捏造は不可**
- **型が実挙動を正確に表す**（[ADR-0005][adr5] SD-3）。PORTERS が拒否する組み合わせを型が通さない
- **カタログの形を軽々に変えない**（[ADR-0019][adr19]：alias → Data Type が全型導出の土台）
- **1 項目のために土台を作り直さない**（費用対効果）

## 撤回した案: 新しい Data Type の導入

起票時は **`System[Deleted]` という Data Type を足す**案を推奨していた。
既存の型機構（`ConditionFor` の `never` フォールバック・`OrderableKeys` の絞り込み）が
そのまま condition / order を禁じるため、実装が軽いという理由だった。

**これは [ADR-0016][adr16] 案B に正面から違反する。** PORTERS の Data Type 列挙に
`Deleted` は無く、`System[…]` の 4 種にも含まれない。`System[…]` という命名を借りることで
**PORTERS が定義した型に見せてしまう**害もある。名前を `DeletedFlag` 等に変えても、
**PORTERS が与えていない Data Type を発明する**という一点は変わらないので、改名では直らない。

> **同じ誤りを [ADR-0055][adr55] の直後に犯した**。あちらの核心は「ライブラリが正典に無い値を
> 捏造してはいけない（`partition=0` はその違反）」だった。記録として残す。

## Considered Options

- **案A: 型付けせず、2 回呼ぶ運用を文書化する** — `itemstate: "deleted"` と `"existing"` を
  別々に呼べば、**どちらの呼び出しで返ったか**で削除状態が分かる。カタログは触らない。
- **案B: 「Data Type を持たない」ことをカタログに記録する** — `FieldCatalog` の値を
  `DataType | null` に広げ、`P_Deleted: null` と置く。**正典の「ー」をそのまま写す**。
- **案C: カタログ外の専用サーフェス** — 例 `search({ withDeletedFlag: true })` が
  型付きレコードとは別枠で削除状態を返す。
- **案D: `Number` として載せる** — PORTERS が割り当てていない Data Type を**こちらで決める**。
- **案E: 現状維持（wontfix）** — 何もしない。

## Decision Outcome

> **未決（proposed）**。以下は起票者の推奨であり、決定は decider が行う。

**推奨: 案B**（`FieldCatalog` の値を `DataType | null` に広げ、`P_Deleted: null` と記録する）。

```ts
export type FieldCatalog = Record<string, DataType | null>;

const FIELDS = {
  P_Id: "System[Id]",
  // …
  P_Deleted: null, // PORTERS が Data Type を与えていない（reference の「ー」）
} as const satisfies FieldCatalog;
```

### なぜこれが「発明」にならないか

`null` は**新しい Data Type ではない**。「**PORTERS がこの項目に Data Type を割り当てていない**」という
**正典に書いてある事実**を、そのまま記録するための不在マーカーである。
[ADR-0016][adr16] 案B が禁じたのは「PORTERS がしない区別を発明すること」で、
**PORTERS がしている区別（型がある / ない）を写すこと**はむしろその趣旨に沿う。

### 型機構がそのまま制約を表現する（実測）

公開型の導出は**すべて `keyof F` で回っている** — `ReadRecord` / `WritableKeys` /
`Condition` / `OrderableKeys` のいずれも、カタログのキーと値から導かれる。
値に `null` を置くと、PORTERS が課す 3 つの制約が**追加実装なしで**型に現れる。

| 機構                 | `null` に対する挙動                             | 追加作業                         |
| -------------------- | ----------------------------------------------- | -------------------------------- |
| `ConditionFor<null>` | 分岐末尾の `never` に落ちる                     | **なし**（condition が型エラー） |
| `OrderableKeys`      | `null extends OrderableDataType` = false → 除外 | **なし**（order が型エラー）     |
| `WritableKeys`       | `null extends WritableDataType` = false → 除外  | **なし**（Write 入力型に出ない） |
| `decoderFor`         | 未知 alias を**生の文字列**で通す実装が既にある | ほぼなし                         |
| `DecodedValue`       | 分岐末尾が `: string`                           | **1 分岐足すだけ**               |

**reference が「Read の field でのみ指定可・Condition/Order 不可・Write 不可」と定める 3 つの制約が、
`null` を置くだけで型で守られる。**

### 起票時の見積もりは誤りだった

本 ADR は当初、案B を「[ADR-0019][adr19] の改訂＝**全リソースの型導出を作り直す**」と評価して
退けていた。**これは事実誤認**である。実際に必要なのは
**型ラベルの union を 1 つ広げること**で、カタログの形（`alias → 型ラベル`）は変わらない。
[ADR-0019][adr19] の改訂は不要。

### 案A を次善として残す

案A（2 回呼ぶ運用の文書化）は**コード変更ゼロ**で機能を回復させる。
ただし 1 往復にはできず、型付きレコードにも現れず、突合テスト（[RV-29][rv29]）の
対象外のままになる。**案B のコストが小さいと分かった以上、案A を選ぶ理由は弱い。**

案C は「カタログ＝標準項目の真実源」の外に項目を置く。案D は**型が嘘をつく**
（PORTERS が拒否する condition / order を型が通す）。案E は回避策すら示さない。

### 実施時の合意事項（accept 後の別 PR）

1. **`FieldCatalog` の値を `DataType | null` に広げる**（`src/resources/read-core.ts`）。
   `null` の意味は「**PORTERS が Data Type を与えていない**」であり、
   **「未設定」や「不明」ではない**ことをコメントで明記する。
2. **`DecodedValue` に `null` の分岐**を足す（`src/xml/decode.ts`）。値は **生の文字列**。
   `decodeField` は `null` を受けたら raw をそのまま返す（未知 alias の既存フォールバックと同じ扱い）。
3. **`Map<string, DataType>` を `| null` に**する（`read-core` / `resource` / `query` /
   `bulk-write` / `encode` の計 8 箇所）。
4. **5 リソースのカタログに `P_Deleted: null` を追加**する。
   `defaultFieldList` は全 alias を送るので、`field` 省略時に自動で要求される。
5. **`defineFields` は対象外**。`CustomDataType` に `null` を足さない
   （テナントのカスタム項目には PORTERS が必ず Data Type を与えるため）。
6. **突合テストを更新**（`test/integration/reference-catalog.test.ts`）。
   `NOT_IN_CATALOG` から **`ー` を外し**、`P_Deleted` を「カタログにあるべき項目」として検査する。
   `Reference` は**値を持たない**ので除外のまま — **除外理由が違う**ことをコメントで書き分ける。
   Field Type → Data Type の写像検査では `ー` → `null` を対応させる。
7. **フェイクサーバーで往復を確認**する。descriptor 由来なので反映は自動だが、
   `itemstate` に応じて `P_Deleted` が変わることを L1 で pin する。
8. **[Read クエリ ガイド][rq]の注記を書き換える**。現在「どれが削除済みかは判別できない（RV-26）」と
   書いてあるので、**`P_Deleted` で判別できる**ことと、**値が `"0"` / `"1"` の文字列**であること、
   **condition / order には使えない**ことを書く。
9. **LV-14 を登録**する（下記）。decode 側に `VERIFY(live)` を置く。
10. **semver は minor**（公開型に項目が増える。既存コードへの影響なし）。

### 新しく登録する LV

**LV-14: `P_Deleted` の wire 形と出現条件**。確認すべきは 3 点。

1. `field` に含めたとき、応答に `<Person.P_Deleted>0</Person.P_Deleted>` の形で入るか。
2. **`itemstate` を省略（`existing`）したときも取得できるか**、`deleted` / `all` のときだけか。
3. 値が **`0` / `1` 以外を取りうるか**（reference は 2 値と明記だが実測で確かめる）。

### Consequences

- Good: **1 往復で削除状態が分かる**（`itemstate: "all"` が実用になる）。型付きレコードに現れ、
  **condition / order / write は型で禁じられる**。カタログが標準項目の真実源であるという性質を保ち、
  突合テスト（[RV-29][rv29]）の対象に入る。PORTERS が定義しない型を発明しない。
- Bad: **値は `string`（`"0"` / `"1"`）**になる。Data Type が無いので decode の基準も無く、
  `number` / `boolean` へ変換するのは**こちらで決めること**＝小さいながら発明になるため避けた。
  利用者は `rec.P_Deleted === "1"` と書く。
  **wire 形が未確認のまま実装する**（LV-14）。外れたら decode の分岐を直すことになる。
- Neutral: `FieldCatalog` の値に `null` が入りうる形になる。
  同種の項目（値を持つが PORTERS が型を与えていない）が今後現れても、同じ表現で載せられる。

## Pros and Cons of the Options

### 案A: 型付けせず 2 回呼ぶ運用を文書化（次善）

- Good: Data Type を発明しない。カタログの形を変えない。**機能は回復する**。コード変更ゼロ。
- Bad: 1 往復にはできない。型に現れないのでドキュメント依存。

### 案B: `DataType | null` で「型が無い」ことを記録（推奨）

- Good: 正典の「ー」をそのまま写すので**発明にならない**。導出が `keyof F` で回っているため
  **condition / order / write の禁止が追加実装なしで**型に現れる。1 往復で判別でき、
  突合テストの対象にも入る。[ADR-0019][adr19] の改訂は不要。
- Bad: 値が `string` になる（Data Type が無いので decode の基準も無い）。
  `FieldCatalog` の値に `null` が入りうる形になり、`Map<string, DataType>` の宣言を 8 箇所直す。
  wire 形は未確認のまま（LV-14）。

### 案C: カタログ外の専用サーフェス

- Good: カタログを触らない。
- Bad: 「カタログ＝標準項目の真実源」の外に項目を置く（[RV-29][rv29] の突合対象からも外れる）。
  公開 API が増え、`search` と使い分けが要る。

### 案D: `Number` として載せる

- Good: 変更が最小（カタログに 1 行）。型付きレコードに現れる。
- Bad: **PORTERS が割り当てていない Data Type をこちらで決める**（[ADR-0016][adr16] 違反）。
  さらに condition / order が型で許され、**PORTERS が拒否する組み合わせを型が通す**。

### 案E: 現状維持（wontfix）

- Good: 何もしなくてよい。
- Bad: 回避策すら示さないので、`itemstate: "all"` を使った利用者は自力で気づくしかない。

## More Information

- 起票元: [findings RV-26][rv26]。
- Data Type が PORTERS の用語であり、ライブラリがそれに整合させる決定: [ADR-0016][adr16] 案B。
  一次情報は [Field Type & Data Type List][fdt-src]（`tmp/porters-docs/txt/115008017407-…` に取得済み）。
- カタログが型導出の土台であること: [ADR-0019][adr19]。標準項目の真実源であること:
  [RV-23][rv23]（欠落）・[RV-29][rv29]（突合の自動化）。
- `itemstate` の実装: [ADR-0038][adr38]（F-2）。削除 API が無いこと自体は `CLAUDE.md` の前提。
- 同じ「捏造しない」原則を扱った直近の決定: [ADR-0055][adr55]（`partition=0` の廃止）。

[adr5]: 0005-public-api-shape.md
[adr16]: 0016-field-type-granularity.md
[adr19]: 0019-static-resource-types.md
[adr38]: 0038-read-query-surface-impl.md
[adr55]: 0055-partition-binding-guard.md
[fdt-src]: https://hrbcapi.porters.jp/hc/ja/articles/115008017407-Field-Type-Data-Type-List
[rq]: ../guide/read-query.md
[rv23]: ../reviews/rv/0023-candidate-catalog-missing-fields.md
[rv26]: ../reviews/rv/0026-deleted-flag-unsupported.md
[rv29]: ../reviews/rv/0029-reference-catalog-check-missing.md
