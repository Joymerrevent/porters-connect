# RV-32 🟢 `searchAll` に渡したクエリを反復中に書き換えると、次ページ以降の要求が変わる

- 重要度: 🟢 ／ 観点: フェイルセーフ / DX
- 状態: open

## 概要

`searchAll` は受け取ったクエリ**オブジェクトへの参照を保持**し、ページを取るたびに読み直す。
そのため、`for await` の反復中に呼び出し側がそのオブジェクトを書き換えると、
**同じ 1 回の `searchAll` の途中で検索条件が変わる**。取得結果は「1 つの検索の全件」ではなくなるが、
利用者にはそう見えない（例外も警告も出ない）。

## 根拠

- `src/resources/resource.ts:310` — `paginate((count, start) => search<E>({ ...query, count, start }))`。
  クロージャが `query` を**毎ページ評価**する。スナップショットは取っていない。
- `src/resources/read-core.ts:236-249` — `paginate` は**ジェネレータ**で、`fetchPage` を
  消費側が次を要求したときに初めて呼ぶ。つまり yield と yield の間に書き換える窓がある。
- 同じ形がマスタ Read にもある: `src/resources/field.ts:117` ／ `src/resources/partition.ts:88` ／
  `src/resources/user.ts:111`。
- 実測（このコードを読んだうえでの再現手順）:

  ```ts
  const q = { condition: { P_Name: { part: "山田" } } };
  for await (const c of t.candidate.searchAll(q)) {
    q.condition = { P_Name: { part: "佐藤" } }; // ← 2 ページ目以降は佐藤で引かれる
  }
  ```

- 公開 API の JSDoc（`src/resources/resource.ts:137`「Auto-paginating search: yields every matching
  record (200 per page)」）は**「渡したクエリの全件」**を約束している。クエリが途中で変わりうるとは書いていない。

## 影響

**今すぐ壊れるものではない**。渡したオブジェクトを反復中に意図して書き換えないと起きず、
そう書く動機も薄い。踏むとすれば、クエリを組み立てる変数を使い回しているコードで
`searchAll` の結果を別の条件に切り替えた、といった経路になる。

ただし**踏んだときに気づけない**のが厄介で、「全件取ったつもりが途中から別条件の全件」になる。
黙って壊れる側なので、`wontfix` にするなら**契約として明記**しておきたい。

`resource` が必須になる Phase（[ADR-0061][adr61] 論点2＝案2a で決定）では
`of()` に束ねるので、少なくとも「対象リソースが途中で変わる」形にはならない。

## 検出経緯

[ADR-0061][adr61] の論点2 で、案2b（`resource` をクエリの必須フィールドにする）の欠点として
「`searchAll` の途中で変えられてしまう余地が残る」と書いたところ、
**それは案の比較材料になるのかと指摘された**。実装を読み直すと、
`resource` に固有の話ではなく **`searchAll` 一般の性質で、既存の全リソースに今からある**と分かった。
ADR からは誤った比較材料として削除し、本件として切り出した。

## 推奨

処置の候補は 3 つ。**(a) を推奨**する。

### (a) 1 度だけ直列化して、以降はページングだけ差し替える（推奨）

`searchAll` が「ループで使うものを作って返す」形にし、呼び出し側のオブジェクトは**入口で 1 度読むだけ**にする
（stakeholder 提案 2026-08-31）。

- `buildReadUrl`（`resource.ts:204-230`）は `URLSearchParams` を組み、**最後に `appendPaging(p, count, start)`
  を足すだけ**。したがって**ページングを除いた `URLSearchParams` を 1 回作り、ページごとに `count` / `start`
  だけ差し替える**形にできる（`new URLSearchParams(p)` で複製して 2 つ set するなど）。
- `search` がクエリに依存してやっているのは URL 構築と `decoderWith(query.expand)` の 2 つだけなので、
  **どちらも 1 回で済む**。ページごとの再直列化が消えるぶん、わずかだが速くもなる。
- **入れ子の書き換えまで塞がる**のがこの案の要点。呼び出し側のオブジェクトを保持せず、
  **直列化した結果**を保持するので、`q.condition.P_Name.part` を書き換えられても後続ページに影響しない。

**実装時の注意（エラーのタイミング）**: URL 構築は送信前ガード（`keywords` 100 字超・`itemstate` の
condition 制限など）を走らせる。今は `search` の中＝**反復時**に走るので、失敗は最初のページ取得の
rejection として届く。これを `searchAll` の**呼び出し時点**へ前倒しすると `searchAll(...)` が同期 throw
しうる（返すのは `AsyncIterable` で Promise ではないが、[ADR-0046][adr46] の「失敗は同じ経路で届く」
という趣旨からは外れる）。**ジェネレータの中で最初のページを取る直前に 1 度だけ組めば**、
タイミングは現状のままで穴だけ塞がる。

### (b) 契約として明記するだけ

「`searchAll` の反復中にクエリを書き換えない」ことを JSDoc と [Read クエリ ガイド][read-query]に書く。
実装は変えない。(a) を入れるなら不要。

### (c) 入口で浅いスナップショットを取る — ✗ 塞がらない

`searchAll` の先頭で `const q = { ...query }` を作る案。**これでは不十分**なので単独では採らない。
`search` は毎ページ `readUrl` を呼び、**その時点で** `q.condition` を直列化する。浅いコピーでは
`condition` の中身は呼び出し側のオブジェクトのままなので、防げるのは top-level の差し替え
（`q.condition = {...}`）だけ。**塞がったように見えて塞がっていない**のが、この案の危うさ。

---

どの案を採るにせよ、**マスタ Read（`field` / `partition` / `user`）も同じ形**なので、
直すならまとめて揃える。

[adr46]: ../../adr/0046-guard-error-contract.md
[adr61]: ../../adr/0061-phase-resource-surface.md
[read-query]: ../../guide/read-query.md
