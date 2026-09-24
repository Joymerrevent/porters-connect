---
"@joymerrevent/porters-connect": minor
---

**（破壊的）トークンの取り方を `tokenProvider` で、置き場所を `tokenStore` で別々に渡すようになりました**（ADR-0091・RV-63）。キャッシュ・期限の判断・失効時の取り直し・同時呼び出しの 1 本化・保存は、どちらの取り方でもクライアントが受け持ちます。

- 構築オプション `auth` は廃止。`auth: { getAccessToken: async () => t() }` は `tokenProvider: { acquire: async () => ({ accessToken: { token: await t() } }) }` に書き換える。`auth` や `getAccessToken` だけの形を渡すと構築時に `PortersConfigError`
- `TokenProvider` は `{ acquire, refresh?, exchange? }`。`GetAccessTokenOptions` は公開 API から外した
- `StoredTokens` は `{ accessToken: { token, expiresAt? }, refreshToken?: { token, expiresAt? } }`。以前の形で保存されたデータは読めないものとして扱い、上げた直後の 1 回だけ `code_direct` で取り直す
- `tokenStore` は `tokenProvider` を渡したときも使われる。`porters.auth` の 6 メソッドは必要なものがあればどの取り方でも動く（`exchangeAuthorizationCode` は `exchange` が要る）
- 既定の取り方で `appId` / `appSecret` が無いときは、PORTERS へ送る前に `PortersConfigError` になる
- 保存済みの Access Token がまだ有効なら、起動直後にも取りに行かない
