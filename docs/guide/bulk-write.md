# 一括書き込み（createMany / updateMany）

複数レコードをまとめて登録・更新するガイドです。各データ系リソース（Candidate / Job / Client /
Process / Resume）に `createMany` / `updateMany` があります。

設計の根拠は [ADR-0041（F-4 実装）][adr-0041]、書式の一次情報は [Write API（XML 形式）][write-format]。

## 使い方

```ts
// 新規をまとめて作成（各レコードの必須項目は単件 create と同じ）
const created = await porters.candidate.createMany([
  { P_Owner: 1, P_Name: "山田 太郎" },
  { P_Owner: 1, P_Name: "鈴木 花子" },
]);

// 既存を id 指定でまとめて更新
const updated = await porters.candidate.updateMany([
  { id: 10001, fields: { P_Name: "山田 太郎" } },
  { id: 10002, fields: { P_Phase: ["Option.P_PersonPhase_Offer"] } },
]);
```

## 自動分割（200 件＋サイズ）

PORTERS は **1 リクエスト最大 200 件**、かつ**リクエスト全体で約 15000 文字**までです。ライブラリは
入力を**この 2 条件で自動分割**し、バッチを逐次送信します（レート制限はライブラリが調整）。分割は透過的で、
呼び出し側は件数を気にせず渡せます。

- 1 レコード単体で約 15000 文字を超える場合は、送信前に **`PortersConfigError`** で弾きます（項目値を見直してください）。
- 空配列を渡すとリクエストは送信されません（空の `BulkWriteResult`）。

## 戻り値 `BulkWriteResult`（部分成功）

一括書き込みは**アトミックではありません**。各レコードが独立に成否を持つため、**per-item の失敗は
throw せず**、戻り値で返します。必ず `hasFailures` / `failed` を確認してください。

```ts
const r = await porters.candidate.createMany(inputs);
// r.results : 送信順の per-item 結果 [{ index, id, code, ok }]
// r.failed  : ok === false の部分集合
// r.hasFailures : failed.length > 0

if (r.hasFailures) {
  for (const f of r.failed) {
    console.warn(`record #${f.index} failed with code ${f.code}`);
  }
}
const newIds = r.results.filter((x) => x.ok).map((x) => x.id);
```

- `code` は PORTERS の Result Code（`0` = 成功）。一覧は [result-codes][result-codes]。
- `id` は採番（作成）／エコー（更新）された ID（成功時に有効）。

## エラー時の扱い（全体失敗・非冪等）

- **リクエスト全体の失敗**（HTTP エラー・通信断・パース不能）だけが throw されます。
- バッチ途中（2 つ目以降）で失敗した場合、**既に書き込まれた件数**を `hint` に付けて `PortersResourceError`
  を throw します。`createMany` はバッチ跨ぎで**非冪等**なので、**全体を再実行すると作成が重複**します。
  回復は「失敗位置以降のレコードだけ」を再送してください（`updateMany` は id 指定で冪等）。

## 対象外

- **Attachment** は単件のみ（`create` / `update`）。本体が巨大な Base64 のため一括は提供しません。

[adr-0041]: ../adr/0041-bulk-write-surface-impl.md
[write-format]: ../reference/resource-api/write-format.md
[result-codes]: ../reference/resource-api/result-codes.md
