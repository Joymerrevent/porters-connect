# RV-70 🟡 応答の `<Code>` / `<Id>` を形しか見ておらず、崩れた値を 0（成功）として読む

- 重要度: 🟡 ／ 観点: API 忠実性 / フェイルセーフ
- 状態: fixed

## 概要

`toInt` は文字列でないノード（属性付きの要素・入れ子・重複して配列になったもの）を「無い」とみなして 0 を返す。そのため、崩れたエラー応答が成功として通る。

## 根拠

- `src/xml/parse-xml.ts:54` の `toInt`、`src/xml/parse-write-result.ts:45`、`src/xml/parse-authentication.ts:34`。
- 実測（2026-09-26）: 読み込みの応答で `<Code type="e">103</Code>` や `<Code>0</Code><Code>103</Code>` は空のページとして成功扱いになった。書き込みの応答で Item の `<Code>` が欠けると成功、`<Id>` が欠けると `create` が id 0 を返した。
- [ADR-0051][adr51] は「200 の想定外の本文を空ページにしない」と決めている。[write-format.md][wf] は Item ごとに `Id` と `Code` が返ると書いている。
- 書き込みの応答にはルート要素名の検査（ADR-0051）が無く、別のリソースの応答も受け付ける。

## 影響

🟡。PORTERS がこうした形を返すかは確かめていない（前提）。返せば、失敗が成功として黙って通る。

## 検出経緯

2026-09-26 に `src` のすべてのコード（テストを除く 121 ファイル）を change-review の手順でレビューした。http・auth／xml・util／accessor／resources・fields・クライアントの 4 つのまとまりに分けて並行で調べ、High と主な Medium は、報告の前に別の試験で再現を確かめた。

## 推奨

- `toInt` で「無い」と「文字列でない」を分け、文字列でないときは読めない応答として投げる。`Code` / `Error` は数字だけであることを必須にする。
- 書き込みの応答の Item は、`Id` と `Code` の両方を必須にする。単件の書き込みは Item がちょうど 1 件であることを確かめる。書き込みの応答にもルート要素名の検査を足す。

## 処置

**実施（2026-09-26・fix/xml-review・`0d53d3d`）。** `src/xml/parse-xml.ts` に `toCode` を足し、`<Code>` / `<Error>` を「無い・空なら 0、数字ならその数、それ以外は読めない応答」として読む（読み込み・書き込み・認証）。書き込みの応答は Item ごとに `Code` を必須にし、成功した Item の `Id` は正の整数を必須にし、ルート要素名を確かめる。単件の書き込みは結果がちょうど 1 件であることを確かめる。

## 検証

`src/xml/parse-xml.test.ts` の `toCode` の表、`parse-write-result.test.ts` の拒否する形の表とルート要素名、`first-write-result-id.test.ts` の 0 件と 2 件。テストの偽の応答のルート要素を、送った本文と同じにした。

[adr51]: ../../adr/0051-read-envelope-identification.md
[wf]: ../../usage/reference/resource-api/write-format.md
