# Candidate（個人連絡先）

求職者本人の連絡先です。経歴はレジュメ（[Resume][r-resume]）に分かれ、レジュメ側の `P_Candidate` が本人を指します。

- **アクセサ**: `t.candidate`
- **画面名**: Agent「個人連絡先」／ Staffing「スタッフ連絡先」
- **スコープ**: 読み `candidate_r`（＋ 参照先の `user_r` / `option_r`）／ 書き `candidate_w`
- **項目の接頭辞**: `Person.`（書くときは付けない）

## 呼べるメソッド

このリソースで呼べるメソッドと、使い方の例です。

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

このリソースだけに当てはまる注意です。共通の規則（検索・書き込み・上限）は主題別のページにあります。

- **項目の接頭辞がリソース名と違います**（`Person.P_Name`）。書くのは `P_Name` だけで、接頭辞はライブラリが付けます。
- **フェーズの項目には、最新フェーズに対する条件があります**（`P_Phase` / `P_PhaseDate` / `P_PhaseMemo`。日付が最新より新しいこと、など）。詳しくは [Phase][r-phase]。
- **添付は `t.attachment.of("candidate")` で付けます**（[Attachment][r-attachment]）。

## 新規作成の必須項目

`create` の必須項目（無条件か、条件付きか）と、渡さないとどこで止まるかです。表にあるのは呼び出し側が渡す項目だけです。

| 項目      | 必須の種類        | どこで止まるか               |
| --------- | ----------------- | ---------------------------- |
| `P_Owner` | ●（無条件で必須） | 渡さないとコンパイルで止まる |

●（無条件で必須）は `create` の入力型が要求し、渡さないとコンパイルで止まります。※（条件付き必須）は
他のレコードの状態に依存するため型では止めず、PORTERS の判定に委ねます（[書き込み][write]の「型で止めないもの」）。
`P_Id` も出典では必須ですが、ライブラリが新規作成の印を送るので渡しません。

このリソースに ※（条件付き必須）の項目はありません。

## 項目と型

標準項目の一覧と、このライブラリの型を引く先です。

- 項目の一覧: [Candidate の項目][ref]（PORTERS の事実）
- カスタム項目（`U_` / `A_`）: 宣言してから使います（[カスタム項目][custom-fields]）

| 型                                               | 役割                            |
| ------------------------------------------------ | ------------------------------- |
| [`Candidate`][t-Candidate]                       | 読み取った 1 件                 |
| [`CandidateCreateInput`][t-CandidateCreateInput] | `create` / `createMany` の入力  |
| [`CandidateUpdateInput`][t-CandidateUpdateInput] | `update` / `updateMany` の入力  |
| [`CandidateSearchQuery`][t-CandidateSearchQuery] | `search` / `searchAll` のクエリ |
| [`CandidatePage`][t-CandidatePage]               | `search` の戻り値（1 ページ）   |
| [`CandidateResource`][t-CandidateResource]       | `t.candidate` の型              |

## 関連

- 主題: [検索][query]（条件の書き方）／[書き込み][write]（必須と一括）／[上限とレート][limits]（200 件・リクエスト長）
- リソースの一覧: [リソースと操作][resources]
- ほかの目的から探す: [目次][index]

[ref]: ../reference/resource-api/resources/candidate.md
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
[t-Candidate]: ../api/type-aliases/Candidate.md
[t-CandidateCreateInput]: ../api/type-aliases/CandidateCreateInput.md
[t-CandidateUpdateInput]: ../api/type-aliases/CandidateUpdateInput.md
[t-CandidateSearchQuery]: ../api/type-aliases/CandidateSearchQuery.md
[t-CandidatePage]: ../api/type-aliases/CandidatePage.md
[t-CandidateResource]: ../api/type-aliases/CandidateResource.md
