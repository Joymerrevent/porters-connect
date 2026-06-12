# リソース一覧（R/W・スコープ・Field Alias・ドキュメント）

出典: Resource List（2023-08-21）、各リソースの Read / Write / Field List 記事。取得日 2026-06-12。

- <https://hrbcapi.porters.jp/hc/ja/articles/115012005107-Resource-List>

## エンドポイントと命名の規則

- エンドポイントは `https://{host}/v1/{resource}`（resource はリソース名の小文字。例 `/v1/candidate`）。
- **XML のルート要素はリソース名**（`Candidate`, `Job`, ...）。
- **Field Alias の接頭辞**は原則リソース名と同じだが、**Candidate だけ `Person.P_*`**（要注意）。
- `Value` 列は Process / Phase などが内部でリソースを参照するときに使う数値 ID。

## マスタ系（読み取り専用）

| リソース  | endpoint        | スコープ      | Alias 接頭辞 | ドキュメント                                                                                                                                    |
| --------- | --------------- | ------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Partition | `/v1/partition` | `partition_r` | `Partition`  | [Read](https://hrbcapi.porters.jp/hc/ja/articles/115012006227)                                                                                  |
| User      | `/v1/user`      | `user_r`      | `User`       | [Read](https://hrbcapi.porters.jp/hc/ja/articles/115012160288) ／ [Field](https://hrbcapi.porters.jp/hc/ja/articles/360001264748)               |
| Field     | `/v1/field`     | `field_r`     | `Field`      | [Read](https://hrbcapi.porters.jp/hc/ja/articles/115012160308)                                                                                  |
| Option    | `/v1/option`    | `option_r`    | `Option`     | [Read](https://hrbcapi.porters.jp/hc/ja/articles/115012160328) ／ [Default Option List](https://hrbcapi.porters.jp/hc/ja/articles/115008016567) |

## データ系（R/W あり）

| リソース    | endpoint          | Value | スコープ                          | Alias 接頭辞  | ドキュメント                                                                                                                                                                                               |
| ----------- | ----------------- | ----- | --------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate   | `/v1/candidate`   | 1     | `candidate_r` / `candidate_w`     | **`Person`**  | [Read](https://hrbcapi.porters.jp/hc/ja/articles/115012006487) ／ [Write](https://hrbcapi.porters.jp/hc/ja/articles/115012006467) ／ [Field](https://hrbcapi.porters.jp/hc/ja/articles/115008016747)       |
| Job         | `/v1/job`         | 3     | `job_r` / `job_w`                 | `Job`         | [Read](https://hrbcapi.porters.jp/hc/ja/articles/115012006447) ／ [Write](https://hrbcapi.porters.jp/hc/ja/articles/115012160448) ／ [Field](https://hrbcapi.porters.jp/hc/ja/articles/115008171868)       |
| Client      | `/v1/client`      | 5     | `client_r` / `client_w`           | `Client`      | [Read](https://hrbcapi.porters.jp/hc/ja/articles/115012160348) ／ [Write](https://hrbcapi.porters.jp/hc/ja/articles/115012006367) ／ [Field](https://hrbcapi.porters.jp/hc/ja/articles/115008016807)       |
| Recruiter   | `/v1/recruiter`   | 9     | `recruiter_r` / `recruiter_w`     | `Recruiter`   | [Read](https://hrbcapi.porters.jp/hc/ja/articles/115012160428) ／ [Write](https://hrbcapi.porters.jp/hc/ja/articles/115012006407) ／ [Field](https://hrbcapi.porters.jp/hc/ja/articles/115008016787)       |
| Contact     | `/v1/contact`     | 27    | `contact_r` / `contact_w`         | `Contact`     | [Read](https://hrbcapi.porters.jp/hc/ja/articles/20867963087129) ／ [Write](https://hrbcapi.porters.jp/hc/ja/articles/20868297660953) ／ [Field](https://hrbcapi.porters.jp/hc/ja/articles/20868341330969) |
| Resume      | `/v1/resume`      | 17    | `resume_r` / `resume_w`           | `Resume`      | [Read](https://hrbcapi.porters.jp/hc/ja/articles/115012006527) ／ [Write](https://hrbcapi.porters.jp/hc/ja/articles/115012006507) ／ [Field](https://hrbcapi.porters.jp/hc/ja/articles/115008171848)       |
| Process     | `/v1/process`     | 7     | `process_r` / `process_w`         | `Process`     | [Read](https://hrbcapi.porters.jp/hc/ja/articles/115012160488) ／ [Write](https://hrbcapi.porters.jp/hc/ja/articles/115012160468) ／ [Field](https://hrbcapi.porters.jp/hc/ja/articles/115008016727)       |
| Activity    | `/v1/activity`    | 19    | `activity_r` / `activity_w`       | `Activity`    | [Read](https://hrbcapi.porters.jp/hc/ja/articles/115012160528) ／ [Write](https://hrbcapi.porters.jp/hc/ja/articles/115012006567) ／ [Field](https://hrbcapi.porters.jp/hc/ja/articles/115008016707)       |
| Contract    | `/v1/contract`    | 13    | `contract_r` / `contract_w`       | `Contract`    | [Read](https://hrbcapi.porters.jp/hc/ja/articles/115012007107) ／ [Write](https://hrbcapi.porters.jp/hc/ja/articles/115012007087) ／ [Field](https://hrbcapi.porters.jp/hc/ja/articles/115008171748)       |
| Sales       | `/v1/sales`       | 11    | `sales_r` / `sales_w`             | `Sales`       | [Read](https://hrbcapi.porters.jp/hc/ja/articles/115012161248) ／ [Write](https://hrbcapi.porters.jp/hc/ja/articles/115012007127) ／ [Field](https://hrbcapi.porters.jp/hc/ja/articles/115008016667)       |
| Opportunity | `/v1/opportunity` | 25    | `opportunity_r` / `opportunity_w` | `Opportunity` | [Read](https://hrbcapi.porters.jp/hc/ja/articles/21029025645209) ／ [Write](https://hrbcapi.porters.jp/hc/ja/articles/21029543509529) ／ [Field](https://hrbcapi.porters.jp/hc/ja/articles/21029666049945) |
| Phase       | `/v1/phase`       | —     | `phase_r` / `phase_w`             | `Phase`       | [Read](https://hrbcapi.porters.jp/hc/ja/articles/115012161288) ／ [Write](https://hrbcapi.porters.jp/hc/ja/articles/115012161268) ／ [Field](https://hrbcapi.porters.jp/hc/ja/articles/115008171728)       |
| Attachment  | `/v1/attachment`  | —     | `attachment_r` / `attachment_w`   | （要確認）    | [Read](https://hrbcapi.porters.jp/hc/ja/articles/115012161328) ／ [Write](https://hrbcapi.porters.jp/hc/ja/articles/115012161308) ／ [Mime Type](https://hrbcapi.porters.jp/hc/ja/articles/215428097)      |

## 補足

- **削除 API は無い**。`delete()` は型レベルでも生やさない。ただし `itemstate=deleted|all` で削除済みデータの
  Read は可能（[resource-api.md](resource-api.md) 参照）。
- Process は Job × Resume の組み合わせで一意（重複登録は Result Code 301）。
- Phase の更新には専用の作法がある（[Phase の更新について](https://hrbcapi.porters.jp/hc/ja/articles/115008171688)）。
- 各リソースの **標準項目（`P_*`）の一覧は [resources/](resources/README.md) に per-resource でまとめている**
  （出典記事から抽出）。カスタム項目（`U_` / `A_`）はテナント毎に異なるため Field Read API で取得する。
  実装時は Field 型 / Data 型の対応表（[Field Type & Data Type List](https://hrbcapi.porters.jp/hc/ja/articles/115008017407)）も併用する。
- MVP 実装順（CLAUDE.md）: OAuth → Candidate → Job → Client → Process → Resume。
