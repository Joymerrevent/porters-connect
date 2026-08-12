---
"@joymerrevent/porters-connect": patch
---

アクセスポイントの書式を構築時に検証（ADR-0048 ＋ ADR-0049）: `host` はホスト（＋必要ならポート）だけを表し、スキーム・パス・userinfo・空白を含む値は
`new PortersClient(...)` の時点で `PortersConfigError`（直し方の `hint` 付き）になります。従来これらは例外にならず、
`https://xxxxx.example.com` は `https` という別ホスト宛の実リクエストに、空文字は `v1` 宛になっていました（＝ App ID / Secret が意図しない
宛先へ送られる、または設定ミスが `network` エラーとして延々リトライされる）。狭まるのは**元々正しく動いていなかった入力**だけなので patch。
弾かれる例: `https://a.test` ／ `""` ／ `a.test/` ／ `a.test/gw` ／ `user@a.test` ／ `a test` ／ `//a.test` ／ 非 ASCII ホスト（punycode で渡す）。
通る例: `a.test` ／ `a.test:8080` ／ `127.0.0.1:4010` ／ `[::1]:4010` ／ 大文字ホスト。**ポートはどれでも書けます**（冗長な `:443` も通る）。
