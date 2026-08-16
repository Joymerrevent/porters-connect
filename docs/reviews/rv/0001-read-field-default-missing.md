# RV-1 🔴 field 省略時の Read が主キーしか返さない

- 重要度: 🔴 ／ 観点: API 忠実性
- 状態: fixed

## 概要

`get()` と、`field` を省略した `search()` / `searchAll()` が、本番では `{Resource}.P_Id` **だけ**を返す。
型は全項目を約束しているのに実際には主キーしか入っていないため、`one?.P_Name` は常に `undefined` になる。

## 根拠

- 正典（`tmp/porters-docs/txt/115010010367-…緩和措置あり.md`）: **2015-07-01 以降に発行された App ID**
  （＝現行はすべてこれ）では、Read で `field` 未指定なら `{Resource}.P_Id` **のみ**返る。
  全項目が返る緩和措置は**旧 App 限定**。
- `src/resources/resource.ts:142` — `buildReadUrl` は `field` が空なら**そもそも送らない**。
- `src/resources/resource.ts:228` — `get(id)` には `field` を渡す手段が無い。
- 実測ではないが帰結は明白: `porters.candidate.get(10001)` は `{ P_Id }` だけを返し、
  **README クイックスタート（`README.md:62-63`）が実機で成立しない**。

## 影響

**実用ブロッカー級**。基本的な read が「空」に見えるため、このライブラリの第一価値である
**型付きレコード**が**既定経路で**崩れる。利用者は型に従って書いたコードが動かない理由を
自力で突き止めることになり、しかも原因は PORTERS 側の既定挙動なのでコードを読んでも分からない。
`ReadRecord` が全項目 optional + nullable で「field 選択モデル」を型として正確に表現している
（[ADR-0005][adr5] SD-3）ぶん、既定 field を送らないと型と実挙動の乖離が最大化する。

## 検出経緯

初回クロスレビュー（[2026-06-17-01][run1] Run 1・HEAD `afa1882`）。正典の「緩和措置あり」記事を
`buildReadUrl` の実装と突き合わせて判明した。

## 推奨

[ADR-0019][adr19] でカタログが single source of truth になったので、**`field` 省略時はカタログ全 `P_` alias を
既定送信**する（`get` も内部で全 field を要求）。API 本来の「主キーのみ」も残すなら opt-in の形が要る。
既定挙動を変える重い仕様なので **ADR 化を推奨**。

## 処置

[ADR-0020][adr20] を **accepted**（案A ＋ 2a ＋ 3a ＋ 軸4・透明化）ののち実装。
`search` / `searchAll` / `get` が `field` 省略時に**カタログ導出の既定 field** を送る。
User 型は 4 サブ項目に展開、System[Reference] は ID のみ。`field: []` で
API 本来の「主キーのみ」にオプトアウトできる（透明化）。README / JSDoc に 3 系統を明記した。

## 検証

- `src/resources/resource.ts:127-132` の `defaultFieldList` がカタログから既定 field を生成し、
  **User 型は 4 サブ項目を入れ子展開・System[Reference] は `()` 省略で ID のみ**＝
  `src/xml/decode.ts` の `decodeUser` / `decodeReference` と **1:1** で対応する。
- `search` は `field: query.field ?? defaultFields`（`:229`）で
  **省略＝既定送信 ／ `[]`＝主キーのみ（`buildReadUrl:172`）／ 明示＝verbatim** の 3 系統。
  `get` も内部 `search` 経由で既定 field を得る。
- Attachment は bespoke で `DEFAULT_FIELDS`（メタデータのみ・`Content` 除外）。
  Read クエリは `URLSearchParams` で URL エンコードされる。
- これで `one?.P_Name`（`README.md:63`）が実機で成立する（[2026-06-17-01][run1] Run 2 で確認）。
- **構造的な再発防止**: [ADR-0043][adr43] のフェイクサーバーは「要求された field だけ返す」ため、
  既定 field を送らなければ `P_Id` しか返らないという**本番挙動がテストで再現される**
  （[2026-08-09-01][run809]）。同じ罠は二度と静かには通らない。

[adr5]: ../../adr/0005-public-api-shape.md
[adr19]: ../../adr/0019-static-resource-types.md
[adr20]: ../../adr/0020-read-field-default.md
[adr43]: ../../adr/0043-local-fake-server.md
[run1]: ../2026-06-17-01.md
[run809]: ../2026-08-09-01.md
