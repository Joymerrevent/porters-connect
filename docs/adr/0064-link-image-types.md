# 64. Link / Image 型の対応（宣言から Read / Write まで）

- Status: proposed
- Date: 2026-09-04
- Deciders: jun.shiromoto (Joymerrevent)

> [ADR-0060][adr60] の **D3（データ型網羅 15/17 → 17/17）**の残り＝ `Link` と `Image`。
> 両型は**カタログ済みの標準項目に 1 つも無く、テナントのカスタム項目（`U_` / `A_`）経由でしか現れない**。
> `DataType` に足すだけでは誰も宣言できないので、[ADR-0023][adr23] の builder への露出まで 1 本で決める。

## Context and Problem Statement

[PRD R-4][prd] は「Link / Image の正規化は v1 では未対応・deferred」としたまま、
[ADR-0060][adr60] D3 で**完了条件に取り込まれた**。残り 2 型を入れれば「PORTERS の Data Type を
すべて型で表せる」と**検査結果として**言える。

reference が定める事実（出典は Field Type & Data Type List ／ Read・Write API - XML Format）:

|       | **Image**（Field Type 18）                                                                                                                                                                | **Link**（Field Type 20）                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 値    | 画像 1 枚（`FileName` / `ContentType` / `Content`）                                                                                                                                       | **Contact の ID（数値）／ User の情報／ Department の情報のいずれか**                                                    |
| Read  | 既定は **`FileName` のみ**。`ContentType` / `Content` は `alias(FileName,ContentType,Content)` と括弧で明示                                                                               | Contact なら **ID だけ**（`Contact.P_Name` 等は取れない）。User / Department は出力 Field 設定に応じて参照先の項目が出る |
| Write | `<Alias><FileName/><ContentType/><Content/></Alias>`。`Content` は **Base64**・**2MB 上限**、`FileName` は拡張子込み **255 バイト**以内、`ContentType` は **jpeg / gif / png / bmp** のみ | **ID のみ**（`<Alias>10001</Alias>`）                                                                                    |
| 制約  | **condition に指定できない**。**上位 Resource からの参照取得もできない**                                                                                                                  | **ConnectAPI-Version 2 以降**が必要（本ライブラリは常に `2` を送る＝[ADR-0042][adr42]）                                  |

決めるべきことは 6 つある。**論点1〜3 が Image、論点4 が Link、論点5・6 が共通**。

## Decision Drivers

- **フェイルセーフ** — 2MB の画像を**黙って運ばない**。上限・形式は**送信前に**弾く（[ADR-0046][adr46] の経路で）。
- **PORTERS の事実に忠実** — 既定の出力（`FileName` のみ）・書式・制約をそのまま写す。**持っていない情報を発明しない**。
- **既存の語彙の再利用** — `field` は bare alias（[ADR-0059][adr59]）、選択で型が広がる形は `expand`（[ADR-0058][adr58]）。
- **公開サーフェスを増やしすぎない** — 新しい入口は必要な分だけ。
- **未確認は `VERIFY(live)`** — reference に書かれていないことを実装の断定にしない。

## 論点1: Image の Read で、既定でどのサブタグを要求するか

- **案1a: 素の alias だけ送る（＝ PORTERS 既定の `FileName` のみ）** — 推奨
- 案1b: 既定で `FileName,ContentType`（メタ 2 つ）を送る
- 案1c: 既定で 3 つとも送る

**推奨は案1a。** [ADR-0020][adr20]（field 省略時はカタログ全項目を要求）とも整合する
— **項目は要求し、中身の重さは PORTERS の既定に委ねる**。案1c は「一覧を取っただけで
2MB × 件数が飛んでくる」ので論外。案1b は中途半端で、`ContentType` だけ先に欲しい場面が思いつかない。

## 論点2: `Content` をどう要求させるか

- **案2a: 専用オプション `image: { U_photo: ["FileName", "Content"] }`** — 推奨
- 案2b: `expand` を流用する
- 案2c: `field` に `U_photo(FileName,Content)` と書けるようにする

**推奨は案2a。** 形は `expand` に揃える（項目ごとにサブタグを選び、**選んだぶんだけ戻り型が広がる**）が、
**機構が違う**ので入口は分ける — `expand` の相手は「参照先リソースのカタログ」で、Image のサブタグは
**3 つの固定リテラル**。同じ穴に押し込むと `Expand<R>` の型が二役になる。案2c は
[ADR-0059][adr59] が塞いだ「生の展開文字列」を復活させるので採らない。

```ts
const page = await t.resume.search({
  image: { U_photo: ["FileName", "Content"] },
});
page.items[0]?.U_photo; // { FileName: string | null; Content: string | null }
```

## 論点3: Image の Write に対応するか（そして ~15000 字ガードをどうするか）

Base64 の 2MB は**リクエスト長ガード（`MAX_REQUEST_LENGTH` = 15000 字）に必ず当たる**。
Attachment は同じ問題を `unboundedBody` で外している（[ADR-0018][adr18]）。

- **案3a: Write に対応する。Image 値を含む write だけ `unboundedBody` にし、代わりに専用の事前検証を置く** — 推奨
- 案3b: Read のみ対応（Write は非対応のまま）
- 案3c: 何もしない（ガードに当たってエラーになる）

**推奨は案3a。** [PRD R-4][prd] は「Write は型付き入力 → XML を内部生成」なので Read だけでは片肺。
**ガードを外すなら、外したぶんを別の検査で埋める**のがこの設計の筋で、送信前に:

- `Content` の **decode 後**サイズ ≤ 2MB（Base64 長から算出でき、実際に decode しなくてよい）
- `FileName` は拡張子込み **255 バイト**以内（UTF-8 バイト数）
- `ContentType` は **`image/jpeg` / `image/gif` / `image/png` / `image/bmp`** のみ

を検査し、外れたら `PortersConfigError`（category `config`）で**送る前に**弾く。

**一括書き込み（[ADR-0041][adr41]）は別扱いにする**。200 件チャンクは「1 リクエスト ~15000 字」を
前提に切っているので、Image を含む `createMany` / `updateMany` は**その前提が崩れる**。
**Image 値を含む一括書き込みは弾き、単発の `create` / `update` へ誘導する**（フェイルセーフ）。

## 論点4: Link の Read 値をどう型付けるか

Link は「Contact の ID ／ User の情報 ／ Department の情報」の**いずれか**で、どれになるかは
**テナントの項目設定**で決まる。API のレスポンスに種別の判別子は無く、**形が違うだけ**。

- **案4a: 宣言では種別を指定させない。値は `number | UserRef | DepartmentRef` の union とし、decode は XML の形で判別する** — 推奨
- 案4b: 宣言で種別を選ばせる（`f.link("contact")` など）＝戻り型が一意になる
- 案4c: 常に数値（Contact のみ対応）

**推奨は案4a。** ライブラリはテナントの項目設定を**検証できない**ので、案4b は
「宣言が間違っていたら型と実データが食い違う」＝**嘘をつける設計**になる。形で判別すれば、
届いたものがそのまま型に出る。**`UserRef` / `DepartmentRef` は既存**（[ADR-0061][adr61] 案3a）なので
新しい値型は増えない。案4b は将来 `f.link("contact")` のような**任意引数**として後から足せる
（後方互換）ので、必要になってからでよい。案4c は reference が挙げる 3 つのうち 2 つを捨てる。

## 論点5: `defineFields` の builder に何を足すか

[ADR-0023][adr23] D3 は「Image / Link は内部 `DataType` に未モデルのため対象外・将来課題」としていた。
本 ADR で `DataType` に載るので、**`f.image()` と `f.link()` を builder に足す**（案5a）。
System 系（`System[Id]` / `[DateTime]` / `[Reference]` / `[Department]`）を出さない方針は変えない。

## 論点6: condition / order の扱い

- Image は reference が **condition 不可**と明記。order も認めない。
- Link は**記載が無い**。

**両方とも condition / order の対象外にする**（案6a）。`ConditionFor` と `OrderableKeys` は
**未知の Data Type に `never` を返す**ので、`DataType` に足すだけで自動的にそうなる
＝**実装を足さずに型で閉じる**。Link は「不可」ではなく「不明」なので、
**[live-verification][lv] に LV 項目を起こし**、確認できたら緩める（緩めるのは後方互換）。

## Decision Outcome

**未決（proposed）。** 推奨は **案1a / 案2a / 案3a / 案4a / 案5a / 案6a**。

### Consequences（推奨案を採った場合）

- Good: **D3 が 17/17** になり、「PORTERS の Data Type をすべて型で表せる」を検査結果として言える。
- Good: 画像を**型付きで読み書きできる**のに、**一覧取得は軽いまま**（既定は `FileName` のみ）。
- Good: `condition` / `order` からの除外は**型の既定**で閉じる＝新しい分岐を書かない。
- Bad: 公開サーフェスが 1 つ増える（`image` オプション）。`expand` と似ているが別物という説明が要る。
- Bad: **サイズガードの穴が 1 つ増える**（Image を含む write）。埋め合わせの検証 3 つを正しく保つ責任が生じる。
- Neutral: フェイクサーバー（[ADR-0043][adr43]）に Image / Link の wire 形を足す必要がある。
- Neutral: Link の condition 可否・Image の「値を消す」書き方は**未確認**として残る（LV 項目）。

## Pros and Cons of the Options

### 案3a Write 対応 ＋ 専用検証（推奨）

- Good: PRD R-4 の「型付き入力 → XML」を満たす。上限・形式違反を**実リクエスト前に**判別可能エラーにできる。
- Bad: `unboundedBody` の適用範囲が広がる。検証を 1 つでも落とすと 400 の原因が見えにくくなる。

### 案3b Read のみ

- Good: サイズガードに触らずに済む。差分が小さい。
- Bad: 「読めるが書けない」非対称が残り、D3 の達成も**型だけ**になる。

### 案4a 形で判別する union（推奨）

- Good: 宣言が実データと食い違いようがない。既存の `UserRef` / `DepartmentRef` を再利用。
- Bad: 利用側に narrowing（`typeof v === "number"` 等）が要る。

### 案4b 宣言で種別を選ぶ

- Good: 戻り型が一意で narrowing 不要。
- Bad: **宣言が間違っていても誰も気づけない**。ライブラリがテナント設定を検証できない以上、嘘を許す形になる。

## More Information

- 出典: Field Type & Data Type List（Field Type 18 / 20）／ Read API - XML Format（Data Type: Link / Image）／
  Write API - XML Format（同）。いずれも `tmp/porters-docs/txt/` に取得済み。
- 関連: [ADR-0060][adr60] D3（本 ADR の発端）／ [ADR-0023][adr23] D3（builder の対象を広げる）／
  [ADR-0018][adr18]（Attachment のサイズ扱い）／ [ADR-0041][adr41]（一括書き込みのチャンク）／
  [ADR-0020][adr20]・[ADR-0058][adr58]・[ADR-0059][adr59]（Read の既定と選択の語彙）。
- 実装は accepted 後に別 PR。フェイクサーバーと突合テストの追従を含む。

[adr18]: 0018-attachment-design.md
[adr20]: 0020-read-field-default.md
[adr23]: 0023-custom-field-declaration-dsl.md
[adr41]: 0041-bulk-write-surface-impl.md
[adr42]: 0042-supported-version-policy.md
[adr43]: 0043-local-fake-server.md
[adr46]: 0046-guard-error-contract.md
[adr58]: 0058-reference-expansion-read.md
[adr59]: 0059-read-field-bare-alias.md
[adr60]: 0060-full-resource-coverage-direction.md
[adr61]: 0061-phase-resource-surface.md
[lv]: ../live-verification.md
[prd]: ../design/requirements.md
