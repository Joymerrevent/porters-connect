# RV-6 🟢 mock transport の既定 status 経路が未テスト

- 重要度: 🟢 ／ 観点: テスト厳密性
- 状態: fixed

## 概要

`createMockTransport` の `MockReply` をオブジェクト形 `{ body }`（`status` 省略）で返したときに 200 になる経路が未テスト。`toResponse` の `reply.status ?? 200` の **null 合体（既定 200）側**が実行されず、`?? 200` を別値へ変える変異が生存し得る（branch 94.11%）

## 根拠

`src/http/mock-transport.ts:41`（`reply.status ?? 200` — coverage の Uncovered Line=41）/ `src/http/mock-transport.test.ts`（オブジェクト形は `{status:403,body}` のみ・status 省略形が無い）

## 推奨

`{ body: "…" }`（status 省略）→ 200 を pin するテストを 1 本追加（ADR-0014 の perFile branch≥90 は満たすが、ADR-0015 の変異厳密性で穴）

## 処置

`mock-transport.test.ts` に「オブジェクト形 `{ body }`（status 省略）→ 200」を pin するテストを追加。`mock-transport.ts:41` の branch が 100% になり、`reply.status ?? 200` の既定 200 側の変異を捕捉
