# 59. Read の `field` を接頭辞なしの alias で受ける

- Status: proposed
- Date: 2026-08-29
- Deciders: jun.shiromoto (Joymerrevent)

> [ADR-0058][adr58] の議論から派生した**独立の判断**（参照展開とは別に、既存の公開 API `field` を変える話）。
> `condition` / `order` は**素の alias**（`P_Name`）を受けてエンコーダが接頭辞を付けるのに、
> **`field` だけが接頭辞付きの生文字列**（`Person.P_Name`）を要求している。
> 接頭辞は**リソースごとの定数**なので利用者が書いても情報は増えず、罠と綴り間違いだけが残る。
> 決定は decider が行う（自己 accept しない）。実施は accept 後の別 PR。

## Context and Problem Statement

### いまの非対称

| クエリ項目                         | 利用者が書く形               | 接頭辞を付けるのは           |
| ---------------------------------- | ---------------------------- | ---------------------------- |
| `condition`                        | `{ P_Name: { part: … } }`    | ライブラリ（`query.ts:208`） |
| `order`                            | `[{ P_UpdateDate: "desc" }]` | ライブラリ（`query.ts:223`） |
| `expand`（[0058][adr58] で提案中） | `{ P_Client: ["P_Id"] }`     | ライブラリ                   |
| **`field`**                        | **`["Person.P_Name"]`**      | **利用者**                   |

`field` だけが `string[]` の生文字列で、非空リストは**そのまま送られる**（`resource.ts:182`）。
ガイドも「alias は**接頭辞付き**で書きます（Candidate は `Person.`、他はリソース名）」と注意書きで補っている
（[Read クエリ ガイド][rq]）＝ **API の形ではなくドキュメントで守っている**状態。

### 接頭辞は「そのリソースの定数」

原記事の各 Field List のカスタム項目行が、標準もカスタムも**接頭辞は 1 つ**だと示している。

```text
Job.U_[Name]        （Job - Field List）
Person.U_[Name]     （Candidate - Field List）
Client.U_[Name]     （Client - Field List）
Process.U_[Name]    （Process - Field List）
Resume.U_[Name]     （Resume - Field List）
Recruiter.U_[Name]  （Recruiter - Field List）
```

**別の接頭辞が現れるのは `()` の中だけ**（参照先・User 型 — 例 `field=Job.P_Client(Client.P_Id,Client.P_Name)`）。
つまり `field` エントリの外側は**そのリソースの接頭辞に必ず一致する**。

さらに **Attachment は接頭辞を持たず**（`FileName` / `ContentType` … — [ADR-0018][adr18]、`attachment.ts:81` は既に bare）、
**Phase も持たない**（`Id` / `Resource` / `ResourceId` — 未実装）。接頭辞付きは全体の共通形ですらない。

### 何が起きているか

1. **情報ゼロの入力を強いている**。接頭辞は descriptor（`config.prefix`）が知っており、
   ライブラリは既定 field でも自分で組み立てている（`resource.ts:130`）。
2. **Candidate の罠**。接頭辞は**リソース名ではない** — Candidate だけ `Person.`（`candidate.ts:64`）。
   `Candidate.P_Name` と書くと外れる。ガイドの `P_Deleted` の項も
   「自分で `field` を渡すときは `"{Prefix}.P_Deleted"`（例 `"Person.P_Deleted"`）を明示してください」と補っている。
3. **綴り間違いが黙って通る**。`field: ["Person.P_Nmae"]` は型でも実行時でも素通りし、
   **返ってこないキーが `undefined` になるだけ**。エラーも警告も出ない。
   [RV-1][rv1]（`field` 省略時に主キーしか返らない）・[RV-31][rv31]（展開が捨てられる）と**同じ
   「要求したものが黙って返らない」系統**で、しかもこれは利用者のタイプミスなので頻度が高い。

応答側は既に接頭辞に依存していない（`bareAlias` が `{prefix}.` を剥がす — `read-core.ts:68`）。
**接頭辞を要求しているのは要求側だけ**。

## Decision Drivers

- **公開 API の一貫性**。`condition` / `order` / （提案中の）`expand` はすべて bare。
- **黙って失敗しない**（フェイルセーフ）。綴り間違いを型で落とせるならそうする。
- **情報を持っている側が組み立てる**。接頭辞は descriptor が持っている。
- **後方互換のコスト**。`field` は公開当初からある入力でガイドにも例が載っている。
- **逃げ道を塞がない**。`defineFields` で宣言していないカスタム項目（`U_`/`A_`）も引けること。

## Considered Options

- **案A**: 現状維持（接頭辞付きの生文字列）
- **案B**: **両対応** — bare も接頭辞付きも受ける（型は `string[]` のまま）
- **案C**: **bare のみ**受ける（型は `string[]` のまま）
- **案D**: **型付き bare** — カタログの alias（`keyof F`）＋ 未宣言カスタム用のテンプレートリテラル型（推奨）

## Decision Outcome

推奨: **案D**（型付き bare）。実行時は**接頭辞付きが来たら剥がして受ける**（応答側の `bareAlias` と対称の寛容さ）。

理由は 3 つ。

1. **上の 3 つのコストのうち「綴り間違いが黙って通る」を消せるのは案D だけ**。案B / 案C は接頭辞の手入力を
   やめさせるが、`"P_Nmae"` は依然として通る。本プロジェクトが [RV-1][rv1] / [RV-31][rv31] で
   「要求したものが黙って返らない」を潰してきた基準に照らすと、そこを残す理由が無い。
2. **新しい語彙を作らない**。`keyof F` は既に全導出の土台（`ReadRecord` / `Condition` / `Order` / Write 入力）。
   カタログ済みの標準項目・`defineFields` で宣言済みのカスタム項目は、そのまま `field` でも型検査される。
3. **未宣言のカスタム項目は塞がない**。`U_${string}` / `A_${string}` のテンプレートリテラル型で受ける。
   この命名規則は発明ではなく、`defineFields` が実行時に検査している既存の規則
   （`custom field alias … must start with "U_" or "A_"`）を型に写すだけ。

副次的に **[ADR-0058][adr58] と噛み合う**: `"Job.P_Client(Client.P_Id)"` のような展開文字列は
**型として書けなくなる**ので、カタログ済み項目の展開は**コンパイル時**に止まる。
0058 の実行時ガードは cast 経由の防御として残す（多層＝フェイルセーフ）。

### Consequences

- Good: **接頭辞を書かなくてよくなる**。Candidate の `Person.` 罠が消える。
- Good: **綴り間違いがコンパイルエラー**になる。`field` は「型が約束した項目を実際に取る」ための入力なので、
  ここが型検査されるのは筋が通っている。
- Good: `condition` / `order` / `expand` と**同じ語彙**（bare alias）で書ける。
  Attachment（既に bare）や将来の Phase（接頭辞なし）とも形が揃う。
- Bad: **破壊的変更**。`field: ["Person.P_Name"]` は型エラーになる。移行は「接頭辞を消すだけ」で機械的だが、
  既存利用者のコードには触る。semver は **minor**（0.x では破壊的変更も minor ＝ [ADR-0055][adr55] の前例）。
- Bad: 型と実行時の寛容さが**わずかにズレる**（型は bare のみ・実行時は接頭辞付きも剥がして受ける）。
  cast で古い形が入ってきても黙って壊れないための意図的な非対称で、コメントに残す。
- Neutral: 対象は `SearchQuery.field`（データ 5 リソース）と `UserSearchQuery.field`（マスタ User・`user.ts:51`）。
  **Attachment は既に bare な短名**なので変更なし（型を `AttachmentFieldName` に締める案は本 ADR の射程外）。
- Neutral: `field: []`（主キーのみ）・省略時の既定 field（[ADR-0020][adr20]）の意味は**変わらない**。
  内部で組み立てる既定リストは今も接頭辞付きなので、そこは無変更。
- Neutral: ガイド（[Read クエリ][rq]・`P_Deleted` の注記）と README の例を書き換える。

## Pros and Cons of the Options

### 案A: 現状維持

- Good: 何もしなくてよい。既存利用者に影響ゼロ。
- Bad: 3 つのコスト（情報ゼロの入力・`Person.` 罠・綴り間違いが黙って通る）がすべて残る。
- Bad: `expand` を bare で足すと（[0058][adr58]）、**同じクエリ内で 2 つの語彙**が並ぶ。

### 案B: 両対応（bare も接頭辞付きも受ける）

- Good: **後方互換**。既存コードが一切壊れない。
- Good: 接頭辞を書かなくてよくなる（罠は実質消える）。曖昧さも無い（bare は `.` を含まない）。
- Bad: **綴り間違いは通ったまま**。型は `string[]` のままなので最大のコストが残る。
- Bad: 「どちらでもよい」入力は**書き方が 2 通り**になり、ガイドとレビューで揺れる。

### 案C: bare のみ（型は `string[]`）

- Good: 語彙が 1 つに定まる。実装は最小（送信時に接頭辞を付けるだけ）。
- Bad: 破壊的なのに**得るものが案D より少ない**（綴り間違いは通る）。同じ破壊を払うなら案D。

### 案D: 型付き bare（推奨）

- Good / Bad: [Decision Outcome][do] のとおり。
- 実装スケッチ:

  ```ts
  // カタログ済み（標準 P_ ＋ 宣言済みカスタム）は型検査、未宣言カスタムは命名規則で受ける
  field?: (keyof F & string | `U_${string}` | `A_${string}`)[];
  ```

  送信は `buildReadUrl` で `field` を `${prefix}.${alias}` に写す（既定 field と同じ組み立てに合流させる）。
  実行時は `bareAlias` で受け側を正規化し、cast 経由の接頭辞付きも剥がして受ける。

- 未決（実施 ADR で詰める）: `U_${string}` を許すと `U_` 以降の綴りは検査されない。
  `defineFields` で宣言済みなら `keyof F` 側で検査されるので、**宣言を促す方向**でガイドに書く。

## More Information

- 派生元: [ADR-0058][adr58]（`System[Reference]` の展開）。あちらで `expand` を bare alias にした結果、
  `field` だけが接頭辞付きという非対称が際立った。**0058 と 0059 は互いに独立に accept できる**
  （0059 が accepted なら 0058 のガードは「型で止まらなかった場合の防御」に格下げできる）。
- 関連する決定: [ADR-0020][adr20]（既定 field）／[ADR-0038][adr38]（`condition`/`order` の bare 語彙）／
  [ADR-0018][adr18]（Attachment は接頭辞なし）／[ADR-0023][adr23]（`U_`/`A_` の命名規則を実行時検査）。
- 関連する指摘: [RV-1][rv1]・[RV-31][rv31]（いずれも「要求したものが黙って返らない」）。
- 射程外: Attachment の `field` を短名の union に締めること、`field` で取れる項目と戻り型を連動させること
  （[ADR-0005][adr5] SD-3「簡易」は維持）。
- 実施は accept 後の**別 PR**（ADR と実装は分ける）。

[do]: #decision-outcome
[rq]: ../guide/read-query.md
[rv1]: ../reviews/rv/0001-read-field-default-missing.md
[rv31]: ../reviews/rv/0031-reference-expansion-discarded.md
[adr5]: 0005-public-api-shape.md
[adr18]: 0018-attachment-design.md
[adr20]: 0020-read-field-default.md
[adr23]: 0023-custom-field-declaration-dsl.md
[adr38]: 0038-read-query-surface-impl.md
[adr55]: 0055-partition-binding-guard.md
[adr58]: 0058-reference-expansion-read.md
