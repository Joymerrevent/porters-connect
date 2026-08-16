# RV-17 🟡 `host` の書式を検証せず、設定ミスが別ホストへの実リクエストになる

- 重要度: 🟡 ／ 観点: フェイルセーフ / 設定検証
- 状態: fixed

## 概要

`host` は**一切検証されない**まま `{scheme}://{host}/v1/{path}` に文字列連結されていた。
書式を誤ると URL は例外を出さず、**別のホスト名として解決可能な形**に化け、
認証リクエストがそこへ実際に飛ぶ。

## 根拠

`src/http/access-point.ts:20-29`（`apiUrl` は連結のみ・検証なし）/
`src/client.ts:136-139`（`options.host` を素通しで `AccessPoint` 化）, `:47-50`（`host` の JSDoc）/
`src/auth/token-exchange.ts:37-38,44`（`secret` を `apiUrl(accessPoint,"token")` へ POST）/
`src/http/fetch-transport.ts:29-33`（fetch 失敗は一律 `retryable: true` の network）。

**実測**（`new PortersClient({host}).candidate.search()` の 1 本目の宛先）:

| 入力                                  | 生成される URL                        | DNS 宛先         |
| ------------------------------------- | ------------------------------------- | ---------------- |
| `xxxxx.example.com`（正しい）         | `https://xxxxx.example.com/v1/…`      | `example.test`   |
| `https://xxxxx.example.com`（誤設定） | `https://https://xxxxx.example.com/…` | **`https`**      |
| `""`（env 未設定を `!` で押し通す）   | `https:///v1/oauth`                   | **`v1`**         |
| `example.com/`                        | `https://example.com//v1/…`           | 正しいがパス二重 |

いずれも `new URL()` は throw せず**成功する**。
docs 側は正しい（`README.md:347`「ポートが要る場合は `host` に含めます」・`.env.example`・[ADR-0047][adr47]）が、
**正しさを型でも実行時でも強制していない**。

## 影響

2 通りの壊れ方がある。**(a) 解決してしまう場合**: App ID（OAuth のクエリ）・App Secret（Token の body）が
**意図しないホストへ実際に送信される**＝秘匿情報の漏洩経路。
**(b) 解決しない場合**: `PortersNetworkError`（**retryable: true**）になり、
**直しようのない設定ミスをリトライで叩き続ける**。しかも**設定エラーが `config` ではなく `network` に化ける**ので、
利用者は原因を設定だと気づけない。
正しい設定のままなら未発火なので 🟡 だが、発火時の被害は情報漏洩を含む。

## 検出経緯

[2026-08-10-01][run810]。[ADR-0047][adr47] で `scheme` が独立したオプションになり、
**`host` が「ホスト（＋ポート）だけ」を意味することが契約として明確になった**ため、
その契約を破る入力の扱いを確認した。

## 推奨

構築時に `host` を検証し `PortersConfigError`（`category: "config"`・hint 付き）で**早く・明確に**落とす。
条件は薄くてよい: 非空／`://` を含まない／`/` を含まない／空白を含まない（`host:port` は許可）。
検証は `apiUrl` ではなく `PortersClient` の構築時が適切（1 回で済み、リクエスト経路を汚さない）。
現行の正しい設定は影響を受けないが、**受け入れ入力を狭める＝公開契約の明確化**なので軽い ADR を 1 本推奨。

## 処置

[ADR-0048][adr48] を **accepted**（案A ＋ 機構2）ののち実装。確定した契約は
「**`host` は「ホスト（＋ポート）」だけを表す**。スキーム・パス・userinfo・空白を含む値は
接続を試みる前に `PortersConfigError` で拒否する」。
`validateAccessPoint`（`src/http/access-point.ts`）を `PortersClient` 構築時に 1 回だけ呼ぶ
（`apiUrl` は文字列組立のまま＝リクエスト経路に分岐を増やさない）。semver は **patch**。

## 検証

- 判定は `new URL` のラウンドトリップ（パース成功 ＋ `url.host` 一致 ＋ `pathname === "/"`）。`scheme` も同じガード。
- **異常系 11 件・正常系 7 件**をテストで pin。[エラーハンドリング ガイド][guide]に「アクセスポイントの書式」節を追加。
- **既知の制限を 2 つとも hint に明記**した — IDN は punycode 表記が要る／
  既定ポート `:443` はパーサが落とすため書式検証を通らない。
  後者は実装時に判明した ADR の想定外だが、**弾かれても構築時に hint 付きで落ちるだけで安全側**。
  この制限は [RV-21][rv21]（[ADR-0049][adr49]）で解消した。

[adr47]: ../../adr/0047-access-point-scheme.md
[adr48]: ../../adr/0048-access-point-host-validation.md
[adr49]: ../../adr/0049-host-port-roundtrip.md
[guide]: ../../guide/error-handling.md
[rv21]: 0021-default-port-rejected.md
[run810]: ../2026-08-10-01.md
