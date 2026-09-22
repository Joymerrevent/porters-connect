# 書き込み（`create` / `update` / `createMany` / `updateMany`）

レコードを作る・更新するときに読むページです。1 件の書き方、読みと書きでかたちが違う項目、新規作成で何が必須か、
200 件を超える一括の書き方と部分成功の受け取り方が分かります。

## まず知ること

- **`delete` はありません。** PORTERS Connect API に削除が無く、型の上でも生やしていません（[削除と削除済みデータ][deleted]）。
- **読みで入れ子だった値は、書くときは id だけです。** `P_Owner` は `{ P_Id, P_Name, … }` で返り、書くときは数値の id を渡します。
- **型が必須にするのは、出典で `●`（無条件で必須）の項目だけです。** `※`（条件付き必須）は PORTERS の判定に委ねます。
- **200 件と約 15000 文字を超える入力は、`createMany` / `updateMany` が自動で分割します。** 結果は件ごとに返り、
  全部成功か全部失敗か、ではありません。
- **`create` は自動で再送されません。** 届いたか分からないまま再送すると 2 件できるためです（非冪等）。

## 作成する

必須項目を渡して、1 件作ります。

```ts
const newId = await t.candidate.create({
  P_Owner: 5, // 担当ユーザーの id。新規作成では必須
  P_Name: "山田 太郎",
  P_Mail: "taro@example.com",
});

console.log(newId); // 採番された P_Id
```

`P_Id` は渡しません（ライブラリが新規作成の印を送ります）。返るのは**採番された id** です。

**必須項目を忘れるとコンパイルが通りません。** 実行して Result Code を見るまでもなく止まります。

<!-- doccheck: expect-error -->

```ts
await t.candidate.create({ P_Name: "山田 太郎" }); // ✗ P_Owner が無い
```

## 更新する

id と、変えたい項目だけを渡します。

```ts
await t.candidate.update(10001, { P_Mail: "new@example.com" });
```

渡した項目だけが更新されます。

**`P_RegistrationDate` / `P_UpdateDate` は書けません**（PORTERS が管理します）。入力型から外してあるので、
書こうとするとコンパイルが通りません。

## 書くときはかたちが変わる

読みで入れ子だったものは、**書くときは id だけ**です。

| 項目の型            | 読むと                             | 書くとき                 |
| ------------------- | ---------------------------------- | ------------------------ |
| `User`（`P_Owner`） | `{ P_Id, P_Type, P_Name, P_Mail }` | **数値の id だけ**       |
| 参照（`P_Client`）  | 参照先の id                        | **参照先の id だけ**     |
| 選択肢（`P_Phase`） | alias の配列                       | alias の配列             |
| 日時                | ISO 8601                           | ISO 8601（変換して送る） |

日時だけは**送る前に検査されます**。変換できない書式はライブラリが弾きます。

```ts
// PortersConfigError: P_PhaseDate: cannot write "2026/09/10" as DateTime
await t.candidate.update(10001, { P_PhaseDate: "2026-09-10T00:00:00Z" }); // ← これが正しい形
```

他の型は素通しして PORTERS に判断させます。**手前で厳しくしすぎると、サーバーが受け付ける値を
ライブラリが落としてしまう**からです。この非対称は意図したものです。型ごとの値のかたちは
[項目と値のかたち][fields]にあります。

## 新規作成の必須項目

型が要求する項目です。出典の「新規必須」列が **`●`** のものだけが並びます<!-- 根拠: ADR-0083 -->。
`P_Id` はライブラリが供給するため入力型には現れません。

| リソース      | `create` の必須                                                               |
| ------------- | ----------------------------------------------------------------------------- |
| `candidate`   | `P_Owner`                                                                     |
| `job`         | `P_Owner` / `P_Client` / `P_Recruiter`                                        |
| `client`      | `P_Owner`                                                                     |
| `recruiter`   | `P_Owner` / `P_Client`                                                        |
| `contact`     | `P_Owner` / `P_Client`                                                        |
| `opportunity` | `P_Owner` / `P_Client` / `P_Recruiter`                                        |
| `activity`    | `P_Owner` / `P_Title`                                                         |
| `contract`    | **`P_Client` のみ**（このリソースに `P_Owner` は無い）                        |
| `sales`       | `P_Owner` のみ（参照 6 項目は条件付き）                                       |
| `process`     | `P_Owner` / `P_Client` / `P_Recruiter` / `P_Job` / `P_Candidate` / `P_Resume` |
| `resume`      | `P_Owner` / `P_Candidate`                                                     |
| `phase`       | `ResourceId` のみ（`Id` はライブラリが、`Resource` は `of(...)` が埋める）    |

### 型で止めないもの（PORTERS に委ねる）

**条件付きの必須**（出典の `※`）や**レコード間の整合性**は、他のレコードの状態に依存するため、呼び出し時点の型では
判定できません。これらは送信し、サーバーの判定を `PortersResourceError` として受け取ります。

- **型が緩い側に倒してあります。** こちらの誤りなら往復 1 回と型付きエラーで済みますが、型で弾かれると利用者の側に
  回避手段がありません。
- **参照先の実在**（`P_Client: 99999` が本当にあるか）は検査しません。
- **テナントが入力必須にしたカスタム項目**の欠落は型では止まりません。必須かどうかは PORTERS 側の設定
  （Field Read の `P_Required`）で、`defineFields` の宣言には載らないためです（[カスタム項目][custom-fields]）。
- リソース固有の規則（Sales の参照 6 項目の依存、Process の JOB × レジュメの一意、フェーズ項目の条件）は
  各リソースのページにあります（[Sales][r-sales]／[Process][r-process]／[Phase][r-phase]）。

## まとめて書く（`createMany` / `updateMany`）

**データ系 11 種**（Candidate / Job / Client / Recruiter / Contact / Opportunity / Activity / Contract / Sales / Process / Resume）
と **Phase**（`t.phase.of(...)` で束ねたもの）にあります。**Attachment にはありません**（本体が巨大な Base64 のため。下記「対象外」）。
書式の一次情報は [Write API（XML 形式）][write-format]<!-- 根拠: ADR-0041（実装） -->。

```ts
// 新規をまとめて作成（各レコードの必須項目は単件 create と同じ）
const created = await t.candidate.createMany([
  { P_Owner: 1, P_Name: "山田 太郎" },
  { P_Owner: 1, P_Name: "鈴木 花子" },
]);

// 既存を id 指定でまとめて更新
const updated = await t.candidate.updateMany([
  { id: 10001, fields: { P_Name: "山田 太郎" } },
  { id: 10002, fields: { P_Phase: ["Option.P_PersonPhase_Offer"] } },
]);
```

### 自動分割（200 件＋サイズ）

PORTERS は **1 リクエスト最大 200 件**、かつ**リクエスト全体で約 15000 文字**までです。ライブラリは
入力を**この 2 条件で自動分割**し、バッチを逐次送信します（レートはライブラリが調整）。分割は透過的で、
呼び出し側は件数を気にせず渡せます。

- 1 レコード単体で約 15000 文字を超える場合は、送信前に **`PortersConfigError`** で弾きます（項目値を見直してください）。
- 空配列を渡すとリクエストは送信されません（空の `BulkWriteResult`）。

### 戻り値 `BulkWriteResult`（部分成功）

一括書き込みは**アトミックではありません**。各レコードが独立に成否を持つため、**件ごとの失敗は
throw せず**、戻り値で返します。必ず `hasFailures` / `failed` を確認してください。

```ts
const r = await t.candidate.createMany(inputs);
// r.results : 送信順の件ごとの結果 [{ index, id, code, ok }]
// r.failed  : ok === false の部分集合
// r.hasFailures : failed.length > 0

if (r.hasFailures) {
  for (const f of r.failed) {
    console.warn(`record #${f.index} failed with code ${f.code}`);
  }
}
const newIds = r.results.filter((x) => x.ok).map((x) => x.id);
```

- `code` は PORTERS の Result Code（`0` = 成功）。一覧は [Result Code][result-codes]。
- `id` は採番（作成）／エコー（更新）された ID（成功時に有効）。

### エラー時の扱い（全体失敗・非冪等）

- **リクエスト全体の失敗**（HTTP エラー・通信断・パース不能・**リクエスト単位の拒否**）だけが throw されます。
- リクエストごと拒否された場合（PORTERS が `<Item>` を返さず、ルートの `<Code>` だけで答える形）は、
  その **Result Code がそのまま `PortersResourceError` として** throw されます<!-- 根拠: ADR-0045 -->。
  件数不一致のような不透明なエラーにはなりません。
- バッチ途中（2 つ目以降）で失敗した場合、**既に書き込まれた件数**を `hint` に付けて `PortersResourceError`
  を throw します。`createMany` はバッチ跨ぎで**非冪等**なので、**全体を再実行すると作成が重複**します。
  回復は「失敗位置以降のレコードだけ」を再送してください（`updateMany` は id 指定で冪等）。

### 対象外

- **Attachment** は単件のみ（`create` / `update`）。本体が巨大な Base64 のため一括は提供しません（[Attachment][r-attachment]）。
- **`Image` 型のカスタム項目を含むレコード**は一括で送れません。分割は「1 リクエスト約 15000 文字」を
  前提にしており、画像はその前提を桁で壊すためです。**何件目が画像を持つか**を添えて送信前に
  `PortersConfigError` で弾くので、その項目は単件の `create` / `update` で書いてください
  （そちらは画像に対応しています）。詳しくは[上限とレート][limits]と[カスタム項目][custom-fields]。

## 失敗したとき

投げられるのは `PortersError` の系統で、`category` で場合分けできます。

```ts
try {
  await t.candidate.create({ P_Owner: 5, P_Name: "山田 太郎" });
} catch (err) {
  if (err instanceof PortersError) {
    console.error(err.category, err.message, err.hint);
  }
}
```

「落とすのか、続けるのか、再送していいのか」は[エラーと再試行][errors]にまとめてあります。
消せない前提で二重登録を避ける考え方は[削除と削除済みデータ][deleted]にあります。

## 関連

- 主題: [検索][query]／[項目と値のかたち][fields]（型ごとの読みと書きのかたち）／[エラーと再試行][errors]（部分成功と、再送してよいか）／
  [上限とレート][limits]（200 件・リクエスト長・画像）／[削除と削除済みデータ][deleted]（作りすぎても消せない）
- リソース別: [リソースと操作][resources]（必須項目と固有の規則はリソースごと）
- 実践例: [毎日の差分同期][sync-batch]（差分をまとめて書く）
- リファレンス: [Write API（XML 形式）][write-format]／[Result Code][result-codes]
- ほかの目的から探す: [目次][index]

<!-- 根拠:
- 決定: ADR-0041（一括書き込みの公開サーフェス）／ADR-0045（Write 応答のルート Code）／ADR-0083（`※` は型で止めない）
-->

[write-format]: ../reference/resource-api/write-format.md
[result-codes]: ../reference/resource-api/result-codes.md
[errors]: errors.md
[query]: query.md
[fields]: fields.md
[sync-batch]: ../recipes/sync-batch.md
[limits]: limits.md
[deleted]: deleted.md
[custom-fields]: custom-fields.md
[resources]: ../resources/README.md
[r-sales]: ../resources/sales.md
[r-process]: ../resources/process.md
[r-phase]: ../resources/phase.md
[r-attachment]: ../resources/attachment.md
[index]: ../index.md
