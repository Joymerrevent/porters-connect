---
"@joymerrevent/porters-connect": minor
---

**（破壊的）`porters.auth.getToken()` は、Access Token の文字列ではなく `{ token, expiresAt? }`（`IssuedToken`）を返すようになりました**。`expiresAt` は 1970-01-01 からのミリ秒で、取り方が期限を返さなかったときは省かれます。リソースの呼び出しに使うのと同じトークンで、期限が近ければ取り直してから返します。中央のサービスが各アプリの `tokenProvider` にトークンを渡すとき、期限もそのまま渡せます。`const token = await porters.auth.getToken()` は `const { token } = await porters.auth.getToken()` に書き換えてください。Refresh Token はこれまでどおり返しません。
