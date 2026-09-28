# RV-158 🟡 Number の書き込みで小数第 3 位以下が切り捨てられることを、使い方の文書が書いていない

- 重要度: 🟡 ／ 観点: API 忠実性 / ドキュメント
- 状態: fixed

## 概要

PORTERS は Number（Currency を含む）の書き込みで、小数第 3 位以下を黙って切り捨てる。ライブラリは `1.239` をそのまま
`1.239` として送るので、保存されるのは `1.23` になり、読み戻すと送った値と違う。
この PORTERS の挙動は、正典（`docs/usage/reference/`）には書いてあるが、利用者が読む使い方の文書
（入門・ガイド・リソース別・関数）には書かれていない。

## 根拠

- 正典: `docs/usage/reference/resource-api/write-format.md:58`「**Number**: 小数第 3 位以下は切り捨て」、
  `docs/usage/reference/resource-api/field-data-types.md:18`「数値。小数は最大 2 桁（Read）。Write 時、小数第 3 位以下は切り捨て」。
  Currency（Field Type 14）の Data Type も Number（同 `:31`）。
- 実装: `src/xml/encode-field.ts:116-134` の `assertWritableNumber` は、Number の値を `/^-?\d+(\.\d+)?$/` で検査するだけで、
  小数の桁数は見ない。`1.239` は通り、そのまま送られる。
- 使い方の文書: `docs/usage/` のうち `reference/` と生成物の `api/` を除いた範囲で「小数」を探すと、
  ID に小数を渡すと弾く説明（`topics/query.md:443`・`topics/write.md:50`）しか出てこない。
  Number の値の桁数の説明は、`topics/fields.md`・`topics/custom-fields.md`・`topics/write.md` のどこにも無い。

## 影響

**書いた値が黙って別の値になる**。例外もエラーも出ず、書き込みは成功として返る。
通貨の換算レートや、3 桁以上の小数を持つ計算結果を Currency / Number の項目へ書く利用者が、後で読み戻して初めて気づく。
取り消しの手段は無い（元の値は PORTERS に残らない）。

ライブラリは同じ種類の「黙って別の値になる」を、ほかの場所では送る前・読むときに止めている
（書き込みの `NaN` / 指数表記は RV-85、読み取りで精度を落とす値は RV-100 / RV-147）。
Number の桁数だけが、正典に書いてあるのに利用者の目に届かない。
小数を 2 桁までしか使わない利用者には影響しないので、🔴 ではなく 🟡 にした。

## 検出経緯

2026-09-29 の run 1（`src` の外も含めた全体のレビュー）で、観点 1 の「Read で取れた値を Write に戻せるか」を
`write-format.md` のデータ型ごとの書式と 1 行ずつ突き合わせていて気づいた。
`encode-field.ts` は Number の書式を検査しているが、桁数は検査の対象に入っていなかった。

## 推奨

- (a) **使い方の文書に書く**（ADR 不要）。`topics/fields.md` か `topics/write.md` に
  「Number（Currency を含む）は小数 2 桁までで、3 桁目以下は PORTERS が切り捨てる」と書き、
  `f.number()` を説明する `topics/custom-fields.md` からも指す。挙動は変わらない。
- (b) **送る前に弾く**（**要 ADR**）。小数が 3 桁以上の値を `PortersConfigError`（`validation`）にする。
  黙って値が変わることは無くなるが、今まで通っていた書き込みが失敗するので破壊的変更になる。
  PORTERS が切り捨てるのか四捨五入するのか、桁数の上限が項目の設定で変わるのかを実機で確かめてから決めるなら、
  LV として起票する。

(a) は (b) を決めるまでの間も必要になる。まず (a)。

## 処置

推奨 (a) を採った（2026-09-29・ADR 不要・挙動は変えない）。送る前に弾く (b) は採っていない。

- `docs/usage/topics/write.md` の「書くときはかたちが変わる」に、Number（Currency を含む）の値は小数 2 桁までで、
  小数第 3 位以下は PORTERS が切り捨てて保存すること、エラーにならず読み戻して初めて気づくこと、書く前に 2 桁へ丸めることを書いた。
- `docs/usage/topics/fields.md` の Data Type の表と、`docs/usage/topics/custom-fields.md` の `f.number()` の行の「書き込み値」に、
  「小数 2 桁まで。3 桁目以下は PORTERS が切り捨てる」を足した。
- 丸め方のコード例は載せていない。`Math.trunc(x * 100) / 100` のような書き方は、浮動小数点の誤差で 1 つ小さい値になることがあり
  （`1.13 * 100` は `112.99999…`）、誤った書き方を広めうるため。

(b) を採るかは、PORTERS が本当に切り捨てるのか（四捨五入ではないか）、桁数の上限が項目の設定で変わらないかを実機で確かめてから決める。

## 検証

- `docs/usage/` のうち `reference/` と `api/` を除いた範囲で、Number の小数の桁数が 3 か所（`topics/write.md:79`・`topics/fields.md:75`・
  `topics/custom-fields.md:217`）に書かれていることを grep で確かめた。
- `pnpm check`（文書のコード例の型検査を含む）・`lint:md`・`format:check`・`check:links`・`check:usage` は緑。
