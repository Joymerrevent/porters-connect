# リソースと操作

`porters.tenant(id)` で束ねたスコープ（`t`）の下に、PORTERS の全リソースがあります。**呼べるメソッドは行ごとに違う**ので、
まずこの表で確かめてから、各リソースのページへ進んでください。ページはどれも同じ節構成です
（呼べるメソッド → 固有の注意 → 新規作成の必須項目 → 項目と型）。

## マスタ系（読み取り専用）

指定できるものが違います。`condition` と `get(id)` はありません。

| アクセサ            | リソース                      | 読み                               | 固有の注意                                             |
| ------------------- | ----------------------------- | ---------------------------------- | ------------------------------------------------------ |
| `porters.partition` | [Partition（Company DB）][pa] | `search` / `searchAll`             | **client 直下**（`tenant()` を通さない唯一の読み取り） |
| `t.user`            | [User（ユーザー）][u]         | `search` / `searchAll` / `current` | `current()` で自分が誰かを知る                         |
| `t.department`      | [Department（部署）][d]       | `search` / `searchAll`             | 絞り込み無し。スコープは `user_r`                      |
| `t.field`           | [Field（項目定義）][f]        | `search` / `searchAll`             | **先に `of("candidate")` で束ねる**                    |
| `t.option`          | [Option（選択肢）][op]        | `search`                           | **`searchAll` なし**                                   |

## データ系（読み書き）

| アクセサ        | リソース                         | 読み                           | 書き                                              | 固有の注意                                          |
| --------------- | -------------------------------- | ------------------------------ | ------------------------------------------------- | --------------------------------------------------- |
| `t.candidate`   | [Candidate（個人連絡先）][c]     | `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` | 接頭辞が `Person.`                                  |
| `t.job`         | [Job（JOB）][j]                  | `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |                                                     |
| `t.client`      | [Client（企業）][cl]             | `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |                                                     |
| `t.recruiter`   | [Recruiter（企業担当者）][r]     | `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |                                                     |
| `t.contact`     | [Contact（コンタクト）][ct]      | `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |                                                     |
| `t.opportunity` | [Opportunity（商談管理）][o]     | `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |                                                     |
| `t.activity`    | [Activity（アクティビティ）][a]  | `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` | `P_Resource` は数値                                 |
| `t.contract`    | [Contract（契約）][co]           | `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` | `P_Owner` が無い                                    |
| `t.sales`       | [Sales（成約・売上）][s]         | `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` | 参照 6 項目に依存の規則                             |
| `t.process`     | [Process（選考プロセス）][p]     | `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` | JOB × レジュメで一意                                |
| `t.resume`      | [Resume（レジュメ）][re]         | `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` |                                                     |
| `t.phase`       | [Phase（フェーズ履歴）][ph]      | `search` / `searchAll` / `get` | `create` / `update` / `createMany` / `updateMany` | **先に `of("candidate")` で束ねる**                 |
| `t.attachment`  | [Attachment（添付ファイル）][at] | `search` / `searchAll` / `get` | `create` / `update`（**一括なし**）               | **先に `of("resume")` で束ねる**。本体は `get` だけ |

**`delete` はどの行にもありません**（[削除と削除済みデータ][deleted]）。`createMany` / `updateMany` は 200 件を超えても
自動で分割します（[書き込み][write]）。

引数・戻り値の正確な定義は [公開 API の全記号][api]、項目の一覧は [PORTERS API の事実][ref] です。

## 関連

- 主題: [検索][query]／[書き込み][write]／[Partition とテナントスコープ][tenant]
- ほかの目的から探す: [目次][index]

[c]: candidate.md
[j]: job.md
[cl]: client.md
[r]: recruiter.md
[ct]: contact.md
[o]: opportunity.md
[a]: activity.md
[co]: contract.md
[s]: sales.md
[p]: process.md
[re]: resume.md
[ph]: phase.md
[at]: attachment.md
[pa]: partition.md
[u]: user.md
[d]: department.md
[f]: field.md
[op]: option.md
[deleted]: ../topics/deleted.md
[write]: ../topics/write.md
[query]: ../topics/query.md
[tenant]: ../topics/tenant.md
[api]: ../api/index.md
[ref]: ../reference/README.md
[index]: ../index.md
