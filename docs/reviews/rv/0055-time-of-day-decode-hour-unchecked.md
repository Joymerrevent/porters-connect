# RV-55 🟢 `decodeTimeOfDay` が 1 日目の時 24〜47・分秒 60 以上を弾かず、別の wire 値に往復する

- 重要度: 🟢 ／ 観点: API 忠実性 / フェイルセーフ
- 状態: open

## 概要

`decodeTimeOfDay` は基準日（`1970-01-01` / `1970-01-02`）は検証するが、**時・分・秒が時計の範囲
（時 00〜23・分秒 00〜59）に収まっているかは 1 日目で見ていない**。`"1970-01-01T30:00:00Z"` を
`"30:00"` として返し、それを `encodeTimeOfDay` に戻すと `"1970-01-02T06:00:00Z"` になる＝
**入力と別の wire 値へ黙って往復する**。`encodeTimeOfDay` 側は範囲を検証しているので、
[ADR-0086][adr86] 論点3「変換関数が**両方向とも**検証する」の decode 側が欠けている。

## 根拠

- `src/util/time-of-day.ts:19` — `ISO_DATETIME_RE` は各欄を `\d{2}` で受けるだけで値の範囲を見ない。
- `src/util/time-of-day.ts:68-73` — `hours = wireHours + extra` を `MAX_HOURS`（47）とだけ比べる。
  2 日目（`extra = 24`）なら wire 時 24 以上は 48 超になって弾かれるが、1 日目（`extra = 0`）は
  wire 時 24〜47 がそのまま通る。分・秒は比較そのものが無い。
- `src/util/time-of-day.ts:44` — JSDoc は「ISO date-time on 1970-01-01 / 1970-01-02 でなければ
  throw」と約束している。`T30:00:00` は ISO date-time ではない。
- `src/util/time-of-day.ts:117` — `encodeTimeOfDay` は `hours > 47 || minutes > 59 || seconds > 59`
  を弾く＝**片側にだけ検証がある**。
- [ADR-0086][adr86] `docs/adr/0086-time-of-day-fields.md:218`（論点3「変換関数が両方向とも検証する」）／
  `:273`（「`decodeTimeOfDay` が基準日と**書式**を検証してから `"HH:mm"` へ」）。
- 実測（本 run・`tsx`）:

| 入力                                                       | 結果                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `decodeTimeOfDay("1970-01-01T24:00:00Z")`                  | `"24:00"`                                                   |
| `decodeTimeOfDay("1970-01-01T30:00:00Z")`                  | `"30:00"`                                                   |
| `decodeTimeOfDay("1970-01-01T09:60:00Z")`                  | `"09:60"`                                                   |
| `decodeTimeOfDay("1970-01-01T09:00:99Z")`                  | `"09:00:99"`                                                |
| `decodeTimeOfDay("1970-01-02T24:00:00Z")`                  | throw（outside the time-of-day range）＝ **2 日目だけ弾く** |
| `encodeTimeOfDay(decodeTimeOfDay("1970-01-01T30:00:00Z"))` | `"1970-01-02T06:00:00Z"`（**入力と別の値**）                |

- テストの穴: `src/util/time-of-day.test.ts:141-145` の往復 property は wire 時を `0..23` からしか
  引かないので、この非対称は観測されない。`:63` は 2 日目の時 24 だけを固定している。
- 変異テストも同じ穴を指している（本 run の全体実測・96.45）: `time-of-day.ts` の survivor 3 件のうち
  2 件は `ISO_DATETIME_RE`（`:19`）の先頭 `^` と末尾 `$` を外す変異で、**どのテストも落ちない**。
  つまり decode 側の「書式」検証は、前後に余分な文字が付いた入力でも境界の外でも pin されていない。

## 影響

**latent・🟢。** ライブラリの Read 経路からは到達しない: `portersDateTimeToIso`
（`src/util/datetime.ts:21-24`）が `Date.parse` で `30:00:00` / `09:60:00` を弾くので、Read で得た
ISO をそのまま渡す限り不正な時分は届かない（唯一 `1970/01/01 24:00:00` だけは `Date.parse` が
「翌日 0 時」として通すが、`"24:00"` と読むのは時計としては正しく、再 encode は出典の正規形
`1970/01/02 00:00:00` に落ちる＝害は無い）。

届くのは、利用者が ISO を**手で組み立てた**／CSV 等から流し込んだときだけ。そのとき encode 側は
弾くのに decode 側は通し、しかも**別の wire 値に往復する**（`30:00` → 2 日目 06:00）ので、
「黙ってずれる」形になる。これは [ADR-0086][adr86] が支配的な故障と呼ぶ「変換の掛け違い」と同じ
倒れ方で、片方向だけ検証が無いのは同 ADR の決定に対する**実装の欠け**と見るのが妥当。
実害に至る経路が狭いので 🟢。

## 検出経緯

観点1（round-trip）で `decodeTimeOfDay` ⇄ `encodeTimeOfDay` の対称性を追い、「両方向で検証する」
という決定に対して decode 側の検証が**基準日だけ**であることをコードで確認し、実測で固定した。
Read 経路の安全性（`Date.parse` が弾く）まで確かめてから重要度を決めている。

## 推奨

- (a) `decodeTimeOfDay` で `wireHours > 23 || Number(minutes) > 59 || Number(seconds) > 59` を、
  基準日と同じ `PortersConfigError`（`category: "validation"`）で弾く。`hours > MAX_HOURS` の分岐は
  これに吸収される（2 日目の wire 時 24 も「wire 時 > 23」で落ちる）。JSDoc の約束（ISO date-time
  以外は throw）と一致する。**ADR 不要**: [ADR-0086][adr86] 論点3 が既に「両方向とも検証」と
  決めており、通していた値はどれも出典の書式に無い（[RV-49][rv49] と同じ形＝決定の未適用側を
  埋めるだけ）。semver は patch。
- (b) 往復 property を 1 日目・2 日目とも wire 時 `0..99`・分秒 `0..99` で回し、`0..23` / `0..59`
  以外は throw することを固定する。今の property は**正常域しか引かない**ので、往復は証明できても
  拒否は証明できない（[RV-48][rv48] で見た「敵対的入力を試していない」の再来）。

## 処置

—

[adr86]: ../../adr/0086-time-of-day-fields.md
[rv48]: 0048-option-alias-xml-injection.md
[rv49]: 0049-throttle-options-unvalidated.md
