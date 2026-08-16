# RV-19 🟡 認証 API 経路が HTTP ステータスを見ない

- 重要度: 🟡 ／ 観点: エラーモデル / 認証
- 状態: fixed

## 概要

[ADR-0044][adr44] で `requester` は `res.status` を見るようになったが、
**OAuth / Token の 2 経路は `transport.send` を直接呼んでおり status を捨てたまま**だった。
[RV-13][rv13] と同じ穴が認証系にだけ残っている状態。

## 根拠

- `src/auth/token-provider.ts:92-93` — `code_direct` の GET／status 不使用。
- `src/auth/token-exchange.ts:42-48` — Token の POST／status 不使用。
- 対比 `src/http/requester.ts:52-73` — `readResponse` が両系統（status と envelope）を読む。
- `docs/reference/resource-api/README.md` — 「エラーは HTTP 200 以外、または `<Code>` が 0 以外」。

## 影響

ロードバランサ・プロキシ・WAF が返す非 XML の 4xx/5xx が
`parseAuthentication` の「unparseable authentication response」＝
`category: "unknown"`・`httpStatus: undefined`・`retryable: false` になる。
**トークン取得は全リクエストの前段**なので、一時的な 502 でも
「原因不明・再試行不可」として**全体が止まる**。
同じ状況が Resource API 側なら `server` / retryable に分類されて自動リトライされるだけに、
**経路によって回復可能性が変わる**のが問題。中間装置が居る環境でのみ発火するため 🟡。

## 検出経緯

[ADR-0044][adr44] の実装中（PR #143）。ADR の「影響範囲」が `requester` に限定されていたため、
**決定の範囲を勝手に広げず**別 finding として起票した。

## 推奨

[ADR-0044][adr44] の判定順（envelope 優先 → 無ければ status から分類）を認証経路にも適用する。
実装上は `readResponse` 相当を `http/` に切り出して両経路で共有するのが薄い。
**挙動変更＝要 ADR**（[ADR-0044][adr44] の適用範囲を広げる新 ADR）。
認証系を `PortersAuthError` に寄せるか、status 由来の分類（`server` / `rateLimit` 等）に従うかも同時に決める。

## 処置

[ADR-0050][adr50] を **accepted**（案A）ののち実装。
`readResponse` を `src/http/read-response.ts` へ切り出し、`requester` と認証 2 経路
（`token-provider` の `code_direct` / `token-exchange` の Token POST）が**同じ判定**を使うようにした。
判定順・status → category の写像・`httpStatus` の付与は [ADR-0044][adr44] のまま**不変**
＝適用範囲を広げただけ。

## 検証

- ゲートウェイの 5xx が `server`・retryable になり、
  **トークン取得中の一時障害が内蔵リトライで自動回復する**ことを L1 で確認
  （「4 回試行して失敗」「1 回で回復」の両方を pin）。
- 非 200 ＋ `<Authentication><Error>` は **envelope が勝つ**こと、
  HTTP 200 ＋ `<Error>` の従来経路が不変であることもテストで固定。
- サブクラスは案C を採らず「**502 は認証の失敗ではない**」＝
  [ADR-0006][adr6] の「サブクラス＝発生系統」に従った。
- 冪等性ガードが送信前の失敗にも掛かる件は [RV-22][rv22] と同じ論点として切り分け、本件では触っていない。

[adr6]: ../../adr/0006-error-model.md
[adr44]: ../../adr/0044-http-status-handling.md
[adr50]: ../../adr/0050-auth-http-status-handling.md
[rv13]: 0013-http-status-ignored.md
[rv22]: 0022-ratelimit-create-no-retry.md
