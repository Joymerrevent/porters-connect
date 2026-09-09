# RV-36 🟡 日時の変換だけが例外を投げ、それが `PortersError` でない（読み・書きの両方）

- 重要度: 🟡 ／ 観点: エラーモデル / フェイルセーフ
- 状態: open

## 概要

`docs/guide/custom-fields.md` は「**値レベルの検証はしません**」と明記し、理由まで書いている
（サーバーが受ける値を手前で落とすと危険側に倒れるため）。ところが実装は**そうなっていない**。
`Date` / `DateTime` / `Age` の変換だけは値を検査していて、しかも投げる例外が
**`PortersError` の系統から外れた素の `RangeError`** になっている。

しかもこれは**書き込みだけの話ではない**。同じ変換は**読み取り**にも入っていて、
そちら側は**利用者が渡した値ではなく PORTERS が返した値**が引き金になる。

## 根拠

`src/xml/encode.ts` の `encodeField`（書き）と `src/xml/decode.ts` の `decodeField`（読み）を
各 Data Type で直接叩いた実測（2026-09-09・`develop` 51c6465）:

```text
[書き] Date     <- "not-a-date" => threw RangeError, isPortersError=false
[書き] DateTime <- "not-a-date" => threw RangeError, isPortersError=false
[書き] Number   <- "abc"        => ok: "abc"          ← 素通し
[書き] User     <- "abc"        => ok: "abc"          ← 素通し
[書き] Mail     <- "not-a-mail" => ok: "not-a-mail"   ← 素通し

[読み] Date     <- "ただの文字列"  => threw RangeError, isPortersError=false
[読み] DateTime <- "ただの文字列"  => threw RangeError, isPortersError=false
[読み] Date     <- "2026-09-09"   => threw RangeError, isPortersError=false
```

- 投げているのは `src/util/datetime.ts` の 4 関数（`throw new RangeError(...)` が計 5 箇所）。
  **`src/` で `PortersError` 派生でない throw はここだけ**。
- 経路は 2 つ。書きは `src/resources/resource.ts:479` の `buildWriteXml` → `encodeField`、
  読みは `decodeField`（`src/xml/decode.ts:277,286`）→ 各リソースの decode。
  どちらも `async` の内側なので届き方は **reject** で、[ADR-0046][adr46] の
  「`Promise` を返す公開メソッドは同期 throw しない」は**守られている**。問題は届き方ではなく**型**。
- [ADR-0006][adr6] は「エラーは判別可能な型に整理：基底 `PortersError` ＋ 系統別サブクラス ＋ `category`」
  と決めている。`RangeError` はそのどれでもない。
- `docs/guide/error-handling.md` のエラー一覧表に `RangeError` の行は**無い**
  （`grep -rn "RangeError" docs/` は 0 件）。ガイドが勧める
  `catch (e) { if (e instanceof PortersError) … }` の形は、この経路だけ取りこぼす。
- `Age` も同じ経路（`case "Date": case "Age":`）＝ 3 つ目の対象。

## 影響

**書き側**（利用者が渡した値が引き金）は軽い。送信前に止まるので誤った値は PORTERS に入らず、
壊れるのは利用者のエラーハンドリングだけ。`PortersError` で分岐しているコードでは、
日付の書き間違いだけが未知の例外として上位へ抜け、リトライ可否（`category`）も読めない。

**読み側のほうが重い**。引き金が**サーバーの応答**なので、利用者のコードが正しくても起きる。
`yyyy/mm/dd` でない値が 1 レコードでも混ざると、**そのページの読み取り全体が
`RangeError` で reject** する（decode はページ単位で走る）。現実に踏む経路は 2 つ:

1. **カスタム項目の宣言を取り違えた** — 実物がテキスト項目なのに `f.date()` と宣言すると、
   その項目に何か入っている全レコードの読み取りが落ちる。宣言の妥当性は誰も確かめていない
   （[ADR-0023][adr23] D5 が follow-up 送り）ので、取り違えたまま動かせてしまう。
2. **PORTERS 側の値が想定と違った** — LV 未確認の形（空文字以外の「未設定」表現など）が返ってきたとき、
   _寛容に読む_ のではなく**落ちる**。`docs/reference/gotchas.md` は
   「未知 Alias に強い設計（寛容なパース・明確なエラー）」を求めているが、ここは
   寛容でも明確でもない。

**ライブラリの約束と実装が食い違っている**点は両側に共通する。ガイドの「値レベルの検証はしません」を
読んだ利用者は、日付だけ検証されることを知らない。

## 検出経緯

ロードマップの案D（`defineFields` 深掘り＝値レベルの実行時検証・テナント実在チェック・宣言生成）の
着手可否を評価する過程で、「値検証はまだ何も無い」という前提を確かめるために `encodeField` を
直接叩いたところ、**日付系だけ既に検証が効いていて、そこだけ例外の系統が違う**と分かった。
続けて読み側を叩いて、**同じ穴が decode 側にもあり、そちらはサーバー応答が引き金**だと分かった。

案D の「値レベルの実行時検証」は、**ゼロから足す話ではなく、半端に効いている今のものを揃える話**
から始まることになる。

## 推奨

**単独で直さず、値レベル検証の ADR で一緒に決める**（stakeholder 判断・2026-09-09）。
理由は、`RangeError` をどのエラー型に寄せるかが [ADR-0006][adr6] の分類に無いものを 1 つ増やす判断
だからで、先に実装を動かすと分類の判断を暗黙に先取りしてしまう。

決めどころは 4 つ:

1. **読みと書きを同じ扱いにするか** — 引き金が違う（サーバー応答 / 利用者の値）ので、
   `category` も本来は別（`resource` 系 / `config` 系）になりうる。同じ `RangeError` で
   一括りにされている今の形が、そもそも 2 つの違う失敗を混ぜている。
2. **どのエラー型に寄せるか** — 既存の `category` は `auth` / `resource` / `network` / `config` の 4 つ。
   `config` は今のところ**構築時・宣言時の設定不正**（`PortersConfigError`）を指しており、
   `defineFields` の同期 throw もここ。**呼び出しごとの値**を同じ箱に入れてよいかは要判断。
3. **読み側は落とすのか、寛容に読むのか** — 落とす（今の挙動・型は保証されるが 1 件で全滅）か、
   `null` に倒して続ける（読めるが黙って欠ける）か、`null` ＋ 警告か。
   [gotchas][gotchas] の「寛容なパース・明確なエラー」に照らすと、
   **黙って `null`** は選びにくい（Option の取り違えが既にそうなっており、
   それが [ADR-0069][adr69] の動機になっている）。
4. **書き側の検証範囲をどう揃えるか** — 日付系に合わせて他の型も検査するのか（＝ガイドの記述を
   書き換える）、逆に日付系も素通しに落とすのか。後者は「PORTERS 形式の文字列をそのまま渡した」
   ケースを黙って通してしまう（`isoToPortersDate` は `2026/09/09` を弾く側）ので**危険側**。

なお決めるまでの暫定として、**ガイドに現状を書くだけ**（「日付系だけは例外を投げ、
そのとき飛ぶのは `RangeError`」）でも食い違いは消える。実装を触らないぶん最小。

## 処置

—（未処置）

[adr6]: ../../adr/0006-error-model.md
[adr23]: ../../adr/0023-custom-field-declaration-dsl.md
[adr46]: ../../adr/0046-guard-error-contract.md
[adr69]: ../../adr/0069-tenant-field-catalog-tooling.md
[gotchas]: ../../reference/gotchas.md
