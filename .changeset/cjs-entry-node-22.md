---
"@joymerrevent/porters-connect": minor
---

`require` 条件で CJS からの入口を開き、Node の下限を 22.12 に上げる（ADR-0082）

**破壊的変更**: `engines.node` が `>=20` → `>=22.12.0`。

CJS 用の別実体は配らず、`require` 条件を同じ ESM 実体に向ける（型だけ `dist/index.d.cts`）。
別実体を配ると `instanceof PortersError` が ESM/CJS をまたげず、エラーモデルが catch を
素通りするため。この形は Node の `require(esm)` に載るので、既定で有効な最小の版を下限にする。
