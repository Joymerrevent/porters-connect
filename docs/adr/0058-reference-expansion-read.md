# 58. `System[Reference]` を展開して読むときの扱い

- Status: proposed
- Date: 2026-08-23
- Deciders: jun.shiromoto (Joymerrevent)

> [RV-31][rv31] の ADR。PORTERS の Read は `field` の alias に `()` を付けると
> **上位 Resource の項目を入れ子で返す**。ライブラリはその入れ子から **ID だけを取り出して残りを捨てる**ため、
> 利用者が `Job.P_Client(Client.P_Id,Client.P_Name)` と**明示的に要求しても `Client.P_Name` は返らない**。
> 例外も型エラーも出ないので、気づく手がかりが無い。
> 決定は decider が行う（自己 accept しない）。実施は accept 後の別 PR。

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
- **実機未確認**。入れ子タグが実際に何か（`<Client>` か等）は **[LV-10][lv] が未確認**で、
  フェイク（`test/fake/wire.ts:148`）も `sub` を無視して中立な `<Reference><P_Id>` を返している。
  **展開の e2e を今すぐ本物に接地できない**。

## Considered Options

- **案A**: 現状維持 ＋ 文書化（[Read クエリ ガイド][rq]に「`System[Reference]` は ID のみ返る」と明記）
- **案B**: 展開要求を**送信前に弾く**（`PortersConfigError`）
- **案C**: 返ってきた入れ子を**そのまま返す**（読み取り型を `number | 参照レコード` に広げる）
- **案D**: **型付きの `expand` オプション**を足す（生の `field` に書かれた展開は案B のガードで弾く）

## Decision Outcome

推奨: **案B**（展開要求を送信前に弾く）。

理由は 3 つ。

1. **利用者が今持っているものを何も奪わない**。展開を書いても中身は返っていないので、
   案B が失わせる機能は**現時点で 0** — 黙って消えていた要求が、明示的なエラーになるだけ。
2. **型を一切動かさない**。`number | null` のまま。展開を使わない利用者に税がかからない。
3. **既存のガード系列にそのまま載る**（keywords 100 字・`count` 1〜200・itemstate の condition 制限・
   リクエスト長）。**送る前に落とす**という同じ形で、[ADR-0046][adr46] の契約（同期 throw でなく reject）も既存経路が満たす。

**案D（型付き展開）は「次にやること」であって「今決めること」ではない**、というのが推奨の裏側。
展開は**新機能**（1 往復を節約する）であり、それを設計するには **LV-10 の実機確認**（入れ子タグ）と
参照先リソースの持ち方（descriptor 拡張）が要る。**未確認の wire 形の上に型を建てるのは順序が逆**で、
フェイクも展開を模せない以上、e2e は自作の仮定を検証するだけになる。
案B は案D を**閉じない**（弾いていた入力を後から受け付けるのは非破壊）。

### Consequences

- Good: **黙って捨てる経路が消える**。要求どおりに返らないことがエラーで分かり、
  ガイドの「参照先は別 Read で取る」に自然に接続する。
- Good: 公開型・既定経路・既存テストは**無変更**。8 項目の読み取り DX は今のまま。
- Bad: **PORTERS が受け付ける URL をライブラリが拒む**ことになる（これまでのガードは
  「API も拒むもの」を先に落としていた＝性格が違う）。理由は「応答を表現できないから」で、
  ガイドとエラー `hint` にそう書く必要がある。
- Bad: **1 往復の節約は引き続き得られない**。参照先の項目が要る利用者は 2 回 Read する。
- Neutral: ガードは**カタログ上の `System[Reference]` にだけ効かせる**。`User` 型の `()` は正当
  （ライブラリ自身が既定で出す）、**カタログに無い `U_`/`A_` alias は素通し**（`Image` 型の
  `(FileName,ContentType,Content)` は正当な構文で、[2026-08-16 の棚卸し][run816] (c) のとおり
  Image/Link は**カスタム項目にしか現れない**）。
- Neutral: **カスタム項目の参照型は依然として静かに落ちる**。カタログ外 alias の入れ子は
  `decoderFor`（`read-core.ts:89`）が `null` にするため。ガードが効かない範囲があることは
  ガイドに書いて残す（案D で解く範囲）。
- semver: **minor**（これまで通っていた呼び出しが例外になる挙動変更。0.x では破壊的変更も minor ＝ [ADR-0055][adr55] の前例）。

## Pros and Cons of the Options

### 案A: 現状維持 ＋ 文書化

- Good: コスト最小。ドキュメント 1 節で終わる。
- Good: 実機未確認の領域（LV-10）に何も建てない。
- Bad: **「要求が黙って捨てられる」事実が残る**。ドキュメントは読まれないことがあり、
  読んでいない利用者にとって挙動は今日と同じ＝**フェイルセーフでない**。
- Bad: [RV-1][rv1] のときに「黙って返らないのは直す」と判断した基準と食い違う。

### 案B: 展開要求を送信前に弾く（推奨）

- Good / Bad: [Decision Outcome][do] のとおり。
- 実装スケッチ: `field` の各エントリが `(` を含み、その alias（`{prefix}.` を剥がした bare）の
  カタログ Data Type が `System[Reference]` なら `PortersConfigError`。
  置き場所は既存ガードと同じ Read クエリ組み立て（`query.ts` の `appendReadQuery` 系列／
  `buildReadUrl` は `ctx.fields` を既に持っている）。**Attachment は bespoke で自前 URL を組む**ため対象外。
- `hint` の案: 「参照先の項目は別リソースの Read で取得してください（`client.get(id)` など）」。

### 案C: 入れ子をそのまま返す（型を広げる）

- Good: **薄いラッパーとして一番素直**。送ったものが返る。
- Good: 新しい語彙をほぼ発明しない。
- Bad: **`DecodedValue<"System[Reference]">` が `number | 参照レコード` になる**＝
  展開を使わない利用者も含め、**8 項目すべてで narrowing が必要**になる。
  得をするのは展開を書いた人だけで、税は全員が払う。
- Bad: **入れ子の値を Data Type で解けない**。参照先カタログを知らないので、中身は**生の文字列**のまま返る
  （日付が ISO に正規化されない・Option が配列にならない）。**忠実に見えて忠実でない**中間状態になる。
- Bad: 「`field` の内容で実行時の形が変わるのに、型は union で固定」という**表現力の谷**が残る。

### 案D: 型付きの `expand` オプション

- Good: **PORTERS の能力を型安全に届けられる唯一の案**。`User` 型を 4 サブ項目に展開している既存挙動とも一貫する。
- Good: **基底の型を広げない**。`expand` を書いたときだけ、その項目の型が参照レコードになる
  （戻り型は `expand` の引数から導出＝ SD-3「`field` で型を変えない」を破らずに済む）。
- Bad: **一番大きい**。必要なもの: ①descriptor に**参照先**を持たせる（`name`/`prefix` は既にある。
  Candidate の `Person` 接頭辞をここで吸収する）／②URL 組み立てで `(Target.P_X,…)` を生成／
  ③decode を参照先カタログで解く（`xml/` から `resources/` を参照しない形で解決子を注入＝[RV-8][rv8] の依存方向）／
  ④`ReadRecord` の型導出／⑤フェイクの `referenceInner` を展開対応に／⑥ガイド。
- Bad: **土台が未確認**（LV-10）。入れ子タグが参照先リソース名だという前提の上に型を建てることになる。
- Bad: 参照先 5 種のうち **Recruiter が未実装**なので、参照先カタログが 1 つ欠けたまま始まる。

## More Information

- 起点: [RV-31][rv31]（2026-08-22・[ADR-0056][adr56] の議論中に stakeholder の質問から発覚）。
- 関連する決定: [ADR-0020][adr20]（既定 field ＝ `User` は展開・`System[Reference]` は ID のみ）／
  [ADR-0005][adr5] SD-3（`field` 選択で戻り型を変えない「簡易」）／[ADR-0011][adr11]（decode の入れ子形）／
  [ADR-0016][adr16]（Data Type の忠実性）／[ADR-0046][adr46]（ガードは reject）。
- **LV の扱い**: 案B は展開を**送らない**ので新しい実機前提を持ち込まない（[LV-10][lv] は現状のまま未確認で構わない）。
  **案C / 案D を採る場合は LV-10 の確認が前提**になり、展開時の入れ子タグ・参照先項目の wire 形を確かめる LV が追加で要る。
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
[prd]: ../design/requirements.md
[adr5]: 0005-public-api-shape.md
[adr11]: 0011-xml-parse-serialize.md
[adr16]: 0016-field-type-granularity.md
[adr20]: 0020-read-field-default.md
[adr46]: 0046-guard-error-contract.md
[adr55]: 0055-partition-binding-guard.md
[adr56]: 0056-deleted-flag-typing.md
