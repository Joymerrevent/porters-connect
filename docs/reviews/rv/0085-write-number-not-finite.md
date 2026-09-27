# RV-85 🟡 書き込みで、NaN・Infinity・指数表記の数をそのまま送る

- 重要度: 🟡 ／ 観点: フェイルセーフ
- 状態: fixed

## 概要

Number や id の項目に NaN・Infinity・1e21 を渡すと、`"NaN"`・`"Infinity"`・`"1e+21"` として送る。id の項目に 1.5 も送る。

## 根拠

- `src/xml/encode-field.ts:29` の `scalar` が `text(v)` をそのまま書く。
- 実測（サブエージェント・2026-09-26）: 上の値がそのまま本文に入った。PORTERS がこれらを Code 103 で拒むかは確かめていない。

## 影響

🟡。拒まれなければ壊れた値が登録される。拒まれても、原因が利用者に伝わりにくい。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- 送る前に数を確かめる。id の項目は安全な整数、Number は有限の値だけを受ける。

## 処置

**実施（2026-09-26・fix/xml-review・`42765d9`）。** `src/xml/encode-field.ts` の `assertWritableNumber` で、数の値は 10 進の表記になるものだけ、id の項目は安全な整数だけを書く。外れたら送る前に `PortersConfigError`（validation）。

## 検証

`src/xml/encode-field.test.ts` の「numbers PORTERS can read (RV-85)」。
