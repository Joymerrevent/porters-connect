# 認証エラーコード（リソースの Result Code とは別系統）

出典: <https://hrbcapi.porters.jp/hc/ja/articles/115008172688-Authentication-and-Authorization-Error>（updated_at 2021-06-03、取得 2026-06-12）。
全体像は [認証 README][readme]。

OAuth / Token のエラーは root 要素 `<Authentication>` の `<Error>` に出る。
redirect の場合は `?error=コード`。**Resource API の Result Code（[result-codes][result-codes]）とは番号体系が異なる**ので混同しない。

```xml
<Authentication>
  <Error>100</Error>
  <Message>Wrong redirect_url</Message>
</Authentication>
```

| Code | 意味                                      |
| ---- | ----------------------------------------- |
| 0    | 成功                                      |
| -1   | キャンセル                                |
| 100  | redirect_url が無効                       |
| 101  | redirect_url 未指定                       |
| 102  | scope が無効                              |
| 103  | code が無効                               |
| 104  | app_id が無効                             |
| 105  | secret が無効                             |
| 106  | Access Token が無効                       |
| 107  | Refresh Token が無効                      |
| 108  | 認証サーバー内部エラー                    |
| 109  | セッション情報が取得できない              |
| 110  | response_type が無効                      |
| 111  | 削除できる権限が無い                      |
| 112  | grant_type が無効                         |
| 113  | 登録アプリのサイトが無い                  |
| 114  | ユーザーが見つからない                    |
| 115  | アクセス拒否                              |
| 116  | アクセス権限が無い                        |
| 117  | Access Token 未指定                       |
| 400  | **Access Token の有効期限切れ** → Refresh |
| 401  | **Refresh Token の有効期限切れ** → 再認証 |
| 402  | アクセス許可が無い                        |

エラーモデル（ライブラリの `PortersError`）への対応は ADR-0006 を参照。
利用者向けの症状別対処は [エラーハンドリング ガイド][guide] を参照。

[readme]: README.md
[result-codes]: ../resource-api/result-codes.md
[guide]: ../../guide/error-handling.md
