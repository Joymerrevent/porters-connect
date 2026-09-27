---
"@joymerrevent/porters-connect": patch
---

**トークンの保存先への書き込みと、食い違った応答の扱いを直しました。**

- **`tokenStore` の `set` / `clear` を、呼んだ順に 1 つずつ呼びます。** 保存中に `clearTokens()` を呼んで保存先の `clear` が失敗したとき、`clearTokens()` が成功で返り、保存先にトークンが残ることがありました。今は `clearTokens()` がそのエラーで失敗します。
- **200 以外の status で PORTERS の成功の応答が届いたら、`code: 0`・`category: "unknown"` のエラーにします。** これまでは `code: null` にしていたので、`createMany` は 3xx / 4xx のバッチを「書き込まれていない」と案内していました。今は「書き込まれた可能性がある」と案内します。
