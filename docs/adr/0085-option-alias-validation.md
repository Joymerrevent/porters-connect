# 85. 呼び出し側の値がタグ名になる境界で、XML Name として妥当かを検証して弾く

- Status: proposed
- Date: 2026-09-18
- Deciders: <未定 — 議論待ち>

> [RV-48][rv48]（🔴）の起票に対する ADR。**挙動変更**（これまで通っていた値が throw になる）なので、
> 実装より先に決定が要る。実装は accept 後・別 PR。
>
> 本 ADR は「何を弾くか」だけを決める。**エラーの型と category は既に決まっている**
> （[ADR-0006][adr6]＝呼び出し側由来は `PortersConfigError` ＋ `category: "validation"`、
> [ADR-0046][adr46]＝送信前ガードは同期 throw せず reject）。再決定しない。

## Context and Problem Statement

PORTERS の Write で Option 型の項目は `<FieldAlias><OptionAlias/></FieldAlias>` という形を採る
（[write-format][wf]「**Option**: `<FieldAlias><OptionAlias/></FieldAlias>`。複数選択は Option Alias を
並べる。**末端 Alias のみ**」）。つまり**選択肢の alias が要素名になる**のが正典の形である。

ライブラリはこれを `src/xml/encode.ts:197-200` でそのまま実装している。

```ts
case "Option":
  return (Array.isArray(value) ? value : [text(value)])
    .map((alias) => `<${alias}/>`)
    .join("");
```

問題は、この `alias` が**呼び出し側から来た値そのまま**で、検証もエスケープもされない点である。
Option の書き込み値は [ADR-0017][adr17] の読み書き対称性から `string[]` なので、
**cast なしで任意の文字列が要素名の位置に入る**。

実測（公開 API 経由・cast なし）では、`<Item>` を閉じて開き直す文字列を渡すと
**well-formed な XML に別レコードを名指す `<Item>` が注入できた**（入力と出力は [RV-48][rv48] に記録）。
他の Data Type はすべて `scalar()`（= `escapeXml`）を通るので、**ここが唯一の経路**である。

同じ形の経路がもう 1 つある。`encodeItem`（`src/xml/encode.ts:255`）の
`const tag = qualify(prefix, alias)` で、`alias` は呼び出し側オブジェクトのキーである。
型は `WritableKeys<F>` に絞っているが、excess property check は**フレッシュなリテラルにしか効かない**ので
`create(JSON.parse(body) as CandidateCreateInput)` では任意のキーが通る。

**エスケープでは解けない。** 要素名に実体参照は書けない（`&lt;` は要素名として不正）。
したがって取れる手は「**検証して弾く**」だけで、これは挙動変更になる。

問い: **呼び出し側の値が要素名になる境界で、何を受け入れ、何を弾くか。**

## Decision Drivers

- **フェイルセーフ** — 現状の倒れ方は「**黙って別レコードを書く**」で、最悪の側。削除 API が無いので
  復旧もできない（[CLAUDE.md][claude]）。倒す先は「送信前に明示的な例外」。
- **read で取れた値を write に戻せる**（round-trip・[ADR-0017][adr17] の対称性）。
  **検証がこれを壊してはいけない。**
- **正典に無いことを発明しない**（[ADR-0002][adr2]）。**末端 alias の文字集合は出典に書かれていない。**
  [write-format][wf] は「末端 Alias のみ」と言うだけで、alias の書式を定義していない。
  接頭辞すら未確定（[LV-1][lv]＝ライブ例は `Option.P_Tokyo`、旧 fixture は接頭辞なし）。
- **既存の送信前ガードの系列に揃える** — `hostname` 書式（[ADR-0048][adr48]）／`count` 範囲／
  `keywords` 長／Image の MIME・サイズ／attachment 10MB。いずれも「PORTERS に opaque な 400 を
  返させず、手元で config error にする」形。
- **1 箇所に集約**（1 ファイル 1 責務）。2 つの経路に別々の検証を置くと片方だけ腐る。

### 効く事実: read が返す値は「パーサが読んだタグ名」

`decodeOption`（`src/xml/decode.ts:171-178`）は `Object.keys(root)` を返す。
**読み取り値は応答 XML のタグ名そのもの**なので、正常な XML 応答から来た値は XML Name である。
実測でも `Option.P_SE` / `Option.P_東京` はどちらもタグ名として読め、XML Name 検証を通る。

→ **「XML Name として妥当か」で弾いても round-trip は壊れない。** これが案の比較を決める。

（厳密には `fast-xml-parser` はバリデータではないので「必ず XML Name」とは言い切れない。
ただしそこが破れるのは PORTERS が非 well-formed を返したときで、その場合の問題は検証ではない。）

## Considered Options

- **案A**: **XML Name** として妥当かを検証して弾く（Unicode 込みの Name production）。
- **案B**: **ASCII 識別子**の allowlist（`[A-Za-z_][A-Za-z0-9_.-]*`）に限る。
- **案C**: 出典の実例に合わせた**狭い pattern**（`Option.` ＋ `P_` 始まり）。
- **案D**: 検証せず**エスケープ**する。
- **案E**: Option の書き込み入力を `string[]` から**ブランド型**にし、型で塞ぐ。
- **案F**: 現状維持 ＋ ドキュメントで「信頼できない値を渡すな」と注記する。

### 論点2: 検証をどの境界に置くか

- **(i)** Option の alias だけ。
- **(ii)** Option の alias ＋ `encodeItem` の item キー（＝**値が要素名になる境界すべて**）。

## Decision Outcome

**未決（`proposed`）。** 推奨は **案A ＋ 論点2 は (ii)**。

**案A を推す理由は、round-trip を壊さない中で最も広いから。** 上記のとおり読み取り値は
タグ名由来なので、XML Name 検証は**正しい値を 1 つも弾かない**。一方で注入に必要な文字
（`<` `>` `/` `"` 空白）はすべて XML Name の外にあるので、**穴は閉じる**。
「正典に無いことを発明しない」も満たす — XML Name は PORTERS の仕様ではなく
**XML の仕様**であり、ライブラリが勝手に決めた業務ルールではない。

**案B・案C は「正しい値を弾く」側に倒れうる。** PORTERS は日本語の製品で、
**テナント管理者が選択肢を作る**。その alias が ASCII に限る保証はどこにも書かれていない
（案B は `Option.P_東京` を弾く。実測で XML Name としては妥当と確認済み）。
案C はさらに [LV-1][lv]（接頭辞が未確定）を確定事項として扱ってしまう。
**未確定を狭い側に固定するのは、この 2 案では安全側ではない** — 弾かれるのは攻撃ではなく
正規の書き込みで、しかも回避手段が無い。

**案D は取れない。** 要素名はエスケープできない。**検討して棄却した記録として残す**
（次に読む人が同じ道を試さないため）。

**案F はフェイルセーフに反する。** 「渡すな」と書くのは、守りを利用者の注意に移すだけで、
このライブラリが PORTERS 固有の罠を隠すために存在する理由と矛盾する。

**案E は筋は良いが投資に見合わない。** 型でブランドを要求すれば実行時検証は不要になるが、
`["Option.P_SE"]` という**リテラルが書けなくなる**。ドキュメントの例とガイドが全滅し、
破壊的変更としても大きい。実行時検証 1 箇所で同じ穴が閉じるなら、そちらが薄い。

**論点2 で (ii) を推すのは、2 つの経路の原因が同一だから。** どちらも「呼び出し側の値が
要素名になる」で、(i) だけ直すと item キー経路が**同じ指摘で二度目に挙がる**。
`encodeItem` 側は型が一応の壁になっているぶん優先度は低いが、
**検証を書く場所は同じ 1 箇所**なので分けても安くならない。

### Consequences

- **Good**: 注入の穴が閉じる。倒れ方が「黙って別レコードを書く」から
  「送信前に `PortersConfigError`」へ変わる＝安全側。
- **Good**: 検証が XML の仕様に接地するので、PORTERS の未確定事項（[LV-1][lv]）に依存しない。
- **Bad**: **これまで通っていた入力が throw になる。** 実際に壊れるのは
  「XML Name でない alias を渡していたコード」で、それは今も正しく動いていない
  （不正な XML を送っている）ため、実害のある非互換は想定しにくい。
  semver は **patch** と考える（不正入力が明示エラーになるだけ）。**ここは decider の判断を仰ぐ**。
- **Bad**: XML Name の Unicode 範囲を持つ正規表現が 1 つ増える（`util/` に置く想定）。
  読みにくいので、**出典（XML 1.0 の Name production）をコメントで指す**必要がある。
- **Neutral**: Option マスタ（`t.option` の `P_Alias`）は**スカラのテキスト**として読まれるので、
  タグ名由来という上記の保証が効かない**唯一の供給経路**になる。
  PORTERS がそこに XML Name 外の文字を入れる可能性は残る → **LV を 1 件足す**
  （下の「信じている入力」の最終行）。
- **Neutral**: 回帰試験の置き場所が決まる。`encode.test.ts` は PCDATA のエスケープを 3 件
  試験しているが、**タグ名側の敵対的入力が 1 件も無い**（[RV-48][rv48] の検出経緯）。
  同じ厚さで足す。

## 信じている入力

Option の alias は**3 つの出どころ**から来る。支配的な故障は
「**テナントが作った正規の alias を、不正と読んで弾く**」（案B / 案C を退けた理由）と、
「**外部入力を正規の alias と読んで要素名にする**」（現状の欠陥）の 2 つ。

| 値                              | 出どころ                           | 誰が書けるか                     | 守り方                                                  | 取れなかったら                                              | 誤っていたら                                                       |
| ------------------------------- | ---------------------------------- | -------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Option の末端 alias（リテラル） | 利用者のコード                     | 開発者のみ                       | **仕組み**: XML Name 検証（本 ADR）                     | —（省略は `null`／`undefined`＝項目を送らない・現状どおり） | PORTERS が Result Code で拒否（存在しない alias は弾けない・後述） |
| Option の末端 alias（実行時）   | HTTP ボディ / CSV / MCP ツール引数 | **第三者が書ける**               | **仕組み**: 同上。これが本 ADR の主目的                 | 同上                                                        | 同上                                                               |
| Option の末端 alias（読み戻し） | PORTERS の Read 応答               | テナント管理者（選択肢を作る人） | **仕組み**: タグ名由来なので XML Name（`decodeOption`） | 応答に無ければ値は `null`（項目が空と区別できない・既知）   | 検証は通る＝round-trip は壊れない（本 ADR の根拠）                 |
| Option の末端 alias（マスタ）   | `t.option` の `P_Alias`            | テナント管理者                   | **散文のみ**: スカラ読みなので XML Name の保証が無い    | `null`                                                      | **突き合わせ先が無い** → **LV を足して契約後に実測する**           |

- **「存在しない alias」は本 ADR では弾けない。** XML Name 検証が保証するのは
  「**要素名として書ける形をしている**」ことだけで、その選択肢がテナントに実在するかは別物
  （テンプレートが言う「形式の検証と、事実との突き合わせは別物」）。
  実在の突き合わせは Option マスタと照らす話で、[ADR-0069][adr69]（宣言とテナントの突合）と
  同じ性質＝**本 ADR の範囲外**。実在しない alias は PORTERS が Result Code で拒否する。
- 最終行は**プロンプト頼みではなく「未確認」**である点に注意。`P_Alias` がスカラで読まれる以上、
  ライブラリ側に保証は無い。**LV-26（仮）「Option マスタの `P_Alias` は XML Name の範囲に収まるか」**
  を [live-verification][lv] に足し、コード側に `VERIFY(live)` を置く
  （[RV-50][rv50] の指摘どおり、番号を書く）。

## Pros and Cons of the Options

### 案A: XML Name として検証

- Good: round-trip を壊さない（読み取り値はタグ名由来）。実測で `Option.P_東京` も通る。
- Good: 検証の根拠が **XML の仕様**＝ PORTERS の未確定事項に依存しない。[LV-1][lv] の結論を待たずに入れられる。
- Good: 注入に必要な文字はすべて範囲外なので、穴は確実に閉じる。
- Bad: Unicode 範囲の正規表現が読みにくい。出典コメントが必須。
- Bad: 「実在しない alias」は通す（＝これは検証の役割ではない・上記）。

### 案B: ASCII 識別子の allowlist

- Good: 正規表現が短く読みやすい。
- Bad: **`Option.P_東京` のような正規の alias を弾く**。テナント管理者が選択肢を作る以上、
  ASCII に限る根拠が出典に無い。弾かれるのは攻撃ではなく正規の書き込みで、回避手段が無い。
- Bad: round-trip が壊れうる（読めた値が書き戻せない）＝ [ADR-0017][adr17] の対称性に反する。

### 案C: `Option.` ＋ `P_` の狭い pattern

- Good: 出典の実例に完全一致。誤った値をほぼすべて弾く。
- Bad: **[LV-1][lv]（接頭辞が未確定）を確定事項として扱う**。旧 fixture は接頭辞なしで、
  どちらが正かまだ分かっていない。未確定を型に焼くと、外れたときに全書き込みが止まる。
- Bad: テナント作成の選択肢の命名規則まで縛る。出典に根拠が無い。

### 案D: エスケープする

- Good: 挙動変更にならない（弾かない）。
- Bad: **技術的に不可能。** 要素名に実体参照は書けず、`&lt;` は要素名として不正。
  「エスケープすれば済む」は最初に浮かぶ案なので、**棄却の記録として残す**価値がある。

### 案E: ブランド型で型で塞ぐ

- Good: 実行時検証が不要になる。保証が型に載る（このリポジトリの好む形）。
- Bad: **リテラルが書けなくなる**（`["Option.P_SE"]` が非コンパイル）。
  ドキュメントの例・ガイド・README が全滅する。
- Bad: 破壊的変更として大きい。実行時検証 1 箇所で同じ穴が閉じる以上、投資に見合わない。
- Neutral: 「ブランド」自体は既に使っている手（`DefinedFields` の phantom brand・[ADR-0023][adr23]）。
  手法が新しいわけではなく、**適用先が重すぎる**という判断。

### 論点2 (i) Option だけ / (ii) 値が要素名になる境界すべて

- (i) Good: 変更が小さい。(i) Bad: item キー経路が同じ指摘で二度目に挙がる。
- (ii) Good: 原因が同一なので 1 箇所で閉じる。(ii) Bad: `create({...recordFromRead})` のような
  正当な組み立てで、**読み取り専用の項目キー**まで検証を通る（通るだけで弾かれはしない）。

## More Information

- 指摘の本体: [RV-48][rv48]（入力と出力つきの実測、`XMLValidator` での well-formed 確認）
- 起票した run: [2026-09-18-01][run]
- エラーの型と category: [ADR-0006][adr6] ／ 送信前ガードの例外契約: [ADR-0046][adr46]
- Option の読み書き対称性: [ADR-0017][adr17] ／ 正典への接地方針: [ADR-0002][adr2]
- 出典: [write-format][wf]（Option の wire 形）／ [LV-1][lv]（末端 alias の接頭辞・未確定）
- フォローアップ: accept 後に (1) 実装 ＋ 回帰試験、(2) LV-26（仮）の起票、
  (3) 書き込みガイドに「alias の形」の 1 行。いずれも**別 PR**。

[adr2]: 0002-ground-design-in-live-api-docs.md
[adr6]: 0006-error-model.md
[adr17]: 0017-option-read-shape.md
[adr23]: 0023-custom-field-declaration-dsl.md
[adr46]: 0046-guard-error-contract.md
[adr48]: 0048-access-point-host-validation.md
[adr69]: 0069-tenant-field-catalog-tooling.md
[claude]: ../../CLAUDE.md
[lv]: ../live-verification.md
[run]: ../reviews/2026-09-18-01.md
[rv48]: ../reviews/rv/0048-option-alias-xml-injection.md
[rv50]: ../reviews/rv/0050-live-verification-traceability-broken.md
[wf]: ../usage/reference/resource-api/write-format.md
