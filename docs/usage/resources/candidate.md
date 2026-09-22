# Candidate（個人連絡先）

- **アクセサ**: `t.candidate`
- **画面名**: Agent「個人連絡先」／ Staffing「スタッフ連絡先」
- **スコープ**: 読み `candidate_r`（＋ 参照先の `user_r` / `option_r`）／ 書き `candidate_w`
- **項目の接頭辞**: `Person.`（書くときは付けない）

求職者本人の連絡先です。経歴はレジュメ（[Resume][r-resume]）に分かれ、レジュメ側の `P_Candidate` が本人を指します。

## 呼べるメソッド

| 読み                           | 書き                                              |
| ------------------------------ | ------------------------------------------------- |
| `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |

```ts
const page = await t.candidate.search({
  field: ["P_Id", "P_Name", "P_UpdateDate"],
  condition: { P_Name: { part: "山田" } },
});
const id = await t.candidate.create({ P_Owner: 5, P_Name: "山田 太郎" });
await t.candidate.update(id, { P_Name: "山田 花子" });
```

`delete` はありません（[削除と削除済みデータ][deleted]）。200 件を超える書き込みは `createMany` / `updateMany` が
自動で分割します（[書き込み][write]）。

## 固有の注意

- **項目の接頭辞がリソース名と違います**（`Person.P_Name`）。書くのは `P_Name` だけで、接頭辞はライブラリが付けます。
- フェーズの項目（`P_Phase` / `P_PhaseDate` / `P_PhaseMemo`）は**最新フェーズに対する条件**があります（フェーズ日付が最新より新しいこと、など）。同じフェーズなら上書き、違うフェーズなら追加です。履歴そのものは [Phase][r-phase] で読みます。
- 添付は `t.attachment.of("candidate")` で付けます（[Attachment][r-attachment]）。

## 新規作成の必須項目

`P_Owner`

出典で `●`（無条件で必須）の項目だけを `create` の入力型が要求します。`※`（条件付き必須）は型で止めず、
PORTERS の判定に委ねます（[書き込み][write]）。

## 項目と型

- 標準項目（`P_`）の一覧: [Candidate の項目][ref]（PORTERS の事実）
- 型: [`Candidate`][t-read]（読み取り）／ [`CandidateCreateInput`][t-create] ／ [`CandidateUpdateInput`][t-update] ／
  [`CandidateSearchQuery`][t-query] ／ [`CandidatePage`][t-page] ／ [`CandidateResource`][t-resource]
- テナント固有の項目（`U_` / `A_`）は宣言してから使います（[カスタム項目][custom-fields]）

## 関連

- 主題: [検索][query]／[書き込み][write]／[上限とレート][limits]
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/candidate.md
[t-read]: ../api/type-aliases/Candidate.md
[t-create]: ../api/type-aliases/CandidateCreateInput.md
[t-update]: ../api/type-aliases/CandidateUpdateInput.md
[t-query]: ../api/type-aliases/CandidateSearchQuery.md
[t-page]: ../api/type-aliases/CandidatePage.md
[t-resource]: ../api/type-aliases/CandidateResource.md
[query]: ../topics/query.md
[write]: ../topics/write.md
[limits]: ../topics/limits.md
[custom-fields]: ../topics/custom-fields.md
[resources]: README.md
[index]: ../index.md
[r-resume]: resume.md
[r-phase]: phase.md
[deleted]: ../topics/deleted.md
[r-attachment]: attachment.md
