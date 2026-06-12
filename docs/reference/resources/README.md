# リソース別 フィールドリファレンス

各リソースの標準項目（`P_*`）を出典記事から抽出した一覧です。カスタム項目（`U_`/`A_`）は
テナント毎に異なるため [Field Read API](../resource-api.md) で取得します。横断仕様は
[../resource-api.md](../resource-api.md)、リソース全体像は [../resources.md](../resources.md) を参照。

## データ系

- [Candidate](candidate.md) — `/v1/candidate`（candidate_r / candidate_w）
- [Job](job.md) — `/v1/job`（job_r / job_w）
- [Client](client.md) — `/v1/client`（client_r / client_w）
- [Recruiter](recruiter.md) — `/v1/recruiter`（recruiter_r / recruiter_w）
- [Contact](contact.md) — `/v1/contact`（contact_r / contact_w）
- [Resume](resume.md) — `/v1/resume`（resume_r / resume_w）
- [Process](process.md) — `/v1/process`（process_r / process_w）
- [Activity](activity.md) — `/v1/activity`（activity_r / activity_w）
- [Contract](contract.md) — `/v1/contract`（contract_r / contract_w）
- [Sales](sales.md) — `/v1/sales`（sales_r / sales_w）
- [Opportunity](opportunity.md) — `/v1/opportunity`（opportunity_r / opportunity_w）
- [Phase](phase.md) — `/v1/phase`（phase_r / phase_w）

## マスタ系（読み取り専用）

- [Partition](partition.md) — `/v1/partition`（partition_r）
- [User](user.md) — `/v1/user`（user_r）
- [Field](field.md) — `/v1/field`（field_r）
- [Option](option.md) — `/v1/option`（option_r）

## 添付

- [Attachment](attachment.md) — `/v1/attachment`（attachment_r / attachment_w）
