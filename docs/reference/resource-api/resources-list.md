# リソース一覧（R/W・スコープ・Field Alias・ドキュメント）

出典: Resource List（2023-08-21）、各リソースの Read / Write / Field List 記事。取得日 2026-06-12。

- <https://hrbcapi.porters.jp/hc/ja/articles/115012005107-Resource-List>

## エンドポイントと命名の規則

- エンドポイントは `https://{host}/v1/{resource}`（resource はリソース名の小文字。例 `/v1/candidate`）。
- **XML のルート要素はリソース名**（`Candidate`, `Job`, ...）。
- **Field Alias の接頭辞**は原則リソース名と同じだが、**Candidate だけ `Person.P_*`**（要注意）。
- `Value` 列は Process / Phase などが内部でリソースを参照するときに使う数値 ID。

## マスタ系（読み取り専用）

| リソース  | endpoint        | スコープ      | Alias 接頭辞 | ドキュメント                                                      |
| --------- | --------------- | ------------- | ------------ | ----------------------------------------------------------------- |
| Partition | `/v1/partition` | `partition_r` | `Partition`  | [Read][partition-read]                                            |
| User      | `/v1/user`      | `user_r`      | `User`       | [Read][user-read] ／ [Field][user-field]                          |
| Field     | `/v1/field`     | `field_r`     | `Field`      | [Read][field-read]                                                |
| Option    | `/v1/option`    | `option_r`    | `Option`     | [Read][option-read] ／ [Default Option List][default-option-list] |

## データ系（R/W あり）

| リソース    | endpoint          | Value | スコープ                          | Alias 接頭辞  | ドキュメント                                                                         |
| ----------- | ----------------- | ----- | --------------------------------- | ------------- | ------------------------------------------------------------------------------------ |
| Candidate   | `/v1/candidate`   | 1     | `candidate_r` / `candidate_w`     | **`Person`**  | [Read][candidate-read] ／ [Write][candidate-write] ／ [Field][candidate-field]       |
| Job         | `/v1/job`         | 3     | `job_r` / `job_w`                 | `Job`         | [Read][job-read] ／ [Write][job-write] ／ [Field][job-field]                         |
| Client      | `/v1/client`      | 5     | `client_r` / `client_w`           | `Client`      | [Read][client-read] ／ [Write][client-write] ／ [Field][client-field]                |
| Recruiter   | `/v1/recruiter`   | 9     | `recruiter_r` / `recruiter_w`     | `Recruiter`   | [Read][recruiter-read] ／ [Write][recruiter-write] ／ [Field][recruiter-field]       |
| Contact     | `/v1/contact`     | 27    | `contact_r` / `contact_w`         | `Contact`     | [Read][contact-read] ／ [Write][contact-write] ／ [Field][contact-field]             |
| Resume      | `/v1/resume`      | 17    | `resume_r` / `resume_w`           | `Resume`      | [Read][resume-read] ／ [Write][resume-write] ／ [Field][resume-field]                |
| Process     | `/v1/process`     | 7     | `process_r` / `process_w`         | `Process`     | [Read][process-read] ／ [Write][process-write] ／ [Field][process-field]             |
| Activity    | `/v1/activity`    | 19    | `activity_r` / `activity_w`       | `Activity`    | [Read][activity-read] ／ [Write][activity-write] ／ [Field][activity-field]          |
| Contract    | `/v1/contract`    | 13    | `contract_r` / `contract_w`       | `Contract`    | [Read][contract-read] ／ [Write][contract-write] ／ [Field][contract-field]          |
| Sales       | `/v1/sales`       | 11    | `sales_r` / `sales_w`             | `Sales`       | [Read][sales-read] ／ [Write][sales-write] ／ [Field][sales-field]                   |
| Opportunity | `/v1/opportunity` | 25    | `opportunity_r` / `opportunity_w` | `Opportunity` | [Read][opportunity-read] ／ [Write][opportunity-write] ／ [Field][opportunity-field] |
| Phase       | `/v1/phase`       | —     | `phase_r` / `phase_w`             | `Phase`       | [Read][phase-read] ／ [Write][phase-write] ／ [Field][phase-field]                   |
| Attachment  | `/v1/attachment`  | —     | `attachment_r` / `attachment_w`   | 接頭辞なし    | [Read][attachment-read] ／ [Write][attachment-write] ／ [Mime Type][mime-type]       |

## 補足

- 上表の **スコープ列は自リソースの R/W のみ**。**Read は参照する上位リソースの `_r` も必要**で、
  ほぼ常に `user_r` / `option_r` を含む（例: Process Read =
  `process_r, candidate_r, resume_r, client_r, recruiter_r, job_r, user_r, option_r`）。
  各リソースの正確な Read / Write スコープは [resources/][resources] の各ページを参照。
- **削除 API は無い**。`delete()` は型レベルでも生やさない。ただし `itemstate=deleted|all` で削除済みデータの
  Read は可能（[Resource API 概要][resource-api-md] 参照）。
- Process は Job × Resume の組み合わせで一意（重複登録は Result Code 301）。
- Phase の更新には専用の作法がある（[Phase の更新について][phase]）。
- 各リソースの **標準項目（`P_*`）の一覧は [resources/][resources] に per-resource でまとめている**
  （出典記事から抽出）。カスタム項目（`U_` / `A_`）はテナント毎に異なるため Field Read API で取得する。
  実装時は Field 型 / Data 型の対応表（[Field Type & Data Type List][field-type-and-data-type-list]）も併用する。
- MVP 実装順（CLAUDE.md / ADR-0003）: OAuth → Candidate → Job → Client → Process → Resume → Attachment。

[partition-read]: https://hrbcapi.porters.jp/hc/ja/articles/115012006227
[user-read]: https://hrbcapi.porters.jp/hc/ja/articles/115012160288
[user-field]: https://hrbcapi.porters.jp/hc/ja/articles/360001264748
[field-read]: https://hrbcapi.porters.jp/hc/ja/articles/115012160308
[option-read]: https://hrbcapi.porters.jp/hc/ja/articles/115012160328
[default-option-list]: https://hrbcapi.porters.jp/hc/ja/articles/115008016567
[candidate-read]: https://hrbcapi.porters.jp/hc/ja/articles/115012006487
[candidate-write]: https://hrbcapi.porters.jp/hc/ja/articles/115012006467
[candidate-field]: https://hrbcapi.porters.jp/hc/ja/articles/115008016747
[job-read]: https://hrbcapi.porters.jp/hc/ja/articles/115012006447
[job-write]: https://hrbcapi.porters.jp/hc/ja/articles/115012160448
[job-field]: https://hrbcapi.porters.jp/hc/ja/articles/115008171868
[client-read]: https://hrbcapi.porters.jp/hc/ja/articles/115012160348
[client-write]: https://hrbcapi.porters.jp/hc/ja/articles/115012006367
[client-field]: https://hrbcapi.porters.jp/hc/ja/articles/115008016807
[recruiter-read]: https://hrbcapi.porters.jp/hc/ja/articles/115012160428
[recruiter-write]: https://hrbcapi.porters.jp/hc/ja/articles/115012006407
[recruiter-field]: https://hrbcapi.porters.jp/hc/ja/articles/115008016787
[contact-read]: https://hrbcapi.porters.jp/hc/ja/articles/20867963087129
[contact-write]: https://hrbcapi.porters.jp/hc/ja/articles/20868297660953
[contact-field]: https://hrbcapi.porters.jp/hc/ja/articles/20868341330969
[resume-read]: https://hrbcapi.porters.jp/hc/ja/articles/115012006527
[resume-write]: https://hrbcapi.porters.jp/hc/ja/articles/115012006507
[resume-field]: https://hrbcapi.porters.jp/hc/ja/articles/115008171848
[process-read]: https://hrbcapi.porters.jp/hc/ja/articles/115012160488
[process-write]: https://hrbcapi.porters.jp/hc/ja/articles/115012160468
[process-field]: https://hrbcapi.porters.jp/hc/ja/articles/115008016727
[activity-read]: https://hrbcapi.porters.jp/hc/ja/articles/115012160528
[activity-write]: https://hrbcapi.porters.jp/hc/ja/articles/115012006567
[activity-field]: https://hrbcapi.porters.jp/hc/ja/articles/115008016707
[contract-read]: https://hrbcapi.porters.jp/hc/ja/articles/115012007107
[contract-write]: https://hrbcapi.porters.jp/hc/ja/articles/115012007087
[contract-field]: https://hrbcapi.porters.jp/hc/ja/articles/115008171748
[sales-read]: https://hrbcapi.porters.jp/hc/ja/articles/115012161248
[sales-write]: https://hrbcapi.porters.jp/hc/ja/articles/115012007127
[sales-field]: https://hrbcapi.porters.jp/hc/ja/articles/115008016667
[opportunity-read]: https://hrbcapi.porters.jp/hc/ja/articles/21029025645209
[opportunity-write]: https://hrbcapi.porters.jp/hc/ja/articles/21029543509529
[opportunity-field]: https://hrbcapi.porters.jp/hc/ja/articles/21029666049945
[phase-read]: https://hrbcapi.porters.jp/hc/ja/articles/115012161288
[phase-write]: https://hrbcapi.porters.jp/hc/ja/articles/115012161268
[phase-field]: https://hrbcapi.porters.jp/hc/ja/articles/115008171728
[attachment-read]: https://hrbcapi.porters.jp/hc/ja/articles/115012161328
[attachment-write]: https://hrbcapi.porters.jp/hc/ja/articles/115012161308
[mime-type]: https://hrbcapi.porters.jp/hc/ja/articles/215428097
[resources]: resources/README.md
[resource-api-md]: README.md
[phase]: https://hrbcapi.porters.jp/hc/ja/articles/115008171688
[field-type-and-data-type-list]: https://hrbcapi.porters.jp/hc/ja/articles/115008017407
