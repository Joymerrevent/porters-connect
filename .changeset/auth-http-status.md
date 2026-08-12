---
"@joymerrevent/porters-connect": minor
---

認証 API 経路にも HTTP ステータスを配線（ADR-0050）: OAuth（`code_direct`）と Token の 2 経路も、Resource API と同じ判定
（envelope 優先 → 無ければ status から分類）で応答を読むようになりました。従来これらは `transport.send` の `status` を捨てており、
ゲートウェイの非 XML な 4xx/5xx が「unparseable authentication response」＝ `category: "unknown"`・再試行不可になっていました。
トークン取得は全リクエストの前段なので、一時的な 5xx で処理全体が止まっていたものが**内蔵リトライで自動回復**しえます。
認証経路が `PortersNetworkError` / `PortersConfigError` を投げうる点だけ `catch` の分岐にご注意ください。挙動変更のため minor。
