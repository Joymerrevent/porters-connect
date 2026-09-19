# RV-48 🔴 Option の選択肢 alias が検証されずタグ名になり、書き込み XML を注入できる

- 重要度: 🔴 ／ 観点: API 忠実性 / フェイルセーフ
- 状態: fixed

## 概要

Option 型の書き込み値（`string[]`）の各要素が、**エスケープも検証もされないまま XML の要素名**として
出力される。呼び出し側の値が文字列のままタグ名に入るため、`<Item>` を閉じて別の `<Item>` を開く
文字列を渡すと、**同一リソースの別レコードを書き換える Item を注入できる**。型は `string[]` なので
**cast は要らない**。

## 根拠

`src/xml/encode.ts:197-200`（`encodeField` の `case "Option"`）:

```ts
case "Option":
  return (Array.isArray(value) ? value : [text(value)])
    .map((alias) => `<${alias}/>`)
    .join("");
```

`alias` は値そのもので、`escapeXml` を通らない。他の Data Type はすべて `scalar()`
（= `escapeXml`）を経由するので、**ここが唯一「呼び出し側の値がマークアップ構造になる」経路**。

正典は `docs/usage/reference/resource-api/write-format.md:57` — Option の wire 形は
`<FieldAlias><OptionAlias/></FieldAlias>`。つまり値がタグ名になる形自体は正しく、**だからこそ
値の検証が必要**（タグ名はエスケープでは守れない）。

**実測**（公開 API 経由・cast なし・mock transport で送信本体を捕捉）:

```ts
const untrusted =
  "A/></Person.P_Phase></Item><Item><Person.P_Id>999</Person.P_Id>" +
  "<Person.P_Name>pwned</Person.P_Name><Person.P_Phase><B";
await t.candidate.update(10001, { P_Phase: [untrusted] });
```

送信された body:

```xml
<Candidate><Item><Person.P_Phase><A/></Person.P_Phase></Item><Item><Person.P_Id>999</Person.P_Id><Person.P_Name>pwned</Person.P_Name><Person.P_Phase><B/></Person.P_Phase><Person.P_Id>10001</Person.P_Id></Item></Candidate>
```

`fast-xml-parser` の `XMLValidator` で **well-formed** と判定される（= PORTERS は解釈できる）。
`<Item>` が 2 つになり、2 つめは `P_Id 999` を名指している。

対照として、同じ文字列を `P_Name`（`SinglelineText`）に渡した場合は
`X/&gt;&lt;/Person.P_Phase&gt;…` と正しくエスケープされる。**エスケープの実装は正しく、
Option だけがその経路を通っていない**。

## 影響

**このライブラリの存在理由（XML を利用者から隠す）の裏返しが破れている**。外から来た文字列が
PORTERS への書き込み XML の**構造**になるため、選択肢 alias を外部入力から組み立てるアプリ
（フォームの select、CSV 取り込み、ロードマップが向かっている MCP サーバーのツール引数）で、
**意図しないレコードの上書き**が起きうる。

- 削除 API が無いので「消える」ことは無いが、**別レコードの項目を書き換えられる**のは同じ重さ。
  ATS のデータなので、気づかないまま別候補者のレコードが変わるのが最悪の形。
- **一括書き込み（`createMany` / `updateMany`）では影響が広がる**: `encodeWriteItem` で測った長さを
  前提に 200 件ずつ詰めるので、注入で `<Item>` が増えると**件数の上限計算そのものが実際とずれる**。
- 発火は **今すぐ**（現行 0.19.0 の既定経路）。ただし「外部入力を選択肢 alias に渡す」アプリが
  必要なので、全利用者が今日壊れているわけではない＝ latent と即時の中間。
  **フェイルセーフの観点では即時扱い**（壊れたときに安全側へ倒れていない）。

## 検出経緯

観点 1（API 忠実性）で「Read で取れた値を Write に戻せるか（round-trip）」を確認していて、
Option の read 値が `string[]`・write 値も `string[]` で対称なのを追った先。`encodeField` の
各 case が `scalar()` を経由しているかを機械的に見たところ、`Option` だけが
テンプレートリテラルに値を直に埋めていた。`src/xml/encode.test.ts` には PCDATA の
エスケープ試験（`:27`, `:124`, `:165`）はあるが、**タグ名側の試験が 1 件も無い**ため、
カバレッジ 100% でも見えていなかった。

## 推奨

**要 ADR**（挙動変更＝これまで通っていた値が throw するようになる）。論点は「何を弾くか」。

- (a) **XML Name として妥当かを検証して弾く**（推奨）。`PortersConfigError` ＋
  `category: "validation"` で送信前に落とす。既存の同型のガード（`host` 書式・`count` 範囲・
  `keywords` 長・Image の MIME / サイズ）と同じ系列に載る。
- (b) `Option.P_*` の形に限定する。より狭くて安全だが、**末端 alias の接頭辞が未確定**
  （[LV-1][lv]）なので、正しい値を弾くおそれがある。(a) を採り、LV-1 確定後に狭めるのが順当。
- (c) 弾かずにエスケープする — **取れない**。タグ名はエスケープできない（`&lt;` は要素名として不正）。

いずれの案でも、`encodeItem` の `alias`（= 呼び出し側オブジェクトのキー）も同じ経路で
タグ名になる（`src/xml/encode.ts:255` の `qualify(prefix, alias)`）。型は `keyof F` に
絞っているが、excess property check はフレッシュなリテラルにしか効かないので
`create(JSON.parse(body) as CandidateCreateInput)` では任意のキーが通る。
**同じ ADR で 1 箇所（「値がタグ名になる境界」）にまとめて検証を置く**のが筋。

あわせて **回帰試験を仕組みで**: `encode.test.ts` に「タグ名になる値」の敵対的入力ケースを足す
（PCDATA 側と同じ厚さで）。

## 処置

**完了。** [ADR-0085][adr85] として起票し、**decider が案A ＋ 論点2 (ii) を選択して `accepted`**
（2026-09-19）。決まったのは「**XML Name として妥当かを検証して弾く**」と
「**値が要素名になる境界すべてに置く**」。

実施は次の 4 つ:

1. `src/util/xml-name.ts` — XML 1.0 の `Name` production を出典の順に写した判定
   （`isXmlName`）。`util/` は依存ゼロの葉なので、判定だけを置きエラーは作らない。
2. `src/xml/encode.ts` — `assertTagName` を 1 箇所に置き、**2 つの境界**から呼ぶ。
   Option の選択肢 alias（`encodeField` の `case "Option"`）と、項目 alias（`encodeItem`）。
   エラーは `PortersConfigError` ＋ `category: "validation"`（[ADR-0006][adr6]）で、
   呼び出し元はすべて `async` なので reject として届く（[ADR-0046][adr46]）。
3. [LV-26][lv] の起票 ＋ `src/resources/option.ts` に番号つき `VERIFY(live)`。
   Option マスタの `P_Alias` だけはスカラ読みで保証が効かないため。
4. 書き込みの制約ガイド（`docs/usage/concepts/limits.md`）に節を 1 つ ＋ changeset（patch）。

## 検証

**指摘の払い出しそのものが弾かれることを pin した。** `src/xml/encode.test.ts` の
「要素名になる値の検証（ADR-0085 / RV-48）」が次を固定している:

- 本指摘の**実測で使った payload** を Option の alias から弾く。
- エラーが `PortersConfigError` ＋ `category: "validation"` で、**どの項目のどの値か**を名指す。
- 空白 / 数字始まり / 空文字 / `>` `/` `&` を含む alias を弾く（6 ケース）。
- **正規の alias は通る** — `Option.P_東京` を含む。過剰に締めていないことの固定で、
  ここが締まると round-trip（[ADR-0017][adr17]）が壊れる。
- **項目 alias も同じ検証を通る**（論点2 (ii)）。`JSON.parse(...) as …` で型検査を通り抜ける
  実際の形で固定している。
- **同じ文字列でも本文の位置なら従来どおり通る**（エスケープ経路は塞いでいない）。
- property-based: **どんな alias を渡しても `<Item>` は増やせない**。
  生の文字列で数えている — パースして数えると、パーサ自身の都合（予約名の拒否）が混ざって
  不変条件がぼやけるため。

`src/util/xml-name.test.ts` は判定そのものを 43 ケースで固定。**NameStartChar の各範囲から
1 文字ずつ当てている**のが要点で、これはミューテーションが教えてくれた穴だった — 最初は
ASCII と日本語しか試しておらず、**範囲を 1 つ消す変異が 3 件生き残った**（ラテン 1 補助・
ギリシャ〜キリル・上付き〜グラゴル）。範囲の寄せ集めは、端から 1 文字ずつ当てないと
落としても気づけない。NameChar にしかない範囲（`·` / 結合文字 / `‿`）は
「2 文字目なら通り、先頭なら通らない」の形で固定した。

`u` フラグを消す変異だけは理由つきで `Stryker disable` してある。外すと範囲の順序が壊れて
**RegExp の構築が SyntaxError になりモジュールが読めなくなる**ので、殺したテストを
帰属できない（静的ミュータント）。変更すれば全テストが落ちるため見逃しようがない。

品質ゲートは全 green（**1249 tests**・coverage は perFile 100/99.2/100/100・
**mutation 96.29**＝閾値 95 超、`xml-name.ts` は survivor 0）。

[adr6]: ../../adr/0006-error-model.md
[adr17]: ../../adr/0017-option-read-shape.md
[adr46]: ../../adr/0046-guard-error-contract.md
[adr85]: ../../adr/0085-option-alias-validation.md
[lv]: ../../live-verification.md
