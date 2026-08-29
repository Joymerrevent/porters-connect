# 58. `System[Reference]` を展開して読むときの扱い

- Status: accepted
- Date: 2026-08-23
- Deciders: jun.shiromoto (Joymerrevent)

> [RV-31][rv31] の ADR。PORTERS の Read は `field` の alias に `()` を付けると
> **上位 Resource の項目を入れ子で返す**。ライブラリはその入れ子から **ID だけを取り出して残りを捨てる**ため、
> 利用者が `Job.P_Client(Client.P_Id,Client.P_Name)` と**明示的に要求しても `Client.P_Name` は返らない**。
> 例外も型エラーも出ないので、気づく手がかりが無い。
>
> **案D で `accepted`（2026-08-29）**: **型付きの `expand` オプション**で展開を返せるようにし、
> **型の付かない raw `field` に書かれた展開はガードで弾いて `expand` へ誘導する**。
> 軸は **PORTERS ができることをライブラリが落とさない**こと — 黙って捨てるのをやめるだけでなく、
> **要求されたものを返せるようにする**。**[LV-16][lv16] を登録する**（Candidate 参照を展開するときの
> alias 接頭辞が未確認）。実施は本 ADR とは別 PR。

## Context and Problem Statement

### 正典が言っていること

`System[Reference]`（Field Type 11）は「関連する上位 Resource」を表す型で、**Read だけが展開できる**。

- [Field Type & Data Type List][fdt]（FT-11）:
  「Read の場合、Read API - Parameter > Read - Field に従って指定することで、**上位 Resource の Field を参照することができます**。
  Write の場合、上位 Resource の `{Resource}.P_Id` の値のみを指定することができます」
- [Read API - Parameter][rparam]（Read - Field）:
  `field=[Field Alias]([Field Alias],[Field Alias]...)` ／ 例 `field=Job.P_Client(Client.P_Id,Client.P_Name)` ／
  **「`()` の値を指定しない場合、上位 Resource の ID のみが出力されます」**
- [Read API - XML Format][rxml]（Data Type: System[Reference] & User）: 展開したときの wire 形は入れ子。

```xml
<Job.P_Client>
  <Client>
    <Client.P_Id>500</Client.P_Id>
    <Client.P_Name>Acme</Client.P_Name>
  </Client>
</Job.P_Client>
```

つまり **`()` の有無で返る形が変わる**（ID のみ ↔ 入れ子）。同じ仕組みが `User` 型にもあり、
そちらは参照できる項目が `User.P_Id` / `P_Type` / `P_Name` / `P_Mail` の **4 つに固定**されている。

### いまの実装

| 場所                                  | いまの挙動                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `SearchQuery.field`（`query.ts:133`） | `string[]`。**中身は解釈せずそのまま送る**                                               |
| 既定 field（`resource.ts:130`）       | カタログ由来。**`User` だけ 4 サブ項目に展開**し、`System[Reference]` は `()` を付けない |
| `decodeReference`（`decode.ts:99`）   | 入れ子の**最初の record 値の子**から `{Tag}.P_Id` を読んで `number` を返す。他は見ない   |
| 型（`decode.ts:46`）                  | `DecodedValue<"System[Reference]"> = number`                                             |

**既定経路は正しい**。`()` を付けずに送る → PORTERS は ID のみ返す → `number` と一致する（[ADR-0020][adr20] の設計どおり）。
壊れるのは**利用者が自分で展開形を書いたときだけ**で、そのときライブラリは
「要求は素通しする・応答は捨てる」という非対称な振る舞いをする。

### どこまで影響するか

カタログ上の `System[Reference]` は **8 項目 / 3 リソース**（`grep` 実測）。

| リソース | 項目                                                              | 参照先                                        |
| -------- | ----------------------------------------------------------------- | --------------------------------------------- |
| Job      | `P_Client` / `P_Recruiter`                                        | Client / Recruiter                            |
| Process  | `P_Client` / `P_Recruiter` / `P_Job` / `P_Candidate` / `P_Resume` | Client / Recruiter / Job / Candidate / Resume |
| Resume   | `P_Candidate`                                                     | Candidate                                     |

参照先 5 種のうち **Recruiter は未実装リソース**（[2026-08-16 の棚卸し][run816] (a) 参照）。
また **Candidate の alias 接頭辞は `Person`**（`candidate.ts:64`）で、Field Type 記事も
「Write の場合、`Person.P_Id` の値のみを指定することができます」と書く。
**`{参照先リソース名}.{alias}` という素朴な組み立ては Candidate で外れる**。

### 決めるべきこと

展開を **(1) 型と値で表現する**のか、**(2) 送信前に弾く**のか、**(3) 現状のまま文書化する**のか。

## Decision Drivers

- **黙って捨てない**。要求と結果の食い違いは表に出す（フェイルセーフ）。[RV-1][rv1]（`field` 省略時に主キーしか返らない）と
  同系統の失敗で、あちらは既定経路だったので 🔴、本件は明示指定時のみなので 🟡。
- **忠実性**（[ADR-0016][adr16]）。PORTERS ができることを理由なく削らない。
- **型が実挙動を表す**。[ADR-0005][adr5] **SD-3 は「簡易」**＝ `field` の選択で戻り型を変えないと決めている。
  ここを崩すかどうかが本 ADR の分かれ目。
- **既存利用者のコスト**。いま `P_Client` は `number | null` として素直に読める。8 項目すべてに narrowing を強いる変更は、
  展開を使わない大多数に税を課す。
- **持っていない情報を発明しない**（[ADR-0056][adr56] の教訓）。カタログは **alias → Data Type** しか持たず、
  **参照先リソースを知らない**。展開値を Data Type で解くには、参照先を**どこかに正しく持つ**必要がある。
- **実機未確認の範囲を正しく見積もる**。入れ子タグの literal（`<Client>` か等）は **[LV-10][lv] が未確認**。
  ただし **decode 側はタグ名に依存せずに書ける** — 現行 `decodeReference` は**最初の record 値の子**を見るだけで、
  `bareAlias`（`read-core.ts:68`）が接頭辞を剥がす。**本当に未確認なのは要求側の接頭辞**、すなわち
  Candidate 参照を `Person.P_Id` と書くのか `Candidate.P_Id` と書くのか。
  フェイク（`test/fake/wire.ts:148`）は `sub` を無視して中立な `<Reference><P_Id>` を返すので、展開を扱うなら直す。

## Considered Options

- **案A**: 現状維持 ＋ 文書化（[Read クエリ ガイド][rq]に「`System[Reference]` は ID のみ返る」と明記）
- **案B**: 展開要求を**送信前に弾く**（`PortersConfigError`）
- **案C**: 返ってきた入れ子を**そのまま返す**（読み取り型を `number | 参照レコード` に広げる）
- **案D**: **型付きの `expand` オプション**を足す（採用。生の `field` に書かれた展開は案B のガードで `expand` へ誘導）

## Decision Outcome

**採用: 案D**（型付きの `expand` オプション）＋ **raw `field` に書かれた展開は弾く**
（案B のガードを案D の内側に置く。decider 判断・2026-08-29）。

判断の軸は **PORTERS ができることをライブラリが落とさない**こと。`System[Reference]` の展開は
reference が例まで載せている正規の機能で、**これを恒久的に使えなくする案（案A / 案B 単独）は
薄いラッパーの立場と合わない**（[ADR-0016][adr16] の忠実性・「多くの実利用者に使われること」）。
黙って捨てるのをやめるだけでなく、**要求されたものを返せるようにする**。

**返す方向の 2 案のうち案D を採る理由**は 3 つ。

1. **案C は「案D のコストの大半を払って、案D の利得を得ない」形になる**。入れ子をそのまま返すだけでは
   参照先カタログを知らないので**中身は生の文字列**（日付が ISO に正規化されない・Option が配列にならない）。
   忠実に見えて忠実でない。忠実にするには参照先の解決が要り、それは案D の中心作業そのもの。
2. **税を払う人が違う**。案C は `DecodedValue<"System[Reference]">` を union に広げるため、
   展開を使わない利用者も含め **8 項目すべてで narrowing** が要る。案D は `expand` を書いたときだけ型が変わる。
3. **既存の展開挙動と一貫する**。`User` 型は既に既定で 4 サブ項目へ展開している（`resource.ts:130`）。
   PORTERS の 2 つの展開機構（`User` / `System[Reference]`）のうち**片方だけ実装済み**という歪みが解ける。

**raw `field` 文字列の展開を弾くのは、能力を落とすためではない**。`field` は型の付かない逃げ道で、
そこに書かれた展開はライブラリが型でも値でも表現できない。**弾いて `expand` を指す**（エラーの `hint` に書く）ことで、
「黙って捨てる」も「能力が無い」も両方消える。

> `field` を接頭辞なしの型付き alias にする [ADR-0059][adr59]（本 ADR の議論から派生・独立に決められる）が
> accepted なら、`"Job.P_Client(Client.P_Id)"` のような展開文字列は**型として書けなくなる**。
> そのとき本 ADR のガードは cast 経由に対する**実行時の防御**として残る（多層＝フェイルセーフ）。

### 公開 API のスケッチ（実施 ADR で詰める）

```ts
// expand: 参照項目 -> 参照先で欲しい alias。参照先リソースは descriptor が持つ（利用者は書かない）
const page = await t.job.search({
  field: ["Job.P_Id", "Job.P_Position"],
  expand: { P_Client: ["P_Id", "P_Name"] },
});
page.items[0]?.P_Client; // { P_Id: number | null; P_Name: string | null } | null

// expand を書かなければ従来どおり ID
const plain = await t.job.search();
plain.items[0]?.P_Client; // number | null（変わらない）
```

戻り型が引数から決まる形自体は既にある（`defineFields` のカタログが `CustomFor<C, …>` として
`ReadRecord` に流れ込む — `client.ts:90`）。[ADR-0005][adr5] SD-3「`field` の選択で戻り型を変えない」は
**そのまま維持**する — 型が変わるのは `field` 文字列ではなく **`expand` という別の入口**だけ。

### 送信形と重複の扱い

**`field` に参照項目を別途書かない**。PORTERS の `field` は展開を**1 エントリ**で表すので
（reference: `field=Job.P_Client(Client.P_Id,Client.P_Name)`）、`expand` は
**`Job.P_Client(…)` というエントリそのものを作る**。上のスケッチが送る URL は次のとおり。

```text
field=Job.P_Id,Job.P_Position,Job.P_Client(Client.P_Id,Client.P_Name)
```

- **外側**は自リソースの接頭辞（`Job.P_Client`）、**`()` の中は参照先リソースの接頭辞付き** alias（`Client.P_Id`）。
  `User` 型で既にライブラリが出している `{prefix}.{alias}(User.P_Id,…)` と同じ構文（`resource.ts:130`）。
- `expand` の値は**素の alias**（`P_Id`）にする。`condition` / `order` が bare キーを受けて
  エンコーダが接頭辞を付ける（`query.ts` の `${ctx.prefix}.${alias}`）のと揃える。
  **参照先の接頭辞は利用者に書かせない** — descriptor から引く。
  `field` だけが接頭辞付きの生文字列を取る例外だが、そこは型の付かない逃げ道なので踏襲しない。
- **重複は作らない**。`field` を省略すると既定 field に `Job.P_Client`（`()` 無し）が入るため、
  `expand` が指した項目は**素のエントリを展開形で置き換える**。利用者が `field` に自分で
  `Job.P_Client` を書いた場合も同じ。同じ alias を `()` 有り・無しで 2 回送ったときどちらが勝つかは
  正典に記述が無く未確認なので、**そもそも送らない**（安全側）。
- **参照先が Candidate のときだけ `()` の中身が未確定** — `Process.P_Candidate(Person.P_Id,…)` か
  `(Candidate.P_Id,…)` か。Candidate の alias 接頭辞は `Person`（`candidate.ts:64`）で、
  Field Type 記事も Write は `Person.P_Id` と書くので **`Person.`** と推定する。LV で確かめる。

### Consequences

- Good: **PORTERS の能力がライブラリから使える**。参照先の項目が 1 往復で取れる。
- Good: **黙って捨てる経路が消える**（`expand` は返す・raw `field` の展開はエラー）。
- Good: **基底の型は `number | null` のまま**。既存コード・既存テスト・既定経路は無変更。
- Bad: **4 案で一番大きい**。必要なもの: ①descriptor に**参照先**を持たせる（`name` / `prefix` は既にあり、
  Candidate の `Person` 接頭辞をここで吸収する）／②URL 組み立てで `(Target.P_X,…)` を生成／
  ③decode を参照先カタログで解く（`xml/` から `resources/` を参照しない形で解決子を注入＝[RV-8][rv8] の依存方向）／
  ④`ReadRecord` の型導出／⑤フェイクの `referenceInner` を展開対応に／⑥ガイド。
- Bad: **カスタム `U_`/`A_` の参照項目は対象外**。カタログに無いので `expand` に載せられず、
  raw `field` で展開しても `decoderFor`（`read-core.ts:89`）が `null` にする。ガードも効かない（カタログ外 alias のため）。
  `defineFields` が参照型を宣言できるようになるまで残る穴（[ADR-0023][adr23]）。ガイドに明記する。
- Neutral: **未確認の前提が 1 つ増える**が範囲は狭い＝**要求側の接頭辞**（Candidate 参照を `Person.` と書くか）。
  decode をタグ非依存に書けば実装のブロッカーにはならない。`VERIFY(live)` ＋ LV で追う。
- Neutral: 参照先 5 種のうち **Recruiter が未実装**（Job / Process の `P_Recruiter`）。
  `expand` の対象から外して始めるか、Recruiter を先に実装するかは実施時に決める。
- semver: **minor**（`expand` は追加。raw `field` の展開を弾く分だけ挙動変更。0.x では破壊的変更も minor ＝ [ADR-0055][adr55] の前例）。

## Pros and Cons of the Options

### 案A: 現状維持 ＋ 文書化

- Good: コスト最小。ドキュメント 1 節で終わる。
- Good: 実機未確認の領域（LV-10）に何も建てない。
- Bad: **「要求が黙って捨てられる」事実が残る**。ドキュメントは読まれないことがあり、
  読んでいない利用者にとって挙動は今日と同じ＝**フェイルセーフでない**。
- Bad: [RV-1][rv1] のときに「黙って返らないのは直す」と判断した基準と食い違う。

### 案B: 展開要求を送信前に弾く

- Good: **黙って捨てる経路が最小コストで消える**。型を動かさず、既存の送信前ガード
  （keywords 100 字・`count` 1〜200・itemstate の condition 制限・リクエスト長）の系列にそのまま載る。
  [ADR-0046][adr46] の契約（同期 throw でなく reject）も既存経路が満たす。
- Good: 展開を書いても中身は返っていないので、**この案が今日奪う機能は 0**。
- Bad: **PORTERS が受け付ける機能を、ライブラリが恒久的に使えなくする**。これまでのガードは
  「API も拒むもの」を先に落としていた＝性格が違う。**単独で採ると 1 往復の節約は永久に得られない**。
- Bad: カタログ外の `U_`/`A_` 参照項目には**ガードが効かない**ので、そちらは黙って `null` に落ち続ける。
- 実装スケッチ: `field` の各エントリが `(` を含み、その alias（`{prefix}.` を剥がした bare）の
  カタログ Data Type が `System[Reference]` なら `PortersConfigError`。
  置き場所は既存ガードと同じ Read クエリ組み立て（`query.ts` の `appendReadQuery` 系列／
  `buildReadUrl` は `ctx.fields` を既に持っている）。**Attachment は bespoke で自前 URL を組む**ため対象外。
  ガードは**カタログ上の `System[Reference]` にだけ**効かせる — `User` 型の `()` は正当（ライブラリ自身が既定で出す）、
  カタログ外 alias は素通し（`Image` 型の `(FileName,ContentType,Content)` は正当な構文で、
  [2026-08-16 の棚卸し][run816] (c) のとおり Image/Link は**カスタム項目にしか現れない**）。
- 位置づけ: **案D の一部として採れば上の Bad は消える**（raw `field` を弾いて `expand` へ誘導する）。
  単独で採ると残る＝[Decision Outcome][do] で案D を推した理由。

### 案C: 入れ子をそのまま返す（型を広げる）

- Good: **薄いラッパーとして一番素直**。送ったものが返る。
- Good: 新しい語彙をほぼ発明しない。
- Bad: **`DecodedValue<"System[Reference]">` が `number | 参照レコード` になる**＝
  展開を使わない利用者も含め、**8 項目すべてで narrowing が必要**になる。
  得をするのは展開を書いた人だけで、税は全員が払う。
- Bad: **入れ子の値を Data Type で解けない**。参照先カタログを知らないので、中身は**生の文字列**のまま返る
  （日付が ISO に正規化されない・Option が配列にならない）。**忠実に見えて忠実でない**中間状態になる。
- Bad: 「`field` の内容で実行時の形が変わるのに、型は union で固定」という**表現力の谷**が残る。

### 案D: 型付きの `expand` オプション（採用）

- Good / Bad: [Decision Outcome][do] のとおり。要点は **PORTERS の能力を型安全に届けられる唯一の案**である一方、
  **4 案で一番大きい**こと。
- Bad の補足: 実施は **1 本の ADR で全部やらなくてよい**。参照先を descriptor に載せる①と decode ③が土台で、
  `expand` の型導出④はその上に乗る。Recruiter 参照だけ後回しにしても他は動く。
- 却下しなかった前提: 「入れ子タグが参照先リソース名である」という**未確認の前提の上に型を建てる**のは
  起票時に案D の Bad として挙げたが、**decode をタグ非依存に書けるので前提そのものが要らない**
  （Decision Drivers 参照）。残るのは要求側の接頭辞 1 点。

## More Information

- 起点: [RV-31][rv31]（2026-08-22・[ADR-0056][adr56] の議論中に stakeholder の質問から発覚）。
- 関連する決定: [ADR-0020][adr20]（既定 field ＝ `User` は展開・`System[Reference]` は ID のみ）／
  [ADR-0005][adr5] SD-3（`field` 選択で戻り型を変えない「簡易」）／[ADR-0011][adr11]（decode の入れ子形）／
  [ADR-0016][adr16]（Data Type の忠実性）／[ADR-0046][adr46]（ガードは reject）。
- **LV の扱い**（案D 採用に伴い確定）: [LV-10][lv] が**展開時の入れ子タグ**の確認としてそのまま効き、
  加えて**要求側の接頭辞**（Candidate 参照を `Person.` と書くか `Candidate.` と書くか）を
  **[LV-16][lv16] として登録する**。どちらも decode をタグ非依存に書けば**実装のブロッカーにはならない**
  （外れたら要求文字列を直す範囲）。実施時に `VERIFY(live)` を置く。
- 射程外（本 ADR では決めない）: `User` 型の `()` に 4 項目以外を書いたときの扱い、
  `Link` / `Image` 型（[R-4][prd] の積み残し・カスタム項目経由でしか現れない）。
- 実施は accept 後の**別 PR**（ADR と実装は分ける）。

[do]: #decision-outcome
[fdt]: https://hrbcapi.porters.jp/hc/ja/articles/115008017407-Field-Type-Data-Type-List
[rparam]: https://hrbcapi.porters.jp/hc/ja/articles/115008016927-Read-API-Parameter
[rxml]: https://hrbcapi.porters.jp/hc/ja/articles/115008172008-Read-API-XML-Format
[rv31]: ../reviews/rv/0031-reference-expansion-discarded.md
[rv1]: ../reviews/rv/0001-read-field-default-missing.md
[rv8]: ../reviews/rv/0008-resources-fields-dependency.md
[run816]: ../reviews/2026-08-16-01.md
[rq]: ../guide/read-query.md
[lv]: ../live-verification.md
[lv16]: ../live-verification.md#lv-16-candidate-参照を展開するときの-alias-接頭辞
[prd]: ../design/requirements.md
[adr5]: 0005-public-api-shape.md
[adr11]: 0011-xml-parse-serialize.md
[adr16]: 0016-field-type-granularity.md
[adr20]: 0020-read-field-default.md
[adr23]: 0023-custom-field-declaration-dsl.md
[adr46]: 0046-guard-error-contract.md
[adr55]: 0055-partition-binding-guard.md
[adr56]: 0056-deleted-flag-typing.md
[adr59]: 0059-read-field-bare-alias.md
