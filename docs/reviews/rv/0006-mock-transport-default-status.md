# RV-6 🟢 mock transport の既定 status 経路が未テスト

- 重要度: 🟢 ／ 観点: テスト厳密性
- 状態: fixed

## 概要

`createMockTransport` の `MockReply` をオブジェクト形 `{ body }`（`status` 省略）で返したときに
200 になる経路が未テストだった。`toResponse` の `reply.status ?? 200` の
**null 合体（既定 200）側**が一度も実行されない。

## 根拠

- `src/http/mock-transport.ts:41` — `reply.status ?? 200`（coverage の Uncovered Line = 41）。
- `src/http/mock-transport.test.ts` — オブジェクト形は `{ status: 403, body }` のみで、
  `status` を省略した形が無い。
- branch カバレッジ 94.11%。

## 影響

[ADR-0014][adr14] の perFile branch ≥ 90 は満たすので**ゲートは緑のまま**だが、
[ADR-0015][adr15] の変異厳密性で穴になる — `?? 200` を別の値へ変える変異が**生存し得る**。
公開 API（R-17 の評価用モック）の既定値なので、壊れると利用者のテストが静かに誤る。
実害は小さく、テスト 1 本で塞がるので 🟢。

## 検出経緯

[2026-06-19-01][run619] のレビュー（R-16 / R-17 実装直後）。
カバレッジレポートの Uncovered Line を 1 行ずつ追って見つけた。

## 推奨

`{ body: "…" }`（`status` 省略）→ 200 を pin するテストを 1 本追加する。

## 処置

`src/http/mock-transport.test.ts` に「オブジェクト形 `{ body }`（status 省略）→ 200」を
pin するテストを追加した。

## 検証

`src/http/mock-transport.ts:41` の branch が 100% になり、
`reply.status ?? 200` の既定 200 側を変える変異を捕捉できるようになった。

[adr14]: ../../adr/0014-test-coverage-policy.md
[adr15]: ../../adr/0015-mutation-testing.md
[run619]: ../2026-06-19-01.md
