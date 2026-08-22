# 56. `P_Deleted`（削除フラグ）の扱い

- Status: proposed
- Date: 2026-08-21
- Deciders: jun.shiromoto (Joymerrevent)

> [findings RV-26][rv26] の是正案。F-2（[ADR-0038][adr38]）で `itemstate: "deleted" | "all"` を実装したが、
> **削除状態を表す `P_Deleted` がカタログに無い**ため、`"all"` で読んだときに
> どれが削除済みかを利用者が判別できない。
> 決定は decider が行う（自己 accept しない）。実施は accept 後の別 PR。
>
> **起票時の推奨（新しい Data Type `System[Deleted]` の導入）は撤回した**。
> [ADR-0016][adr16] 案B に違反しており、そもそも選択肢として不成立だった（下記「撤回した案」）。

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

つまり **カタログに載せるには Data Type が要り、PORTERS はそれを与えていない**。
ここが本 ADR の核心。

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
- **案B: カタログの形を拡張する** — `alias → Data Type` を `alias → { dataType, capabilities }` に変え、
  **Data Type を持たない項目**と**項目ごとの能力**（read-only 等）を表現できるようにする。
  [ADR-0019][adr19] の改訂を伴う。
- **案C: カタログ外の専用サーフェス** — 例 `search({ withDeletedFlag: true })` が
  型付きレコードとは別枠で削除状態を返す。
- **案D: `Number` として載せる** — PORTERS が割り当てていない Data Type を**こちらで決める**。
- **案E: 現状維持（wontfix）** — 何もしない。

## Decision Outcome

> **未決（proposed）**。以下は起票者の推奨であり、決定は decider が行う。

**推奨: 案A**（型付けせず、2 回呼ぶ運用を文書化する）。

```ts
// 削除済みだけ
const deleted = await t.candidate.search({ itemstate: "deleted" });
// 生存だけ
const existing = await t.candidate.search({ itemstate: "existing" });
```

**どちらの呼び出しで返ったかが削除状態そのもの**なので、`P_Deleted` が無くても判別できる。
失うのは「1 往復で両方を取れる」ことだけで、機能としては回復する。

理由:

- **PORTERS が Data Type を与えていない以上、カタログに載せる正当な方法が無い**。
  載せるには (a) Data Type を発明する（[ADR-0016][adr16] 違反）か
  (b) カタログの形を変える（[ADR-0019][adr19] 改訂）しかない。
  (a) は不可。(b) は**全リソースの型導出の土台を 1 項目のために作り直す**ことになり、費用対効果が悪い。
- **回避策が本物**。二度呼びは「削除済みかどうか」を**確実に**与える（推測ではない）。
  型を足さずに機能が回復するなら、土台を触る理由は弱い。
- **`itemstate: "all"` の位置づけがはっきりする**。1 往復で済ませたいときの選択肢であり、
  **混ざった結果を区別する必要があるなら 2 回呼ぶ**、と文書で示せばよい。
- 案C は「カタログ＝標準項目の真実源」（[RV-23][rv23] / [RV-29][rv29] で守った性質）の外に
  項目を置くことになり、公開 API も増える。案D は**型が嘘をつく**
  （PORTERS が拒否する condition / order を型が通す）。
  案E は回避策すら示さないので、利用者は自力で気づくしかない。

### 再検討の条件（いつ案B に進むか）

本決定は「**いまは土台を変えない**」であって、「永久に型付けしない」ではない。
次のいずれかが起きたら [ADR-0019][adr19] の改訂として再検討する。

- **同種の項目が増えたとき** — 「値を持つが PORTERS が Data Type を与えていない」項目が
  `P_Deleted` 以外にも現れたら、1 項目のための例外ではなくなる。
- **2 回呼ぶ運用で困る事例が出たとき** — 大量データで往復コストが問題になる、
  2 回の呼び出しの間の変更（レース）が実害になる、など。
- **契約後に wire 形が確定し、`P_Deleted` の扱いが軽くなったとき**。

### 実施時の合意事項（accept 後の別 PR）

1. **[Read クエリ ガイド][rq]の注記を書き換える**。現在「どれが削除済みかは判別できない（RV-26）」と
   書いてあるので、**2 回呼ぶ運用を正式な手順として示す**（コード例つき）。
   `"all"` は「1 往復で済ませたいが区別が要らない」場合の選択肢だと位置づける。
2. **`itemstate` の JSDoc にも同じ趣旨を 1〜2 行**入れる（`src/resources/query.ts`）。
3. **突合テストのコメントを更新**（`test/integration/reference-catalog.test.ts`）。
   `NOT_IN_CATALOG` の `ー` について「RV-26 の論点で、決まるまでは対象外」と書いてあるので、
   **本 ADR で「PORTERS が Data Type を与えていないため載せない」と決まった**ことと、
   `Reference` とは除外理由が違うことを書き分ける。
4. **LV は追加しない**。実装が `P_Deleted` に依存しないので、確認すべき仮定が無い。
   再検討する段になったら wire 形（出現条件・値域）を確認する、と本 ADR に残すに留める。
5. **コード変更なし**（ドキュメントとコメントのみ）。semver 影響なし。

### Consequences

- Good: PORTERS が定義しない型を発明せずに済む（[ADR-0016][adr16] を守る）。
  カタログの形（[ADR-0019][adr19]）に手を入れない。**利用者は削除状態を確実に判別できる**ようになる。
- Bad: **1 往復では区別できない**まま（2 回呼ぶ必要がある）。
  型付きレコードに削除状態が現れないので、**ドキュメントを読まないと回避策に気づけない**。
  `itemstate: "all"` の使いどころが狭い。
- Neutral: [RV-26][rv26] は「型付けしない」という決定で閉じる（`wontfix` ではなく
  **決定にもとづく `fixed`** ＝ ドキュメントで機能を回復させる）。土台の改訂は将来へ残す。

## Pros and Cons of the Options

### 案A: 型付けせず 2 回呼ぶ運用を文書化（推奨）

- Good: Data Type を発明しない。カタログの形を変えない。**機能は回復する**。コード変更ゼロ。
- Bad: 1 往復にはできない。型に現れないのでドキュメント依存。

### 案B: カタログの形を拡張（`alias → { dataType, capabilities }`）

- Good: 「値を持つが Data Type が無い項目」と「項目ごとの能力」を**一般的に**表現できる。
  型付きレコードに `P_Deleted` が現れ、condition / order も型で禁じられる。
- Bad: [ADR-0019][adr19] の改訂＝**全リソースの型導出を作り直す**。1 項目には過剰。
  カタログの単純さ（alias → Data Type）という長所を失う。

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
