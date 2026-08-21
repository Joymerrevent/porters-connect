# 56. `P_Deleted`（削除フラグ）の型付け

- Status: proposed
- Date: 2026-08-21
- Deciders: jun.shiromoto (Joymerrevent)

> [findings RV-26][rv26] の是正案。F-2（[ADR-0038][adr38]）で `itemstate: "deleted" | "all"` を実装したが、
> **削除状態を表す `P_Deleted` がカタログに無い**ため、`"all"` で読んだときに
> どれが削除済みかを利用者が判別できない。
> 決定は decider が行う（自己 accept しない）。実施は accept 後の別 PR。

## Context and Problem Statement

**PORTERS に削除 API は無い**。`itemstate` は削除済みレコードを読む唯一の手段で、
`"all"` は**生存と削除済みを混ぜて**返す（[ADR-0038][adr38]）。
ところが削除状態を表す標準項目 **`P_Deleted` が全リソースのカタログに無い**ため、
**返ってきたレコードのどれが削除済みかが分からない**。削除済みを読む手段だけがあって、
**結果を解釈する手段が無い**状態になっている。

### `P_Deleted` は「他の項目に無い制約」を持つ

reference（各リソースの項目表）の備考が、この項目だけ 3 つの制約を課している。

- 値は **0：削除されていないレコード / 1：削除済みのレコード**
- **Read 時の field Parameter としてのみ指定可能**。**Condition や Order に指定することはできない**
- **Write 時の指定はできない**
- （2018/04/10 より利用可能）

全データリソース（Candidate / Job / Client / Process / Resume）に同じ形で存在する。

### なぜカタログにそのまま足せないか

[ADR-0019][adr19] のカタログは **alias → Data Type** の対応で、
**能力（書ける / 並べ替えられる / 条件に使える）はすべて Data Type から導出**される。

- 書けるか: `WritableDataType`（`System[Id]` / `System[DateTime]` を除外）
- 並べ替えられるか: `OrderableDataType`（数値・日時・System のみ）
- 条件に使えるか: `ConditionFor<D>`（Data Type ごとの演算子オブジェクト）

`P_Deleted` の制約は**この項目固有**であり、Data Type（reference の Field Type 欄は「ー」）から
は導けない。**`Number` として足すと condition / order が型で許されてしまい**、
実際には PORTERS が拒否する組み合わせを型が通してしまう。

### 実測: 型機構は「知らない Data Type」を自動で締め出す

`ConditionFor<D>` は分岐の末尾が **`never`** で、`OrderableKeys<F>` は
`F[K] extends OrderableDataType` で絞り込む。つまり **DataType に新しい値を足すと、
condition と order は何もしなくても型エラーになる**（`src/resources/query.ts:62-76, 93-95` を確認）。
Write だけは `WritableDataType` の `Exclude` に 1 行足す必要がある。

## Decision Drivers

- **機能を半分で終わらせない** — 削除済みを読めるなら、どれが削除済みかも分かるべき
- **型が実挙動を正確に表す**（[ADR-0005][adr5] SD-3）。PORTERS が拒否する組み合わせを型が通さない
- **カタログの単純さを保つ**（[ADR-0019][adr19]：alias → Data Type の 1 対 1）
- **仮定を仮定として扱う**（[ADR-0002][adr2]）。未確認の wire 形は [live-verification][lv] に登録する
- **フェイルセーフ**: 値の意味を取り違えるくらいなら、生の値に近い形で渡す

## Considered Options

### 軸1: カタログへの載せ方

- **案1a: 新しい Data Type `System[Deleted]` を導入**する。既存の能力導出機構
  （`ConditionFor` / `OrderableKeys` / `WritableDataType`）が**そのまま制約を表現**する。
- **案1b: カタログを「alias → { type, 能力マーク }」に拡張**し、項目ごとに read-only 等を持たせる。
- **案1c: カタログに載せず、専用の口を作る**（例: `search({ withDeletedFlag: true })` が別枠で返す）。
- **案1d: `Number` として載せる**。condition / order は型で許されるが、実行時は PORTERS が拒否する。

### 軸2: 読み取り値の形

- **案2a: `number`**（`0` / `1` をそのまま）。
- **案2b: `boolean`**（`"1"` → `true`）。

### 軸3: 実装するか、契約後まで待つか

- **案3a: いま実装し、未確認の wire 形は LV に登録**する。
- **案3b: 契約取得まで保留**（LV だけ登録して実装しない）。

## Decision Outcome

> **未決（proposed）**。以下は起票者の推奨であり、決定は decider が行う。

**推奨: 案1a ＋ 案2a ＋ 案3a**。

`DataType` に **`System[Deleted]`** を追加し、値は **`number`** で読み、
**wire 形の未確認部分は LV-14 として登録**する。

理由:

- **案1a**: [ADR-0019][adr19] の「能力は Data Type から導出する」という設計を**変えずに**、
  `P_Deleted` 固有の制約を表現できる。実測のとおり **condition と order は自動的に型エラー**になり、
  Write は `WritableDataType` の `Exclude` に 1 行足すだけ。`System[…]` という命名も
  「システムが管理し、利用者は書けない」という既存の含意（`System[Id]` / `System[DateTime]`）と揃う。
  - 案1b はカタログの形自体を変えるため [ADR-0019][adr19] の改訂が要り、
    **1 項目のために全リソースの型導出を作り直す**ことになる。
  - 案1c は「カタログが標準項目の真実源」（[RV-23][rv23] / [RV-29][rv29] で守った性質）を崩す。
    突合テストの対象外にもなり、**同じ取りこぼしを再び作る**。
  - 案1d は**型が嘘をつく**（PORTERS が拒否する組み合わせを型が通す）。[ADR-0005][adr5] SD-3 に反する。
- **案2a（`number`）**: `boolean` のほうが DX は良いが、**未知の値を静かに潰す**。
  `"1"` 以外を `false` にすると、**素性の分からない値が「削除されていない」として通る** —
  これは本 finding が塞ごうとしている「区別できない」問題と同じ形の失敗になる。
  reference は 0/1 と明記しているが、それは**未確認の仮定**（下記 LV）であり、
  仮定が外れたときに**気づける形**で持つほうがフェイルセーフ。
  `boolean` へ寄せるのは LV で wire 形が確定してからでも遅くない（追加は非破壊）。
- **案3a**: reference が**値の意味・使える場所・使えない場所を明記**しており、
  型付けに必要な情報は揃っている。未確認なのは wire 形の細部だけで、
  **契約を待つ理由にならない**（待つと機能が半分のまま残る）。

### 新しく登録する LV

**LV-14: `P_Deleted` の wire 形と出現条件**。確認すべきは 3 点。

1. `field` に明示したとき、応答に `<Person.P_Deleted>0</Person.P_Deleted>` の形で入るか
   （他の値型と同じ素の文字列か、入れ子か）。
2. **`itemstate` を省略（`existing`）したときも取得できるか**、`deleted` / `all` のときだけか。
3. 値が **`0` / `1` 以外を取りうるか**（reference は 2 値と明記だが実測で確かめる）。

### 実施時の合意事項（accept 後の別 PR）

1. **`DataType` に `System[Deleted]` を追加**（`src/xml/decode.ts`）。
   `DecodedValue` に `number` の分岐を足す（`System[Id]` / `Number` と同じ扱い）。
2. **`WritableDataType` の `Exclude` に加える**（`src/xml/encode.ts`）。Write 入力型に出さない。
3. **condition / order は何もしない** — `ConditionFor` の `never` と `OrderableKeys` の絞り込みで
   自動的に型エラーになる。**そのことをテストで pin する**（将来の改変で漏れないように）。
4. **5 リソースのカタログに `P_Deleted` を追加**する。
   [RV-29][rv29] の突合テストの除外リスト（`NOT_IN_CATALOG`）から `ー` を外し、
   **`P_Deleted` を「あるべき項目」として検査**する側へ移す。
5. **`defineFields` の対象外**。カスタム項目に `System[…]` は宣言させない（[ADR-0023][adr23] D3 のまま）。
6. **フェイクサーバーに反映**する（descriptor 由来なので自動だが、
   `itemstate` の応答で `P_Deleted` が正しく変わることを L1 で確認する）。
7. **[Read クエリ ガイド][rq]の注記を更新**。現在「どれが削除済みかは判別できない（RV-26）」と
   書いてあるので、判別できるようになったことと **`condition` / `order` には使えない**ことを書く。
8. **LV-14 を登録**し、`VERIFY(live)` を decode 側に置く。
9. **semver は minor**（公開型に項目が増える。既存コードへの影響なし）。

### Consequences

- Good: `itemstate: "all"` の結果を**利用者が解釈できる**ようになる（機能が半分で終わらない）。
  PORTERS が拒否する組み合わせ（condition / order / write）が**型で防がれる**。
  カタログが標準項目の真実源であるという性質を保てる（突合テストの対象に入る）。
- Bad: `DataType` に 1 つ値が増える（内部型だが、`CustomDataType` との差が広がる）。
  **wire 形が未確認のまま実装**する（LV-14）。外れたら decode の分岐を直すことになる。
- Neutral: 値が `number` なので `deleted === 1` と書くことになる。
  `boolean` に寄せたくなったら LV-14 の確定後に非破壊で足せる。

## Pros and Cons of the Options

### 案1a: 新しい Data Type（推奨）

- Good: 既存の能力導出機構がそのまま効く（condition / order は**自動で**型エラー）。
  カタログの形も [ADR-0019][adr19] のまま。`System[…]` の命名も含意と揃う。
- Bad: `DataType` に「1 項目のためだけの値」が増える。

### 案1b: カタログに能力マークを持たせる

- Good: 項目ごとの制約を一般的に表現できる（将来ほかにも出てきたら効く）。
- Bad: [ADR-0019][adr19] の改訂が要り、全リソースの型導出を作り直す。**1 項目には過剰**。

### 案1c: カタログに載せず専用の口

- Good: カタログを汚さない。
- Bad: 「カタログ＝標準項目の真実源」を崩し、[RV-29][rv29] の突合テストの外に出る＝
  **同じ取りこぼしを再び作る**。公開 API も一つ増える。

### 案1d: `Number` として載せる

- Good: 変更が最小（カタログに 1 行）。
- Bad: **型が嘘をつく** — PORTERS が拒否する condition / order を型が通す。

### 案2a: `number`（推奨）

- Good: 未知の値を潰さない。仮定が外れたときに気づける。
- Bad: `deleted === 1` は `deleted === true` より読みにくい。

### 案2b: `boolean`

- Good: DX が良い。
- Bad: `"1"` 以外を静かに `false` にする＝**素性の分からない値が「削除されていない」として通る**。
  本 finding が塞ごうとしている失敗と同じ形。

### 案3b: 契約取得まで保留

- Good: 仮定の上に実装しない。
- Bad: 型付けに必要な情報（値の意味・使える場所）は reference に揃っており、**待つ理由が弱い**。
  その間 `itemstate` は半分の機能のまま。

## More Information

- 起票元: [findings RV-26][rv26]。
- `itemstate` の実装: [ADR-0038][adr38]（F-2）。削除 API が無いこと自体は `CLAUDE.md` の前提。
- カタログが能力の導出元であること: [ADR-0019][adr19]・[ADR-0016][adr16]（Data Type の粒度）。
- カタログが標準項目の真実源であること: [RV-23][rv23]（欠落）・[RV-29][rv29]（突合の自動化）。
- 仮定の扱い: [ADR-0002][adr2]（実 API ドキュメントへの接地）・[live-verification][lv]。

[adr2]: 0002-ground-design-in-live-api-docs.md
[adr5]: 0005-public-api-shape.md
[adr16]: 0016-field-type-granularity.md
[adr19]: 0019-static-resource-types.md
[adr23]: 0023-custom-field-declaration-dsl.md
[adr38]: 0038-read-query-surface-impl.md
[lv]: ../live-verification.md
[rq]: ../guide/read-query.md
[rv23]: ../reviews/rv/0023-candidate-catalog-missing-fields.md
[rv26]: ../reviews/rv/0026-deleted-flag-unsupported.md
[rv29]: ../reviews/rv/0029-reference-catalog-check-missing.md
