# RV-20 🟡 HTTP 200 ＋ 非 PORTERS ボディが「空ページ」として通る

- 重要度: 🟡 ／ 観点: フェイルセーフ / API 忠実性
- 状態: fixed

## 概要

`parseResourcePage` は**任意の XML/HTML を受け取っても throw しない**。ルート要素が何であれ
`asRecord` を通れば body 扱いになり、`<Code>` が無ければ `toInt` が 0（＝成功）を返すため、
`total: 0 / items: []` の**正常な空ページ**として返る。[ADR-0044][adr44] で「200 以外なら値を返さない」ようにしたので
プロキシの 5xx は塞がったが、**HTTP 200 を返す中間装置**（キャプティブポータル、SSO のログイン画面、
200 で通知ページを返す WAF）では今も「0 件」に見える。**データが無いのか届いていないのかを利用者が区別できない**

## 根拠

`src/xml/parser.ts:48-74`（`rootKey` があれば body 扱い・`<Code>` 不在は 0）/
`src/xml/parser.test.ts`（「defaults missing attributes and Code to 0」が現在の寛容さを固定している）/
reference は「成功は **HTTP 200 かつ `<Code>0`**」＝ `<Code>` の存在は成功の要件

## 検出経緯

[ADR-0044][adr44] の実装中（PR #143）。「非 2xx で parse に成功しても値を返さない」判断の根拠を
確認していて、200 側には同じ穴が残ると分かった

## 推奨

いずれか — (a) **ルート要素名を検証**する（期待するリソース名か `Authentication` か）、
(b) **`<Code>` の不在を「envelope ではない」と見なす**（reference の「200 かつ `<Code>0`」に接地）。
**挙動変更＝要 ADR**
**訂正（ADR 起票時 2026-08-13）**: 「(b) は fixture・テストの寛容な既定を変えるため影響が広い」は誤り。
実測では**現行の Read リテラルは fixture・単体テスト・フェイクサーバー・README の mock 例まで全件が
`<Code>0` を含んでおり**、(b) で書き換えが要るのは `src/xml/parser.test.ts:84` の 1 件だけ。
影響が広いのはむしろ (a)（`parseResourcePage` のシグネチャ＋呼び出し 3 箇所＋未確認のルート名）

## 処置

[ADR-0051][adr51] を **accepted**（**案D**＝ルート要素名 ＋ `<Code>` の存在を Read の同定条件にする・
decider 2026-08-13）。5 案（A: ルート名検証／B: `<Code>` 存在／C: 構造マーカー／D: A+B／E: 現状維持）を比較し、
7 種のボディを現行コードに通した実測で**案A / 案B にはそれぞれ「通る」ケースが残る**ことを確認して案D に決定。
起票時に案A / 案D を退けた理由（「ルート名は未確認」）は誤りで、**取得済み原記事の Read 記事 17 本すべてが
応答のルート要素を実例付きで示し、全件がリソース名と一致**（Attachment・Option を含む）。
リソース名は Write リクエストのルートとして既に wire に載っており**新しい仮定は増えない**（LV 追加も不要）。
**穴は Read だけ**（Write は `<Item>` 0 件で throw・認証は `root.Authentication` 名指しで免疫）。
**実装完了**（2026-08-14）: `parseResourcePage(xml, resource)` が同定 2 条件を持ち、`runRead` ＋ 呼び出し 6 箇所で
期待名を渡す。失敗は 3 種（読めない／ルート不一致／`<Code>` 不在）に分かれ、後 2 者は中間装置を疑う hint 付き。
ADR の見積り（書き換えは 1 テスト）に対し、**実際にはテスト側の甘い canned body が 6 件見つかって直した**
——`client.test.ts` が全アクセサに `<Candidate>` / `<R>` を返していた分と、Write 応答を Read パーサで
読んでいた `fake-transport.test.ts` の helper。**いずれも本 finding が狙った「同定していない」実例**だった

[adr44]: ../../adr/0044-http-status-handling.md
[adr51]: ../../adr/0051-read-envelope-identification.md
