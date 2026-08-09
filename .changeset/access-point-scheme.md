---
"@joymerrevent/porters-connect": minor
---

アクセスポイントの scheme 設定（ADR-0047）: `PortersClient` に `scheme?: "https" | "http"`（既定 `"https"`）と型 `Scheme` を追加。
`host` の意味・`PORTERS_HOST` の運用は不変。`http` は明示時のみで、平文のため毎プロセス 1 回警告する（抑止は `PORTERS_SUPPRESS_INSECURE_HTTP_WARNING`）。非破壊（追加のみ）。
