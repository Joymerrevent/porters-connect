---
"@joymerrevent/porters-connect": minor
---

HTTP ステータスをエラーモデルへ配線（ADR-0044）: PORTERS の応答でない HTTP エラー（LB・プロキシ・WAF・メンテナンス画面の 4xx/5xx）が
`category: "unknown"` に落ちず分類されるようになりました。PORTERS の `<Code>`/`<Error>` を持つ応答はそちらが優先され（＋`httpStatus`）、
無い場合だけ status から判定します（5xx→`server` / 429→`rateLimit` / 408→`network` / 401・403→`permission` / その他 4xx→`config`）。
`PortersError.httpStatus` が実際に載るようになり、`category: "rateLimit"` が初めて produce されます。挙動変更のため minor。
