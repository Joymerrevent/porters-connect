# RV-22 🟢 HTTP 429 の後、非冪等な `create` が自動再送されない

- 重要度: 🟢 ／ 観点: リトライ / DX
- 状態: open

## 概要

[ADR-0044][adr44] の実装で `429 → category: "rateLimit"` を `PortersNetworkError` にした結果、
requester の冪等性ガード（「非冪等な write ＋ network 不確実 → 再送しない」）に掛かり、
**`create` / `createMany` は 429 の後リトライされずに表面化**する。5xx（適用されたか不明）では正しい判断だが、
**429 は「処理される前に拒否された」ことが分かっている**ので、再送しても二重登録は起きない。
安全側ではあるが、自動回復できる場面を 1 つ落としている

## 根拠

`src/errors/classify.ts:119-124,153`（`rateLimit` を retryable な network 系に置く）/
`src/http/requester.ts:147`（冪等性ガードは `PortersNetworkError` を見る）/
[ADR-0010][adr10]（リトライ方針）

## 検出経緯

[ADR-0044][adr44] の実装中（PR #143）。サブクラスの選択（429 を `PortersNetworkError` にする）に
伴う副作用として認識したうえで、**安全側に倒す**判断で実装した

## 推奨

冪等性ガードを「network 不確実」に限定する（例: `category === "rateLimit"` は適用外にする、
または「送信前に拒否された」ことを表す印を持たせる）。**挙動変更＝要 ADR**。
なお PORTERS 直結では 429 は観測されない想定（強制切断）なので、**優先度は低い**（プロキシ経由の環境でのみ効く）

## 処置

—

[adr10]: ../../adr/0010-retry-throttle.md
[adr44]: ../../adr/0044-http-status-handling.md
