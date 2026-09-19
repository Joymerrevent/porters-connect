---
"@joymerrevent/porters-connect": patch
---

`createThrottle` が**実質 0 件の上限**を受け付けて永久に待つのをやめ、構築時に弾くようにしました（RV-49）。

バケットが持つトークンは `floor(上限 × safety)` 個で、既定 `safety` は 0.9 です。
そのため `createThrottle({ readPerMin: 1 })` は容量 0 になり、**すべての呼び出しが返らなく**
なっていました（例外もログも無し）。上限を下げて優しく叩くのはこの関数を公開した目的そのものなので、
その用途で最も自然な小さい値がハングに倒れていたことになります。

```ts
createThrottle({ readPerMin: 1 }); // PortersConfigError（floor(1 × 0.9) = 0）
createThrottle({ readPerMin: 2 }); // OK（floor(1.8) = 1）
createThrottle({ readPerMin: 1, safety: 1 }); // OK（floor(1) = 1）
```

- `readPerMin` / `writePerMin` は**正の整数**、`safety` は **0 より大きく 1 以下**。
  加えて **`floor(上限 × safety)` が 1 以上**であることを見ます。
  `readPerMin: 1` も `safety: 0.9` も単体では妥当なので、**積を見ないと捕まりません**。
- **「1 件も通さない」は `createThrottle` では表現できません。** それが必要なら、
  `take()` が解決しない `Throttle` を自分で渡してください（エラーの `hint` でも案内します）。

既定のまま使っているコード、および妥当な上限を渡しているコードは無変更です。
エラーになるのは、これまで**永久に待っていた**設定だけです。
