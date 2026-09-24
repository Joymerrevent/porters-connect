# 93. `porters.auth.getToken()` は Access Token の期限も返す

- Status: accepted
- Date: 2026-09-24
- Deciders: jun.shiromoto (Joymerrevent)

> 起票元は stakeholder との議論（2026-09-24）。実践例「中央のサービスがトークンを発行し、各アプリは `tokenProvider` で
> 受け取る」を書こうとしたところ、中央のサービスがトークンを取り出す `getToken()` が文字列しか返さず、アプリへ期限を
> 渡せないことが分かった。
>
> [ADR-0034][adr34] SD-6（`getToken(): Promise<string>`・デバッグ用）を**改める**。Refresh Token を返さない決定
> （SD-6 の後半）は据え置く。
>
> **decider が案A を選択し `accepted`（2026-09-24）。** 実装は accept 後・別 PR。

## Context and Problem Statement

### いまの形

`porters.auth.getToken()` は、クライアントが持っている有効な Access Token を**文字列だけ**で返す
（`src/auth/auth-api.ts`）。[ADR-0034][adr34] SD-6 はこれを「デバッグ用」と位置づけた。

一方、クライアントの中では、トークンは期限つきの組で持っている。[ADR-0091][adr91] で、キャッシュと `tokenStore` が
扱う形は `StoredTokens`（`accessToken: { token, expiresAt? }` と省略可能な `refreshToken`）になり、期限の 1 つ分の形
`IssuedToken`（`{ token, expiresAt? }`）も公開している。`getToken()` は、その中から `token` だけを取り出して返している。

### 起きていること

[ADR-0091][adr91] で `tokenProvider` を入れたことで、「中央のサービスがトークンを発行し、各アプリはそれを受け取る」
構成が書けるようになった。中央のサービスは、既定の取り方の `PortersClient` を持ち、そのトークンをアプリへ渡す。

```text
[中央のサービス]  PortersClient（既定の取り方）＋ tokenStore
      │  トークンを返すエンドポイント  ← getToken() では期限を付けられない
      ▼
[各アプリ]  tokenProvider.acquire() → { accessToken: { token, expiresAt? } }
```

中央のサービスが期限を返せないと、アプリの `acquire` も期限を返せない。アプリのクライアントは期限不明として扱い、
**PORTERS が失効を返したときの 1 回の取り直し**だけで回復することになる（[ADR-0091][adr91]「期限を信用しすぎない」の
下限の動き）。そのたびに失敗するリクエストが 1 本ずつ出る。

中央のサービスが自分の `tokenStore` から `StoredTokens` を直接読めば期限は分かるが、クライアントが使う前に取り直した
直後などは、保存先の値がクライアントの持つ値より古いことがありうる。クライアントが持っている値をそのまま返すのが確か。

### 問い

`getToken()` で、Access Token の期限も取り出せるようにするか。するなら、どういう形にするか。

## Decision Drivers

- **フェイルセーフ**: 期限を渡せれば、受け取る側は期限前に取り直せる。失効を返されてから取り直す形より、失敗する
  リクエストが減る。
- **秘密を広げない**: Refresh Token は返さない（[ADR-0034][adr34] SD-6 の後半・R-11）。渡すのは Access Token とその期限だけ。
- **公開 API を増やしすぎない**: 同じものを返す似たメソッドを並べない。
- **1.0 前**: 破壊的変更を入れるなら今が安い（[ADR-0091][adr91] と同じ判断）。

## Considered Options

- **案A: `getToken()` の戻り値を `IssuedToken`（`{ token, expiresAt? }`）に変える**
- 案B: `getToken()` は文字列のまま残し、`IssuedToken` を返すメソッドを足す（例: `getIssuedToken()`）
- 案C: 変えない（期限が要るなら、利用者が `tokenStore` から読む）

## Decision Outcome

採用: **案A**（decider が 2026-09-24 に選択）。

### 決めること

- `porters.auth.getToken(): Promise<IssuedToken>` とする。返すのは、クライアントが持っている有効な Access Token と、
  その期限（`expiresAt`・1970-01-01 からのミリ秒。取り方が期限を返さなかったときは `undefined`）。
- 返す値は、リソースの呼び出しに使うのと同じもの（期限の 60 秒前を過ぎていれば、取り直してから返す）。
- Refresh Token は返さない（据え置き）。
- 位置づけを「デバッグ用」から「クライアントが持つトークンを取り出す」に改める（中央のサービスが各アプリへ渡す用途を含む）。
  JSDoc・使い方ドキュメント（`porters.auth` の表・「認証とトークン」）を合わせる。

### 案A を採る理由

- 期限はクライアントがすでに持っている値で、`getToken()` はそこから `token` だけを捨てている。捨てずに返すだけで、
  新しい状態も新しい型も要らない（`IssuedToken` は公開済み）。
- 案B は、同じトークンを返すメソッドが 2 つ並び、どちらを使うか迷わせる。文字列だけの版を残す理由は、既存のコードを
  壊さないことだけで、1.0 前の今はそれより公開 API の小ささを取る。
- 案C は、上のとおり保存先の値が古いことがあり、中央のサービスを書く人ごとに同じ回避策を書くことになる。

### Consequences

- Good: 中央のサービスがアプリへ期限つきでトークンを渡せる。アプリのクライアントは期限前に取り直せる。
  `getToken()` の戻り値が、`tokenProvider` の `acquire` が返す `accessToken` と同じ形になり、そのまま渡せる。
- Bad: **破壊的変更**。`getToken()` の戻り値を文字列として使っているコードは、`.token` を付ける必要がある
  （`const token = await porters.auth.getToken()` → `const { token } = await porters.auth.getToken()`）。
- Neutral: Refresh Token の扱いは変わらない。

## 信じている入力

| 値               | 出どころ                          | 誰が書けるか | 守り方                                                     | 誤っていたら                                                         |
| ---------------- | --------------------------------- | ------------ | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| 返す `expiresAt` | 取り方（既定なら PORTERS の応答） | 発行側       | クライアントが持つ値をそのまま返す（取り方の値は検査済み） | 受け取る側が早すぎれば無駄に取り直し、遅すぎれば 401 で 1 回取り直す |

## Pros and Cons of the Options

- 案A — Good: メソッドが増えない。期限を渡せる。`acquire` の `accessToken` と同じ形。Bad: 戻り値の形が変わる（破壊的）。
- 案B — Good: 壊さない。Bad: 似たメソッドが 2 つ並ぶ。
- 案C — Good: 何も変えない。Bad: 期限が要る人は保存先を読むしかなく、値が古いことがある。

## More Information

- 実装（accepted 後・別 PR）: `src/auth/auth-api.ts`（戻り値と JSDoc）、token manager から `IssuedToken` を取り出す口、
  テスト、API リファレンスの生成し直し、使い方ドキュメント（`client/auth.md` の表・「認証とトークン」の例）、changeset（minor・破壊的）。
- この ADR の後で、実践例「トークンを DB に保存する（`tokenStore`）」と「中央のサービスから `tokenProvider` で受け取る」を書く。
- 改める箇所: [ADR-0034][adr34] SD-6 の「`getToken(): Promise<string>`・デバッグ用」。accepted 後に一行の注記を足す
  （本文の決定は書き換えない）。

[adr34]: 0034-oauth-public-surface-impl.md
[adr91]: 0091-token-provider-and-store.md
