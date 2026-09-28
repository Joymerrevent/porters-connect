# RV-157 🟢 条件の組み立て（encodeCondition）の説明コメントが、別の関数の上に残っている

- 重要度: 🟢 ／ 観点: ドキュメント
- 状態: open

## 概要

`src/accessor/append-read-query.ts:174-176` のコメントは `encodeCondition` の説明（出力の形・削除済みを読むときの制限・
型の付け方）だが、[#471][pr471] のリファクタで間に `assertConditionField` と `assertKnownOperator` が入った。
そのため、このコメントは `assertConditionField`（`:179`）の説明に見え、`encodeCondition`（`:214`）には説明が無い。

## 根拠

- `src/accessor/append-read-query.ts:174-176` — 「condition -> `Prefix.alias:suffix=value,...`. Throws if itemstate=deleted/all …
  Typed over the loose catalog: `Condition<F>` is assignable in, …」。書いているのは `encodeCondition` の入出力と型。
- `:177-178` — RV-68 の再レビューの注記（項目名と演算子の検査の理由）。`assertConditionField` と `assertKnownOperator`
  の 2 つに掛かる説明だが、`assertKnownOperator`（`:202`）の直前には無い。
- `:214` — `encodeCondition` の直前にコメントが無い。
- リファクタ前（`53f96f7^`）は、`:174-176` の直下が `encodeCondition` だった（`git show 53f96f7^:src/accessor/append-read-query.ts`）。

## 影響

挙動には影響しない（コメントだけ）。保守者が `assertConditionField` を読むと「条件全体を組み立てる関数」と誤読し、
`encodeCondition` を読むと型を緩いカタログで受ける理由（`Condition<F>` を代入できる）が見つからない。
直前の #470 が「コメントを本体の隣に戻す」ことを目的にしていたので、同じ種類のずれが次のリファクタで戻ったことになる。
🟢 にした。

## 検出経緯

2026-09-28 の run 2 で、前回の `src` 全体のレビュー（RV-65〜RV-156）の後に入ったリファクタ 3 本（#470〜#472）の差分を、
挙動が同じかどうかで 1 つずつ読んだ。挙動はすべて同じだったが、#471 だけ、切り出した関数を
「説明コメントと、それが説明する関数の間」に差し込んでいた。
ほかの切り出し（`write-many.ts` / `encode-field.ts` / `time-of-day.ts` / `read-custom-catalog.ts` / `attachment.ts`）は、
コメントの手前か、コメントを一緒に動かしている。

## 推奨

コメントを分ける（ADR 不要・コメントだけの PR）。

- `:174-176` を `encodeCondition`（`:214`）の直前へ移す。
- `:177-178` の RV-68 の注記は `assertConditionField` の直前に残し、`assertKnownOperator` にも 1 行の説明を足す
  （知らない演算子も別の条件として読まれうる、の部分）。

行番号が変わるので、`pnpm docs:api` で API リファレンスを生成し直す必要があるかを `pnpm check:api` で確かめる
（`encodeCondition` は非公開なので、変わらない見込み）。

## 処置

—

[pr471]: https://github.com/Joymerrevent/porters-connect/pull/471
