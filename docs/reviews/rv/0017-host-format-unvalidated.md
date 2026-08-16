# RV-17 🟡 `host` の書式を検証せず、設定ミスが別ホストへの実リクエストになる

- 重要度: 🟡 ／ 観点: フェイルセーフ / 設定検証
- 状態: fixed

## 概要

`host` は**一切検証されない**まま `{scheme}://{host}/v1/{path}` に文字列連結される。書式を誤ると
URL は例外を出さず**別のホスト名として解決可能な形**に化け、認証リクエストがそこへ実際に飛ぶ:

- `host: "https://xxxxx.example.com"`（`PORTERS_HOST` にスキーム込みで入れる典型的な設定ミス）
  → `https://https://xxxxx.example.com/v1/oauth` → **DNS 宛先は `https`**・path は `//xxxxx.example.com/v1/oauth`
- `host: ""`（env 未設定・`!` で押し通した場合）→ `https:///v1/oauth` → **DNS 宛先は `v1`**
- `host: "example.com/"` → `https://example.com//v1/...`（宛先は正しいがパスが二重スラッシュ）
  いずれも `new URL()` は throw せず**成功する**。結果 (a) 解決すれば **App ID（OAuth のクエリ）・App Secret
  （Token の body）が意図しないホストへ送信**され、(b) 解決しなければ `PortersNetworkError`（**retryable: true**）
  になり、直しようのない設定ミスをリトライで叩き続ける。**設定エラーが `config` ではなく `network` に化ける**

## 根拠

`src/http/access-point.ts:20-29`（`apiUrl` は連結のみ・検証なし）/ `src/client.ts:136-139`（`options.host` を
素通しで `AccessPoint` 化）, `:47-50`（`host` の JSDoc。ポートは含めるが**スキーム・パスは含めない**とは書いていない）/
`src/auth/token-exchange.ts:37-38,44`（`secret` を `apiUrl(accessPoint,"token")` へ POST）/
`src/http/fetch-transport.ts:29-33`（fetch 失敗は一律 `retryable: true` の network）。
実測（`new PortersClient({host}).candidate.search()` の 1 本目の宛先）:
正しい host → `example.test`／スキーム付き → `https`／空 → `v1`。
docs 側は正しい（`README.md:347`「ポートが要る場合は `host` に含めます」・`.env.example`・[ADR-0047][adr47]）が、
**正しさを型でも実行時でも強制していない**

## 検出経緯

2026-08-10 レビュー。[ADR-0047][adr47] で scheme が独立したオプションになり、
`host` が「ホスト（＋ポート）だけ」を意味することが**契約として明確になった**ため、その契約を破る入力の扱いを確認した

## 推奨

構築時に `host` を検証し `PortersConfigError`（`category: "config"`・hint 付き）で**早く・明確に**落とす。
条件は薄くてよい: 非空／`://` を含まない／`/` を含まない／空白を含まない（`host:port` は許可）。
検証は `apiUrl` ではなく `PortersClient` の構築時が適切（1 回で済み、リクエスト経路を汚さない）。
現行の正しい設定は影響を受けないが、**受け入れ入力を狭める＝公開契約の明確化**なので軽い ADR を 1 本推奨
（既存の送信前ガード＝長さ・10MB と同じ「早く落とす」系列に置く）

## 処置

[ADR-0048][adr48] を **accepted**（案A ＋ 機構2・decider 2026-08-11・ADR 反映は PR #141）ののち**実装**。
確定した契約は「**`host` は「ホスト（＋ポート）」だけを表す**。スキーム・パス・userinfo・空白を含む値は
接続を試みる前に `PortersConfigError` で拒否する」。`validateAccessPoint`（`src/http/access-point.ts`）を
`PortersClient` 構築時に 1 回だけ呼ぶ（`apiUrl` は文字列組立のまま・リクエスト経路に分岐なし）。
判定は `new URL` ラウンドトリップ（パース成功 ＋ `url.host` 一致 ＋ `pathname === "/"`）で、`scheme` も同じガード。
semver は **patch**。**既知の制限は 2 つとも hint に明記**した — IDN は punycode 表記が要る／
既定ポート `:443` はパーサが落とすため書式検証を通らない（後者は実装時に判明。ADR の想定外だが
弾かれても構築時に hint 付きで落ちるだけで安全側）。異常系 11 件・正常系 7 件をテストで pin し、
[エラーハンドリング ガイド][guide]に「アクセスポイントの書式」節を追加

[adr47]: ../../adr/0047-access-point-scheme.md
[adr48]: ../../adr/0048-access-point-host-validation.md
[guide]: ../../guide/error-handling.md
