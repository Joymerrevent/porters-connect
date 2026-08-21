# RV-3 🟡 ErrorCategory の rateLimit が到達不能

- 重要度: 🟡 ／ 観点: エラーモデル
- 状態: fixed

## 概要

`ErrorCategory` に `"rateLimit"` が定義されているが、**どの分類関数からも返されない**。
PORTERS はレート超過時に 429 ではなく**強制切断**するため、実際は `PortersNetworkError`
（`category: "network"`）に倒れる。README は `e.category` の例として `"rateLimit"` を挙げており、
**存在しない値を利用者に案内している**状態だった。

## 根拠

- `src/errors/porters-error.ts:11` — `ErrorCategory` に `"rateLimit"` が存在する。
- `src/errors/classify.ts` — 一度も `"rateLimit"` を返さない（全分岐を確認）。
- `src/http/fetch-transport.ts:29` — 切断は fetch の失敗として `PortersNetworkError` になる。
- `README.md:229` — `e.category` の例に `"rateLimit"` を掲載。

## 影響

利用者が `switch (e.category)` で `"rateLimit"` の分岐を書いても**永久に到達しない**。
実害は「効かない分岐を書かせる」ことで、データ破壊や情報漏洩には繋がらないため 🟡。
ただし**型が嘘をついている**状態であり、エラーモデル（[ADR-0006][adr6]）の
「判別可能な型に整理する」という前提を内側から崩す。

## 検出経緯

初回クロスレビュー（[2026-06-17-01][run1] Run 1）。`ErrorCategory` の各値について
「どこで produce されるか」を逆引きして、`rateLimit` だけ produce 元が無いと分かった。

## 推奨

3 択 — (a) **予約と明記**（型に残しコメントで説明・README を整合させる）、
(b) **型から削除**、(c) **強制切断の検知に配線**する。
(c) は「切断＝レート超過」と断定できないため誤分類のリスクがある。

## 処置

(a) を採用。`src/errors/porters-error.ts:11-14` で `"rateLimit"` を**予約**とコメントで明記し、
README（`:241`）も整合させた。強制切断は `network` のまま（誤分類しない＝安全側）。

## 検証

`src/` 内で `"rateLimit"` が現れるのは型定義とコメントのみで、返す箇所は無いことを確認
（[2026-06-17-01][run1] Run 2）。README の例と実挙動の不整合は解消。

**その後 [ADR-0044][adr44] で解禁された**: HTTP ステータスを分類するようになり、
プロキシ経由などで **HTTP 429 を受け取った場合に初めて `"rateLimit"` が produce される**
（[RV-13][rv13] の処置）。予約しておいた値が、後から正しい produce 元を得た形。

[adr6]: ../../adr/0006-error-model.md
[adr44]: ../../adr/0044-http-status-handling.md
[rv13]: 0013-http-status-ignored.md
[run1]: ../2026-06-17-01.md
