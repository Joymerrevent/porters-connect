# リソース別 フィールドリファレンス

各リソースの標準項目（`P_*`）を出典記事から抽出した一覧です。カスタム項目（`U_`/`A_`）は
テナント毎に異なるため [Field Read API][resource-api] で取得します。横断仕様は
[resource-api.md][resource-api]、リソース全体像は [resources.md][resources] を参照。

## データ系

- [Candidate][candidate] — `/v1/candidate`
- [Job][job] — `/v1/job`
- [Client][client] — `/v1/client`
- [Recruiter][recruiter] — `/v1/recruiter`
- [Contact][contact] — `/v1/contact`
- [Resume][resume] — `/v1/resume`
- [Process][process] — `/v1/process`
- [Activity][activity] — `/v1/activity`
- [Contract][contract] — `/v1/contract`
- [Sales][sales] — `/v1/sales`
- [Opportunity][opportunity] — `/v1/opportunity`
- [Phase][phase] — `/v1/phase`

## マスタ系（読み取り専用）

- [Partition][partition] — `/v1/partition`
- [User][user] — `/v1/user`
- [Field][field] — `/v1/field`
- [Option][option] — `/v1/option`

## 添付

- [Attachment][attachment] — `/v1/attachment`

[resource-api]: ../resource-api.md
[resources]: ../resources.md
[candidate]: candidate.md
[job]: job.md
[client]: client.md
[recruiter]: recruiter.md
[contact]: contact.md
[resume]: resume.md
[process]: process.md
[activity]: activity.md
[contract]: contract.md
[sales]: sales.md
[opportunity]: opportunity.md
[phase]: phase.md
[partition]: partition.md
[user]: user.md
[field]: field.md
[option]: option.md
[attachment]: attachment.md
