---
"@joymerrevent/porters-connect": minor
---

feat(auth): add the `porters.auth.*` OAuth surface (ADR-0034 / F-1)

`PortersClient` now exposes `auth` for the initial browser permission grant and
token lifecycle, closing the ADR-0007 SD-3/SD-6 backlog:

- `authorizationUrl(opts)` / `revokeUrl(opts)` — build the browser `code` / `remove`
  grant URLs (the App Secret never appears in a URL).
- `exchangeAuthorizationCode(code)` — exchange a redirect `?code=` for tokens and seat
  them into the default strategy; resolves `void`, throws on failure.
- `clearTokens()` — forget cached + stored tokens locally.
- `ensureAuthenticated()` / `getToken()` — warm up / inspect the current Access Token
  (the Refresh Token is never exposed); both work with a custom auth strategy too.

Credential-dependent methods fail fast with `PortersConfigError` under a custom strategy.
New exported types: `AuthApi`, `AuthorizationUrlOptions`, `RevokeUrlOptions`.
