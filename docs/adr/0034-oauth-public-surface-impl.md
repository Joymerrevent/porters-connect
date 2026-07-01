# 34. OAuth 公開 API porters.auth.\* の詳細設計（F-1）

- Status: accepted
- Date: 2026-06-23
- Deciders: jun.shiromoto (Joymerrevent)

> [[0007-oauth-public-surface]]（基本設計・SD-3/SD-6）が約束した公開 API `porters.auth.*` を実装に落とす**詳細設計**。
> [[0033-post-mvp-direction]] 案F-1（v1 公開 API の積み残し）。**公開シェイプは ADR-0007 で確定済み**で再決定しない。
> 本 ADR は**内部実装と、reference に接地した挙動の確定**に限る。案A ＋ SD 全採用で `accepted`（2026-06-23）。

## Context and Problem Statement

[[0007-oauth-public-surface]] は OAuth の公開 API を確定した（SD-3＝初回 `code` グラントの URL 生成＋code 交換ヘルパー、
SD-6＝任意の `ensureAuthenticated()`）。具体的には `porters.auth.*`（`authorizationUrl` / `exchangeAuthorizationCode` /
`revoke` ＋ `ensureAuthenticated` / `getToken`）。

しかし現状、出荷されているのは**既定の透過ストラテジ（`code_direct`＋キャッシュ＋ハイブリッド refresh、
[[0012-token-cache-refresh]]）だけ**で、これは requester が内部利用する `TokenProvider` に閉じている
（`src/auth/token-provider.ts`）。**`PortersClient` に `auth` アクセサは存在しない**（横断監査 2026-06-22・[reviews][rev]）。

結果、**初回の Company DB 権限付与（人間がブラウザで `code` を承諾）を補助する公開 API が無い**。これは
`code_direct` の前提（[oauth][oauth]「`code_direct` を使う前に対象 Company DB ごとに一度だけ `code` で権限付与」）であり、
案A（第2層 MCP）・対話シナリオの土台でもある。受け入れ済み設計と実装のギャップ＝v1 公開 API の積み残し。

決めるべきは「**この公開 API をどこに・どう実装し、reference にどう一致させるか**」。あわせて 1 点、reference の事実と
ADR-0007 の例示の食い違いを解消する: [oauth][oauth] では **`remove`（権限削除）もブラウザ必須**
（ログアウト状態で URL 実行 → ログイン → 削除承諾 → redirect `remove_confirmation=0`/`-1`）で、サーバ間の
`remove_direct` は存在しない。よって ADR-0007 例示の `await porters.auth.revoke(scopes)`（サーバ完結の削除）は
**ドキュメント API では実現できない**。詳細設計でここを正直に作り直す。

## Decision Drivers

- **API 忠実**（[[0002-ground-design-in-live-api-docs]]）: [oauth][oauth] / [token][token] に一致させる。`code` は redirect、
  `remove` はブラウザ必須、`secret` は Token エンドポイントの POST body でのみ使う。
- **DX / フェイルセーフ**（[[0007-oauth-public-surface]]）: 普段は `code_direct` で自動。初回 grant は人間ブラウザ手順で、
  ライブラリは **URL 生成と code 交換だけ補助**。失効・誤用は明確なエラー（[[0006-error-model]]）。
- **既定/カスタム両立**（ADR-0007 案4）: 既定ストラテジには交換トークンを保存できる。**カスタム `TokenProvider` 注入時**は
  credential を持たないことがあるので、credential 依存メソッドは明示的に弾く（フェイルセーフ）。
- **契約非依存で評価**（[[0024-mock-transport]]）: 全経路を mock transport で駆動できる。
- **コーディング規約**（[[0013-coding-conventions-class-vs-function]]）: 内部協調子は **factory 関数＋契約 `type`**、関数は arrow、
  1 ファイル1責務。公開 API は `src/index.ts` から明示 export。
- **秘匿**（[requirements][prd] R-11）: `secret`/token を URL・ログ・エラーに漏らさない。

## Considered Options

公開 auth アクセサの**置き場所と seam**の取り方:

- **案A: 専用ファサード factory `createAuthApi`**（`src/auth/auth-api.ts` 新設）を `PortersClient` が wire。
  Token 交換は共有ヘルパー `token-exchange.ts` に抽出し、既定 provider には内部 `cache/clear` seam を足して
  交換済みトークンを保存。`AuthApi` 契約 `type` を返す。（推奨）
- **案B: `PortersClient` のメソッドに直書き**（`client.ts` に `authorizationUrl` 等を生やす）。
- **案C: `TokenProvider` 契約を拡張**し、provider 自身に `authorizationUrl`/`exchange`/`revoke` を持たせ client は委譲。

## Decision Outcome

**採用: 案A（専用ファサード factory）**。`code_direct` の透過 provider（資格を持つ既定ストラテジ）と
公開ヘルパー群を**同じ資格情報・transport の上で**1 ファイル1責務に分けつつ、交換結果を既定 provider に保存できる。
案B は `PortersClient`（クラス＝Error 派生と client のみ、ADR-0013）に手続きを溜め込み肥大化。案C は**カスタム
ストラテジ（案3）には資格が無い**のに契約へ URL 生成/交換を強制してしまい、seam が壊れる。

以下サブ決定（確定）:

- **SD-1 namespace = `porters.auth`**（ADR-0007 既定）。公開型 `AuthApi`（メソッド集合の契約 `type`）。
- **SD-2 `authorizationUrl(opts): string`** — **純粋 URL builder（ネットワークなし）**。
  `GET {host}/v1/oauth` に `app_id` / `redirect_url` / `response_type=code` / `scope`（カンマ結合）/ `state?` を組む
  （[oauth][oauth]）。`opts = { redirectUrl, scopes?, state? }`。`scopes` 既定は client の `scopes`、空なら
  `PortersConfigError`（code/remove は scope 必須）。**`secret` は載せない**。
- **SD-3 `exchangeAuthorizationCode(code): Promise<void>`** — redirect の `?code=` を `POST {host}/v1/token`
  （`grant_type=oauth_code`）で交換し、得たトークンを**既定 provider に保存（`cache`）＋ `TokenStore` に書き戻す**。
  交換ロジックは既定 provider の内部 `exchange` と共有（`token-exchange.ts` に抽出）。**成功時は `void`**（保存済みで
  返す値が無い＝以後は普段どおり resource を呼ぶだけ＝DX。検査は `getToken()`）。**失敗は throw**（戻り値で失敗を
  表さない・[[0006-error-model]]）: Token の `<Error>≠0`／`code` 失効（30 秒）は `PortersAuthError`、ネットワークは
  `PortersNetworkError`、appId/secret 欠落は `PortersConfigError`。
- **SD-4 `remove` はブラウザ必須 → 役割を分解**。pure なサーバ revoke は API に無い（[oauth][oauth]）ので、
  ADR-0007 の `revoke(scopes)` を次の 2 つで realize する:
  - **`revokeUrl(opts): string`** — `response_type=remove` のブラウザ URL を生成（利用者が開いて削除承諾）。
  - **`clearTokens(): Promise<void>`** — ローカルの cache＋`TokenStore` を忘れる（ライブラリ側の後始末）。
    「完全な権限削除（サーバ側）」はブラウザ手順として残る＝正直に URL で渡す（フェイルセーフ）。
- **SD-5 `ensureAuthenticated(): Promise<void>`** — `provider.getAccessToken()` を呼び捨て（起動時 fail-fast /
  ウォームアップ、ADR-0007 SD-6）。**カスタム provider でも動く**（委譲）。失効・未付与は `PortersAuthError`/
  `PortersResourceError`（[[0006-error-model]]）。
- **SD-6 `getToken(): Promise<string>`** — 現在の**有効な Access Token のみ**返す（デバッグ用）。
  **Refresh Token は返さない**（秘匿・R-11）。内部は `provider.getAccessToken()`。
- **SD-7 カスタム `TokenProvider` 注入時の振る舞い** — credential 依存メソッド
  （`authorizationUrl` / `exchangeAuthorizationCode` / `revokeUrl`）は `appId`/`secret`/`host` が要る。未設定なら
  `PortersConfigError`（hint「初回 grant 補助には appId/secret が必要。トークンは自前ストラテジで供給される」）。
  `ensureAuthenticated`/`getToken` は provider 委譲で**常に利用可**。
- **SD-8 配置とエクスポート** — `src/auth/auth-api.ts`（`createAuthApi`）、`src/auth/token-exchange.ts`（共有交換）、
  既定 provider に**内部 `cache(tokens)` / `clear()`**（公開 `TokenProvider` 型には足さず、client→facade 間でのみ授受）。
  `src/index.ts` から `AuthApi` と option 型（`AuthorizationUrlOptions` / `RevokeUrlOptions`）を明示 export。
- **SD-9 セキュリティ** — `secret` は Token POST body のみ。URL/ログ/エラー/スナップショットに token・secret を出さない。
- **SD-10 テスト** — mock transport（ADR-0024）で交換・clear・ensure を駆動、URL builder は純粋関数として param 検証、
  エラー経路（scopes/appId 欠落、Token エンドポイントの `<Error>≠0`、refresh 失効）も網羅。**新規依存なし**。

### Consequences

- Good: 受け入れ済み設計（ADR-0007 SD-3/SD-6）と実装が一致。初回ブラウザ grant の補助が出荷され、案A（MCP）/対話の
  土台が埋まる。reference（`remove` はブラウザ必須）に正直な API になる。既定/カスタム両ストラテジで破綻しない。
- Bad: ADR-0007 例示の単一 `revoke()` が `revokeUrl()`＋`clearTokens()` の 2 メソッドに増える（公開 API が少し広がる）。
  既定 provider に内部 seam（`cache`/`clear`）を足す小改修が要る。
- Neutral: 実利用ではライブラリ外にブラウザ・redirect 受けが残る（利用者手順・ドキュメント必須、ADR-0007 既知事項）。
  キャッシュキーの partition 化（[[0008-multitenancy-partition]]／F-3）は本 ADR の対象外で別途。

## Pros and Cons of the Options

### 案A: 専用ファサード factory（推奨）

- Good: 1 ファイル1責務。既定 provider と公開ヘルパーを同じ資格・transport で結線でき、交換結果を保存できる。
  カスタムストラテジでも壊れない（credential 依存だけ config error で明示）。factory＋`type`＝ADR-0013 準拠。
- Bad: ファイルとエクスポートが増える。既定 provider に内部 seam を追加する必要。

### 案B: PortersClient に直書き

- Good: 追加ファイルが少ない。
- Bad: `PortersClient`（クラス）に手続きを溜めて肥大化（ADR-0013 のクラス用途＝Error 派生と client のみに反する）。
  共有・テストの分離がしにくい。

### 案C: TokenProvider 契約を拡張

- Good: アクセサが provider に一元化。
- Bad: **カスタムストラテジ（案3）は資格を持たない**のに `authorizationUrl`/`exchange`/`revoke` を契約強制＝seam 破壊。
  既定と自前で契約が食い違う。透過ストラテジの責務（トークン供給）に URL 生成等の異種責務を混ぜる。

## More Information

- 実装する公開シェイプの正: [[0007-oauth-public-surface]]（SD-3/SD-6・`porters.auth.*`）。
- 内部前提: [[0012-token-cache-refresh]]（既定ストラテジの cache/refresh/single-flight。`cache` はそのキャッシュへトークンを保存）、
  [[0006-error-model]]（`PortersAuthError`/`PortersResourceError`・401/402/400 の扱い）、
  [[0009-http-transport]]（transport seam）、[[0024-mock-transport]]（テスト/評価）、
  [[0013-coding-conventions-class-vs-function]]（factory・arrow・type）。
- reference 接地: [OAuth API][oauth]（`code`/`code_direct`/`remove`・scope・state・30 秒）、[Token API][token]
  （`grant_type`・有効期限）、[requirements][prd]（R-1/R-11）。
- 位置づけ: [[0033-post-mvp-direction]] 案F-1。横断監査の証拠は [reviews][rev]。
- 後続/対象外: per-call `partition` ＆ tenant キー付け（F-3・[[0008-multitenancy-partition]]）、ライブ検証（[live-verification][lv]・
  契約環境後）。実装は別 PR（ADR 先行→実装の順）。

[oauth]: ../reference/authentication-api/oauth.md
[token]: ../reference/authentication-api/token.md
[prd]: ../design/requirements.md
[rev]: ../reviews/2026-06-22-03.md
[lv]: ../live-verification.md
