---
"@joymerrevent/porters-connect": minor
---

F-3 マルチテナント面: `porters.tenant(id)` スコープ（`TenantScope`）を追加（ADR-0040・案1c）。
partition を tenant スコープ／client 既定の 2 層で解決。per-call 引数は設けない。非破壊（追加のみ）。
