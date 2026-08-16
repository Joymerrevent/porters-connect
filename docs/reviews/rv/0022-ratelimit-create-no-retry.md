# RV-22 🟢 HTTP 429 の後、非冪等な `create` が自動再送されない

- 重要度: 🟢 ／ 観点: リトライ / DX
- 状態: open

## 概要

[ADR-0044][adr44] の実装で `429 → category: "rateLimit"` を `PortersNetworkError` にした結果、
requester の冪等性ガード（「非冪等な write ＋ network 不確実 → 再送しない」）に掛かり、
**`create` / `createMany` は 429 の後リトライされずに表面化する**。

## 根拠

- `src/errors/classify.ts:119-124,153` — `rateLimit` を retryable な network 系に置いている。
- `src/http/requester.ts:147` — 冪等性ガードは `PortersNetworkError` を見る。
- [ADR-0010][adr10] — リトライ方針。

## 影響

5xx（適用されたかどうか不明）では再送しないのが正しい判断だが、
**429 は「処理される前に拒否された」ことが分かっている**ので、再送しても二重登録は起きない。
つまり**自動回復できる場面を 1 つ落としている**（安全側に倒しすぎ）。

ただし **PORTERS 直結では 429 は観測されない想定**（レート超過は強制切断）なので、
効くのは**プロキシ経由の環境だけ**。実害の範囲が狭く、かつ安全側の失敗なので 🟢。

## 検出経緯

[ADR-0044][adr44] の実装中（PR #143）。サブクラスの選択（429 を `PortersNetworkError` にする）に
伴う副作用として認識したうえで、**安全側に倒す判断で実装した**（見落としではなく既知の trade-off）。

## 推奨

冪等性ガードを「network 不確実」に限定する
（例: `category === "rateLimit"` は適用外にする、または「送信前に拒否された」ことを表す印を持たせる）。
**挙動変更＝要 ADR**。

**着手時期**: 429 が実 PORTERS で観測できるか自体が [live-verification][lv] **LV-9** の確認事項なので、
**契約取得後に判断する**。観測されないなら wontfix もありうる。

## 処置

—

[adr10]: ../../adr/0010-retry-throttle.md
[adr44]: ../../adr/0044-http-status-handling.md
[lv]: ../../live-verification.md
