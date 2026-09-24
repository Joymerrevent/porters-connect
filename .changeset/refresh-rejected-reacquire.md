---
"@joymerrevent/porters-connect": patch
---

既定の取り方で、PORTERS が Refresh Token を受け付けなかったとき（期限切れ・無効）に `code_direct` で取り直すようになりました。これまでは手元の期限がまだ先だと同じ refresh を繰り返し、`clearTokens()` を呼ぶまで回復しませんでした。あわせて、トークンの取得が認証 API の 401 / 402 で失敗したときに、もう一度取り直しを強いることをやめました。
