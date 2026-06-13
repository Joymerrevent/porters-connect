# リソース一覧（R/W・スコープ・Field Alias・ドキュメント）

出典: Resource List（2023-08-21）、各リソースの Read / Write / Field List 記事。取得日 2026-06-12。

- <https://hrbcapi.porters.jp/hc/ja/articles/115012005107-Resource-List>

## エンドポイントと命名の規則

- エンドポイントは `https://{host}/v1/{resource}`（resource はリソース名の小文字。例 `/v1/candidate`）。
- **XML のルート要素はリソース名**（`Candidate`, `Job`, ...）。
- **Field Alias の接頭辞**は原則リソース名と同じだが、**Candidate だけ `Person.P_*`**（要注意）。
- `Value` 列は Process / Phase などが内部でリソースを参照するときに使う数値 ID。

## マスタ系（読み取り専用）

| リソース  | endpoint        | スコープ      | Alias 接頭辞 | ドキュメント                                |
| --------- | --------------- | ------------- | ------------ | ------------------------------------------- |
| Partition | `/v1/partition` | `partition_r` | `Partition`  | [Read][ref1]                                |
| User      | `/v1/user`      | `user_r`      | `User`       | [Read][ref2] ／ [Field][ref3]               |
| Field     | `/v1/field`     | `field_r`     | `Field`      | [Read][ref4]                                |
| Option    | `/v1/option`    | `option_r`    | `Option`     | [Read][ref5] ／ [Default Option List][ref6] |

## データ系（R/W あり）

| リソース    | endpoint          | Value | スコープ                          | Alias 接頭辞  | ドキュメント                                          |
| ----------- | ----------------- | ----- | --------------------------------- | ------------- | ----------------------------------------------------- |
| Candidate   | `/v1/candidate`   | 1     | `candidate_r` / `candidate_w`     | **`Person`**  | [Read][ref7] ／ [Write][ref8] ／ [Field][ref9]        |
| Job         | `/v1/job`         | 3     | `job_r` / `job_w`                 | `Job`         | [Read][ref10] ／ [Write][ref11] ／ [Field][ref12]     |
| Client      | `/v1/client`      | 5     | `client_r` / `client_w`           | `Client`      | [Read][ref13] ／ [Write][ref14] ／ [Field][ref15]     |
| Recruiter   | `/v1/recruiter`   | 9     | `recruiter_r` / `recruiter_w`     | `Recruiter`   | [Read][ref16] ／ [Write][ref17] ／ [Field][ref18]     |
| Contact     | `/v1/contact`     | 27    | `contact_r` / `contact_w`         | `Contact`     | [Read][ref19] ／ [Write][ref20] ／ [Field][ref21]     |
| Resume      | `/v1/resume`      | 17    | `resume_r` / `resume_w`           | `Resume`      | [Read][ref22] ／ [Write][ref23] ／ [Field][ref24]     |
| Process     | `/v1/process`     | 7     | `process_r` / `process_w`         | `Process`     | [Read][ref25] ／ [Write][ref26] ／ [Field][ref27]     |
| Activity    | `/v1/activity`    | 19    | `activity_r` / `activity_w`       | `Activity`    | [Read][ref28] ／ [Write][ref29] ／ [Field][ref30]     |
| Contract    | `/v1/contract`    | 13    | `contract_r` / `contract_w`       | `Contract`    | [Read][ref31] ／ [Write][ref32] ／ [Field][ref33]     |
| Sales       | `/v1/sales`       | 11    | `sales_r` / `sales_w`             | `Sales`       | [Read][ref34] ／ [Write][ref35] ／ [Field][ref36]     |
| Opportunity | `/v1/opportunity` | 25    | `opportunity_r` / `opportunity_w` | `Opportunity` | [Read][ref37] ／ [Write][ref38] ／ [Field][ref39]     |
| Phase       | `/v1/phase`       | —     | `phase_r` / `phase_w`             | `Phase`       | [Read][ref40] ／ [Write][ref41] ／ [Field][ref42]     |
| Attachment  | `/v1/attachment`  | —     | `attachment_r` / `attachment_w`   | （要確認）    | [Read][ref43] ／ [Write][ref44] ／ [Mime Type][ref45] |

## 補足

- 上表の **スコープ列は自リソースの R/W のみ**。**Read は参照する上位リソースの `_r` も必要**で、
  ほぼ常に `user_r` / `option_r` を含む（例: Process Read =
  `process_r, candidate_r, resume_r, client_r, recruiter_r, job_r, user_r, option_r`）。
  各リソースの正確な Read / Write スコープは [resources/][ref46] の各ページを参照。
- **削除 API は無い**。`delete()` は型レベルでも生やさない。ただし `itemstate=deleted|all` で削除済みデータの
  Read は可能（[resource-api.md][ref47] 参照）。
- Process は Job × Resume の組み合わせで一意（重複登録は Result Code 301）。
- Phase の更新には専用の作法がある（[Phase の更新について][ref48]）。
- 各リソースの **標準項目（`P_*`）の一覧は [resources/][ref46] に per-resource でまとめている**
  （出典記事から抽出）。カスタム項目（`U_` / `A_`）はテナント毎に異なるため Field Read API で取得する。
  実装時は Field 型 / Data 型の対応表（[Field Type & Data Type List][ref49]）も併用する。
- MVP 実装順（CLAUDE.md）: OAuth → Candidate → Job → Client → Process → Resume。

[ref1]: https://hrbcapi.porters.jp/hc/ja/articles/115012006227
[ref2]: https://hrbcapi.porters.jp/hc/ja/articles/115012160288
[ref3]: https://hrbcapi.porters.jp/hc/ja/articles/360001264748
[ref4]: https://hrbcapi.porters.jp/hc/ja/articles/115012160308
[ref5]: https://hrbcapi.porters.jp/hc/ja/articles/115012160328
[ref6]: https://hrbcapi.porters.jp/hc/ja/articles/115008016567
[ref7]: https://hrbcapi.porters.jp/hc/ja/articles/115012006487
[ref8]: https://hrbcapi.porters.jp/hc/ja/articles/115012006467
[ref9]: https://hrbcapi.porters.jp/hc/ja/articles/115008016747
[ref10]: https://hrbcapi.porters.jp/hc/ja/articles/115012006447
[ref11]: https://hrbcapi.porters.jp/hc/ja/articles/115012160448
[ref12]: https://hrbcapi.porters.jp/hc/ja/articles/115008171868
[ref13]: https://hrbcapi.porters.jp/hc/ja/articles/115012160348
[ref14]: https://hrbcapi.porters.jp/hc/ja/articles/115012006367
[ref15]: https://hrbcapi.porters.jp/hc/ja/articles/115008016807
[ref16]: https://hrbcapi.porters.jp/hc/ja/articles/115012160428
[ref17]: https://hrbcapi.porters.jp/hc/ja/articles/115012006407
[ref18]: https://hrbcapi.porters.jp/hc/ja/articles/115008016787
[ref19]: https://hrbcapi.porters.jp/hc/ja/articles/20867963087129
[ref20]: https://hrbcapi.porters.jp/hc/ja/articles/20868297660953
[ref21]: https://hrbcapi.porters.jp/hc/ja/articles/20868341330969
[ref22]: https://hrbcapi.porters.jp/hc/ja/articles/115012006527
[ref23]: https://hrbcapi.porters.jp/hc/ja/articles/115012006507
[ref24]: https://hrbcapi.porters.jp/hc/ja/articles/115008171848
[ref25]: https://hrbcapi.porters.jp/hc/ja/articles/115012160488
[ref26]: https://hrbcapi.porters.jp/hc/ja/articles/115012160468
[ref27]: https://hrbcapi.porters.jp/hc/ja/articles/115008016727
[ref28]: https://hrbcapi.porters.jp/hc/ja/articles/115012160528
[ref29]: https://hrbcapi.porters.jp/hc/ja/articles/115012006567
[ref30]: https://hrbcapi.porters.jp/hc/ja/articles/115008016707
[ref31]: https://hrbcapi.porters.jp/hc/ja/articles/115012007107
[ref32]: https://hrbcapi.porters.jp/hc/ja/articles/115012007087
[ref33]: https://hrbcapi.porters.jp/hc/ja/articles/115008171748
[ref34]: https://hrbcapi.porters.jp/hc/ja/articles/115012161248
[ref35]: https://hrbcapi.porters.jp/hc/ja/articles/115012007127
[ref36]: https://hrbcapi.porters.jp/hc/ja/articles/115008016667
[ref37]: https://hrbcapi.porters.jp/hc/ja/articles/21029025645209
[ref38]: https://hrbcapi.porters.jp/hc/ja/articles/21029543509529
[ref39]: https://hrbcapi.porters.jp/hc/ja/articles/21029666049945
[ref40]: https://hrbcapi.porters.jp/hc/ja/articles/115012161288
[ref41]: https://hrbcapi.porters.jp/hc/ja/articles/115012161268
[ref42]: https://hrbcapi.porters.jp/hc/ja/articles/115008171728
[ref43]: https://hrbcapi.porters.jp/hc/ja/articles/115012161328
[ref44]: https://hrbcapi.porters.jp/hc/ja/articles/115012161308
[ref45]: https://hrbcapi.porters.jp/hc/ja/articles/215428097
[ref46]: resources/README.md
[ref47]: resource-api.md
[ref48]: https://hrbcapi.porters.jp/hc/ja/articles/115008171688
[ref49]: https://hrbcapi.porters.jp/hc/ja/articles/115008017407
