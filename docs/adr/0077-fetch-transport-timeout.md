# 77. 既定 transport のタイムアウトを利用者が変えられるようにする

- Status: proposed
- Date: 2026-09-16
- Deciders: jun.shiromoto (Joymerrevent)

> [RV-46][rv46] の決着。**塞いだなら別の道を用意する**という話で、
> [ADR-0075][adr75]（添付の本体は `get(id)` でだけ運ぶ）の直後に出てきた。起票のみ（`proposed`）。

## Context and Problem Statement

既定の transport は **1 リクエスト 30 秒**で打ち切る（`src/http/fetch-transport.ts`）。

```ts
const timeoutMs = opts.timeoutMs ?? 30_000;
// …
signal: AbortSignal.timeout(timeoutMs);
```

**この値を変える手段が公開 API に無い。** `createFetchTransport` は `src/index.ts` から
export しておらず、`PortersClient` にもタイムアウトのオプションが無い。公開しているのは
`Transport` 型・`createMockTransport`・`createThrottle` とその型だけ。

つまり利用者に残るのは **`Transport` を自分で実装する**ことだけで、そうすると
`PortersNetworkError` への包み直し（[ADR-0006][adr6] / [ADR-0050][adr50]）まで自前になる。
エラーモデルの一貫性を利用者に肩代わりさせることになり、**逃げ道として実用的でない**。

**何を測っている値なのかは実測した**（2026-09-16）。`AbortSignal` は fetch 呼び出し全体に効くので、
**接続から本文の受信完了まで**が対象になる。ヘッダだけ返して本文を流し続けるローカルサーバに
1 秒の signal を付けると、ヘッダは 8ms で受信し、**1005ms で `DOMException` 中断**した。
数え方は 1 リクエストごとで、既定 `maxRetries: 3` なら最悪 4 回 × 30 秒 ＋ バックオフ。
レートの待ち時間は含まない（スロットルは transport の外側）。

**いま問題になるのは添付である。** [ADR-0075][adr75] で**本体は `get(id)` でだけ運ぶ**ことにした。
PORTERS は 1 ファイル 10MB まで許すので、細い回線では 30 秒に収まらないことがある。
**一覧から本体を外した版と同じ版で、その 30 秒を延ばす手段が無い**のは筋が通らない。

**隣人は既に公開されている。** スロットルは [ADR-0073][adr73] で「自制の単位を差し替えられるように」と
`createThrottle` を公開した。タイムアウトも「環境によって適正値が違う」という同じ形の設定で、
そちらだけ塞がっている。

問い: **どう開けるか。**

## Decision Drivers

- **塞いだなら道を用意する**: ADR-0075 が一覧から本体を外した以上、単件で取る経路は現実的に
  使えなければならない。
- **先例と揃う**: `createThrottle`（[ADR-0073][adr73]）と同じ形の設定は同じ形で開ける。
- **曖昧さを作らない**: 設定が 2 か所にあると「どちらが勝つか」が生まれる（[RV-10][rv10] は
  「効かない設定を JSDoc が宣言していた」指摘だった）。
- **公開サーフェスを増やしすぎない**: 記号が増えるほど、後で動かせなくなる。
- **既定は変えない**: 30 秒は大多数にとって妥当。変えたい人だけが変える形にする。

## Considered Options

- 案A: **`createFetchTransport` と `FetchTransportOptions` を公開する**
- 案B: `PortersClient` に `timeoutMs` を足す
- 案C: 両方（`timeoutMs` は既定 transport のときだけ効く）
- 案D: 既定値そのものを延ばす（例 60 秒）。公開はしない
- 案E: 何もしない（`Transport` の自前実装で足りるとする）

## Decision Outcome

**未決（`proposed`）。** 起案時点の推奨は **案A**。

理由: `createThrottle` と**同じ形**で開くので、覚えることが増えない。設定の置き場所が
1 つ（transport を作る側）に決まるので、案B / 案C が抱える「どちらが勝つか」が生まれない。
既定は 30 秒のまま据え置ける。

### Consequences

- Good: 添付の本体を取る経路が、遅い回線でも使えるようになる（[ADR-0075][adr75] の裏付け）。
- Good: `Transport` を自前実装する必要が無くなる ＝ `PortersNetworkError` への分類が保たれる。
- Good: [RV-46][rv46] が閉じる。
- Bad: 公開記号が 2 つ増える（`createFetchTransport` / `FetchTransportOptions`）。
  一度出したら消せない。
- Bad: 書き方が 1 行では済まない（`transport: createFetchTransport({ timeoutMs })`）。
- Neutral: `fetchImpl`（注入できる fetch）も同時に公開面へ出る。テストや独自 dispatcher で
  使える一方、**公開した瞬間から契約**になる。

## 信じている入力

| 値                   | 出どころ         | 誰が書けるか | 守り方                                                        | 取れなかったら       | 誤っていたら                                    |
| -------------------- | ---------------- | ------------ | ------------------------------------------------------------- | -------------------- | ----------------------------------------------- |
| `timeoutMs`          | 呼び出し側（人） | —            | 型（`number`）＋ **実装時に下限のガードを入れるか決める**     | 省略 ＝ 既定 30 秒   | `0` / 負値は `AbortSignal.timeout` が即中断する |
| `fetchImpl`          | 呼び出し側（人） | —            | 型（`typeof fetch`）。中身の振る舞いは検査しない              | 省略 ＝ global fetch | 応答が PORTERS の形でなければ既存の判定が弾く   |
| 応答本文の到着ペース | ネットワーク     | —            | 仕組み（`AbortSignal` が fetch 全体に効く＝本文の遅さも拾う） | 中断 ＝ network      | —                                               |

**`0` や負値をどう扱うか**は実装時の論点として残す（即中断は「タイムアウト無し」と読み違えやすい）。
`count` の範囲ガード（[RV-28][rv28]）と同じく、**手前で弾く**のが本リポジトリの既定路線。

## Pros and Cons of the Options

### 案A（`createFetchTransport` を公開）

- Good: `createThrottle` と同型。設定の置き場所が 1 つに決まる。
- Good: 既定値は据え置いたまま、変えたい人だけが変える。
- Bad: 公開記号が 2 つ増え、`fetchImpl` も公開の契約になる。

### 案B（`PortersClient` に `timeoutMs`）

- Good: いちばん短く書ける。transport を知らなくてよい。
- Bad: **`transport` を渡したときにどうなるかが曖昧**。無視するなら「効かない設定」（RV-10 と
  同じ形）、上書きするなら注入した transport の性質を勝手に変えることになる。
- Bad: 次に「リトライ回数も client に」と続く。設定の置き場所が 2 つに割れる。

### 案C（両方）

- Good: 使う側の選択肢は最大。
- Bad: 案B の曖昧さをそのまま抱える。文書で「併用したときの優先順位」を説明し続けることになる。

### 案D（既定値を延ばすだけ）

- Good: 記号が増えない。
- Bad: **全リクエストに効く**ので、異常時の滞留が延びる（レート超過の切断待ちも同じだけ延びる）。
- Bad: 回線差・ファイルサイズ差に対応できない。「延ばせば足りる」値が存在しない。

### 案E（何もしない）

- Good: 何も増えない。
- Bad: 逃げ道が `Transport` の自前実装だけ ＝ `PortersNetworkError` への分類を利用者に再実装させる。
  [ADR-0075][adr75] で一覧から本体を外した判断と噛み合わない。

## More Information

- 発端: [RV-46][rv46]（open）／ [ADR-0075][adr75]（本体は `get(id)` でだけ運ぶ）
- 先例: [ADR-0073][adr73]（`createThrottle` を公開して自制の単位を差し替え可能にした）
- 前提: [ADR-0009][adr9]（既定 fetch ＋ 注入 seam）／ [ADR-0006][adr6]・[ADR-0050][adr50]
  （transport の失敗を `PortersNetworkError` に寄せる）
- 反映（accept 後・別 PR）: `src/index.ts`（export の追加）、`docs/usage/concepts/limits.md`
  （「変えられません」の書き換え）、`docs/usage/howto/attachments.md`（大きなファイルの注記）、
  [RV-46][rv46] の処置、CHANGELOG（minor・追加）

[rv46]: ../reviews/rv/0046-fetch-timeout-not-configurable.md
[rv28]: ../reviews/rv/0028-count-range-unvalidated.md
[rv10]: ../reviews/rv/0010-per-call-partition-jsdoc.md
[adr75]: 0075-attachment-search-all.md
[adr73]: 0073-throttle-sharing.md
[adr9]: 0009-http-transport.md
[adr6]: 0006-error-model.md
[adr50]: 0050-auth-http-status-handling.md
