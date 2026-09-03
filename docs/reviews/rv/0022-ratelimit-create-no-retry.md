# RV-22 🟢 HTTP 429 の後、非冪等な `create` が自動再送されない

- 重要度: 🟢 ／ 観点: リトライ / DX
- 状態: fixed

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

**実施**（2026-09-03・[ADR-0063][adr63] accepted・案A）。**起票時より範囲が広い**まま片付けた。

- **ガードの条件を「送信済み ＋ 結果が不明」に限定**した。requester のループに
  「この試行が実際に送られたか」を持ち、`sent && e.category !== "rateLimit"` のときだけ
  非冪等な write の再送を止める（`src/http/requester.ts`）。`classify.ts` は変更なし
  ＝ [ADR-0044][adr44] の status→category 写像は不変。
- **429 だけでなく、送信前の失敗も対象になった**。[ADR-0050][adr50] の Consequences が
  「ガードの粒度は RV-22 と同じ論点なので**そちらで一緒に見直す**」として送ってきた宿題で、
  **トークン取得に失敗した場合はリクエストが一度も出ていない**のに再送しなかった。
  起票時の本文は 429 の話だけを書いていたが、**こちらは契約の有無に関係なく今日起きる**経路。
- **[ADR-0010][adr10] の決定は変えていない**。「非冪等な write を不確定失敗で再送しない」は維持で、
  変えたのは「不確定」の判定方法だけ。ADR-0010 の決定文（「応答が返らない失敗（timeout/切断）では
  自動再試行しない」）に**実装を合わせた**形になる。
- **429 の解釈は未確認のまま**。「常に処理前の拒否」という仮定は [live-verification][lv] **LV-9** に紐づく
  ので、`VERIFY(live)` をコードに残した。実 PORTERS が切断で返すなら、効くのはプロキシ経由の環境だけ
  という評価も変わらない。
- テストは 2 本追加（トークン取得失敗後の `create` 再送／429 後の `create` 再送）。
  **回帰の芯＝送信後の timeout・切断・5xx で再送しないこと**は既存テストが押さえている。
  `requester.ts` の mutation score は 100%。

> 起票時の行番号は陳腐化していた（`requester.ts:147` → 本処置の直前で 119）。
> 現在地は `mayHaveApplied` の名前で辿ること。

[adr10]: ../../adr/0010-retry-throttle.md
[adr44]: ../../adr/0044-http-status-handling.md
[adr50]: ../../adr/0050-auth-http-status-handling.md
[adr63]: ../../adr/0063-idempotency-guard-scope.md
[lv]: ../../live-verification.md
