# RV-49 🟡 `createThrottle` の上限値を検証せず、容量 0 で永久に待ち続ける

- 重要度: 🟡 ／ 観点: フェイルセーフ / 公開サーフェス
- 状態: fixed

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
  🔴 ではないが、**踏んだときの症状が最悪（無言の停止）** なので 🟡。
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

**完了。** **ADR は起こしていない** — 決定は既に accepted で出ていた（[ADR-0077][adr77] が
公開 factory の数値オプションを構築時に検証すると決め、[ADR-0006][adr6] がエラー型を、
[ADR-0047][adr47] が「許可と沈黙を分ける」ことを決めている）。新しい決定は 1 つも生じず、
**0077 の未適用の片側を埋めるだけ**なので、判断とその根拠を
[ADR README の「ADR を起こさずに決着した論点」][adrreadme]に記録した（2026-09-19）。

実装（`src/http/throttle.ts`）:

- `safety` は `0 < safety <= 1`、`readPerMin` / `writePerMin` は正の整数。
- **`floor(上限 × safety) >= 1`** — これが本体。入力だけ見ると、現実に踏む経路
  （上限を下げたい人）がそのまま通り抜ける。
- `PortersConfigError` ＋ `category: "config"`。同期 factory なので同期 throw でよい
  （`createFetchTransport` と同じ。[ADR-0046][adr46] は Promise を返すメソッドの契約）。
- **「1 件も通さない」は `createThrottle` では表現できない**ことにした。必要なら `take()` が
  解決しない `Throttle` を渡すのが正しい道で、`hint` がそこへ案内する。

あわせて書き込みの制約ガイドに節を 1 つ、changeset（patch）を 1 件。

## 検証

**指摘の再現手順をそのまま実行して、3 つとも即座にエラーになることを確認した**（実測）:

| 入力                | 以前                 | 現在                                                                                                 |
| ------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| `{ readPerMin: 1 }` | 2 秒経っても返らない | `readPerMin 1 with safety 0.9 leaves no capacity (floor(0.9) = 0), so every call would wait forever` |
| `{ safety: 0 }`     | 同じ                 | `safety must be greater than 0 and at most 1, got 0`                                                 |
| `{ readPerMin: 0 }` | 同じ                 | `readPerMin must be a positive integer, got 0`                                                       |

`src/http/throttle.test.ts` の「`createThrottle` の設定検証（RV-49）」が固定しているもの:

- `{ readPerMin: 1 }`（**積だけが 0 になる現実の経路**）を弾く。
- エラーの `category`、**積の実値**（`floor(0.9) = 0` — 掛け算が割り算等に変わると意味が変わる）、
  直し方（`at least 2`）、逃げ道の案内（`never resolves`）。
- `safety` の 4 パターン・上限の 5 パターン（0 / 負 / 小数 / NaN / Infinity）。
- `writePerMin` も同じ扱い（read だけ守っても意味がない）。
- **通る最小の容量（1）は「待つ」だけで済む** — `safety: 1` で 1 件通し、2 件目は待ち、
  1 分進めると返る。ここが示せて初めて、弾いているのは「待つ」ではなく
  「永久に返らない」設定だと言える。
- 既定の設定は通る。

品質ゲートは全 green（**1264 tests**・coverage perFile 100/99.21/100/100）。
mutation は `throttle.ts` が 90.00 → **98.75**で、残る 1 件は既存の
`resetSharedThrottles`（テスト用の継ぎ目）＝**今回の追加ぶんの survivor は 0**。
リポジトリ全体は **96.35**（閾値 95・RV-48 の実施時点は 96.29）。

[adrreadme]: ../../adr/README.md
[adr6]: ../../adr/0006-error-model.md
[adr46]: ../../adr/0046-guard-error-contract.md
[adr47]: ../../adr/0047-access-point-scheme.md
[adr73]: ../../adr/0073-throttle-sharing.md
[adr77]: ../../adr/0077-fetch-transport-timeout.md
[rv17]: 0017-host-format-unvalidated.md
[rv25]: 0025-partition-default-zero.md
[rv28]: 0028-count-range-unvalidated.md
