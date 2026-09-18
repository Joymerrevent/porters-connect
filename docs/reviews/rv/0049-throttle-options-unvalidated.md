# RV-49 🟡 `createThrottle` の上限値を検証せず、容量 0 で永久に待ち続ける

- 重要度: 🟡 ／ 観点: フェイルセーフ / 公開サーフェス
- 状態: open

## 概要

公開 API `createThrottle` は `readPerMin` / `writePerMin` / `safety` を検証しない。
`Math.floor(limit * safety)` が 0 以下になる組み合わせ（既定 `safety: 0.9` なら `readPerMin: 1`）で
バケット容量が 0 になり、`take()` が **1ms 間隔の busy loop で永久に返らない**。
エラーも出ず、プロセスが静かに止まる。

## 根拠

`src/http/throttle.ts:25-43`（`makeBucket`）:

```ts
const ratePerMs = capacity / 60_000;
let tokens = capacity;
...
if (tokens >= 1) { tokens -= 1; return; }
await sleep(Math.ceil((1 - tokens) / ratePerMs));
```

`capacity === 0` だと `ratePerMs === 0` → `tokens` は永遠に 0 → `sleep(Math.ceil(1 / 0))`
= `sleep(Infinity)`。Node は `setTimeout(fn, Infinity)` を **1ms に丸める**
（`TimeoutOverflowWarning`）ので、ループは回り続けて返らない。

`src/http/throttle.ts:45-51`（`createThrottle`）は `Math.floor((opts.readPerMin ?? 2000) * safety)`
をそのまま渡すだけで、範囲検査が無い。

**実測**（`pnpm tsx`・2 秒で打ち切り）:

| 入力                | 結果                                             |
| ------------------- | ------------------------------------------------ |
| `{ readPerMin: 1 }` | 2 秒経っても返らない ＋ `TimeoutOverflowWarning` |
| `{ safety: 0 }`     | 同じ                                             |
| `{ readPerMin: 0 }` | 同じ                                             |

**同じ判断が隣では下されている**のが根拠の要。`src/http/fetch-transport.ts:42-50`
（`createFetchTransport`・[ADR-0077][adr77]）は `timeoutMs` を
「`Number.isInteger` かつ正」で構築時に検査し、`0` を弾く理由まで書いてある
（「`0` は『タイムアウト無し』と読めるが違う」）。**公開された 2 つの seam のうち片方だけ**が
守られている。

## 影響

「上限を下げて優しく叩く」は `createThrottle` を公開した目的そのもの
（[ADR-0073][adr73]・`src/index.ts:35` が「different limits を走らせる」用途を明記）。
その用途で最も自然な小さい値を渡すと、**例外ではなく無言のハング**になる。

- 倒れ方が**安全側ではない**: 叩きすぎはしないが、プロセスが止まり、ログにも
  `TimeoutOverflowWarning` しか出ないので原因に辿り着けない。設定ミスが
  「PORTERS が遅い / ネットワークが死んでいる」に見える。
- 発火は **latent**（既定値では起きない）。踏むのは自分でスロットルを組んだ利用者だけなので
  🔴 ではないが、**踏んだときの症状が最悪（無言の停止）**なので 🟡。
- 同系列の過去指摘（[RV-17][rv17] `host` 書式・[RV-25][rv25] `partition` 既定・
  [RV-28][rv28] `count` 範囲）と**まったく同じ形**＝「設定値を送信前に検証する」系列の残り。

## 検出経緯

[ADR-0073][adr73]（スロットルの共有単位）の実装を観点 2 で確認していて、`sharedThrottleFor` の
キー設計は丁寧なのに `createThrottle` 自体の入口検査が無いことに気づいた。隣の
`createFetchTransport` が [ADR-0077][adr77] で厳密に検査しているので、**同じ「公開 factory の
数値オプション」で扱いが割れている**のが手がかりになった（[RV-25][rv25] を見つけたときと同じ経路
＝「決定が片側にしか適用されていないか」を疑う）。

## 推奨

`createFetchTransport` と同じ形で構築時に検査する（挙動変更だが、**現行の挙動は無言のハングなので
ADR を要する決定というより明確な欠陥の修正**。念のため既存 ADR-0073 に追記で足りるか、
軽い ADR を 1 本立てるかは起票時に判断）。

- `readPerMin` / `writePerMin`: 正の整数。
- `safety`: `0 < safety <= 1`。
- **検査は「掛けた後の容量」で行う**のが要点。`readPerMin: 1, safety: 0.9` は個別には妥当なのに
  積が 0 になる＝入口だけ見ても捕まらない。`Math.floor(limit * safety) < 1` を弾き、
  hint で「上限を下げたいなら 2 以上、または `safety: 1`」と示す。
- 「まったく叩かせない」を表現したい利用者には、**それ用の `Throttle` を自分で書くのが正**
  （`take` が永遠に pending になる実装を意図的に渡す）と `PortersClientOptions.throttle` の
  JSDoc に 1 行足す。許可と沈黙を分ける（[ADR-0047][adr47]）のと同じ考え方。

## 処置

—

[adr47]: ../../adr/0047-access-point-scheme.md
[adr73]: ../../adr/0073-throttle-sharing.md
[adr77]: ../../adr/0077-fetch-transport-timeout.md
[rv17]: 0017-host-format-unvalidated.md
[rv25]: 0025-partition-default-zero.md
[rv28]: 0028-count-range-unvalidated.md
