---
"@joymerrevent/porters-connect": patch
---

**設定の誤りや、まれな時機の不具合を、送る前・起動時に止めるようにしました。**

- **`PortersClient` の構築時に、オプションの形を確かめるようになりました。** `transport` / `throttle` / `tokenStore` がメソッドを持たないときや、`appId` / `appSecret` が文字列でないとき、`scopes` が文字列の配列でないときは `PortersConfigError` になります。これまでは最初のリクエストで `TypeError` になっていました。
- **`tenant(id)` の id は正の整数だけを受け付けます。** 添付ファイル・Phase・Field の `of(name)` も、知らない名前を送る前に `PortersConfigError` で止めます。
- **`hostname` に `%` を含む名前や、https の URL として組み立てられない名前は、起動時に `PortersConfigError` になります。**
- **同じサーバーに届く書き方は、同じレート制限を数えるようになりました。** `a.test`・`A.test`・`a.test.`・`a.test`（`port: 443`）は、1 つの上限を共有します。
- **認証の応答に `<Error>` が無いときは、成功と読まずにエラーにします。** 期限が数でないときは、期限切れとして取り直します。
- **トークンの読み込みや取り直しの途中で `porters.auth` の操作をしても、古いトークンで上書きしなくなりました。**
- **HTTP 3xx の応答のエラーの `hint` が、リダイレクトであることと、確かめる設定を案内するようになりました。**
- **自作の `transport` が投げた `PortersError` を、書き込みの結果が分からないエラーとして作り直すとき、元のクラスを保つようになりました。**
