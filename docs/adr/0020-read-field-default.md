# 20. Read の field 既定挙動（省略時はカタログ導出の既定 field を送る）

- Status: accepted
- Date: 2026-06-17
- Deciders: jun.shiromoto (Joymerrevent)

> 議論の結果 **案A（カタログ導出の既定 field）＋案2a（User/Reference の入れ子展開）＋案3a（`field: []`
> で主キーのみにオプトアウト）＋軸4（`U_`/`A_` は既定対象外）** で accepted（2026-06-17）。
> **透明化**：既定で全項目を送ることを README/JSDoc に明記し、API ネイティブの「ID のみ」は `field: []`
> で到達可能に残す（薄いラッパーの fidelity を保つ）。コードへの反映は本 ADR を受けて別 PR で行う。
> 検出元はレビュー指摘 [RV-1][findings]。

## Context and Problem Statement

PORTERS の Read 系 API は、**`field` パラメータを省略すると `{Resource}.P_Id` のみ**を返す
（2015-07-01 以降に発行された App ID＝現行すべてが対象。旧 App 向けの「全項目返却」は緩和措置で、終了予定）。
出典: [docs/reference Read パラメータ][ref-read] / 原典 [115010010367][src-mitigation]。

しかし現状の実装は `field` 省略時に既定値を送っていない:

- `buildReadUrl`（`src/resources/resource.ts`）は `q.field` が空なら `field` を URL に付けない。
- `get(id)` は `field` を受け取る引数自体が無い。

結果、`porters.candidate.get(10001)` も field 無し `search()` も**本番では `P_Id` だけ**のレコードを返す。
[ADR-0005][0005]/[ADR-0019][0019] が約束する SD-3「簡易」型（既知項目を持つ `Candidate`）と実行時が食い違い、
`one?.P_Name` が常に `undefined` になる。README のクイックスタート例も実機では成立しない。

問い: **Read で `field` を省略したとき、ライブラリは何を送るべきか**。送るなら**既定 field をどう導出**し、
**User / System[Reference] の入れ子**をどう表現し、**「主キーだけ欲しい」用途**（件数取得など）にどう逃げ道を残すか。

## Decision Drivers

- **フェイルセーフ / least surprise**: 既定経路で「空に見えるレコード」を返さない。型が「項目がある」と言うなら実行時もそうあるべき。
- **single source of truth**: [ADR-0019][0019] で確立した `as const` カタログを、既定 field の生成にも使ってズレを作らない。
- **API 忠実性**: PORTERS の field 選択意味論（入れ子・User は 4 サブ項目のみ・参照は ID）に正しく従う（[ref-read][ref-read]）。
- **薄いラッパー fidelity vs typed-record の約束**: 第1層は薄く（[CLAUDE.md][claude]）＝原則 API に合わせる。だが [ADR-0019][0019]/[ADR-0005][0005] で typed record 面（既知項目を持つ型）を選んだ以上、未指定で ID のみ返すと「型は項目ありと言うのに実体は空」＝静かな誤り。生挙動（ID のみ）は `field: []` で到達可能に残し、両立させる。
- **制限との両立**: リクエスト長 ~15000 文字・レート上限（[CLAUDE.md][claude] / [docs/reference][ref-read]）。既定の over-fetch を許容範囲に収める。
- **公開値表現は不変**: 返す値の形（[ADR-0011][0011] の decode 契約：User=`UserRef`・Reference=id・Option=`string[]`）は変えない。
- **後方互換**: 現状の既定（P_Id のみ）に依存した実利用は実質無い（無価値なため）。より有用な既定への変更はリスクが低い。

## Considered Options

### 軸1: `field` 省略時の既定挙動

- **案A: カタログ導出の既定 field を送る** — `search` / `searchAll` / `get` とも、`field` 未指定ならカタログ全項目を既定として送る。
- **案B: 現状維持（送らない）＋ドキュメントで「field 必須」を明示** — 薄いが、型と実行時の乖離（footgun）が残る。
- **案C: `get` だけ全項目を既定／`search`・`searchAll` は呼び出し側指定** — 「1 件取得」は全項目が自然、「検索」は射影をユーザーが選ぶ、という役割分担。

### 軸2: User / System[Reference] 入れ子の既定展開

既定 field は単なる alias 列ではない。PORTERS では参照型は入れ子指定が要る（`Job.P_Client(Client.P_Id,…)`、
`()` 省略で上位 ID のみ）。User 型で参照できるのは `User.P_Id / P_Type / P_Name / P_Mail` の 4 つのみ（[ref-read][ref-read]）。

- **案2a: decode 契約に合わせて展開** — User 型は 4 サブ項目を入れ子展開（`Person.P_Owner(User.P_Id,User.P_Type,User.P_Name,User.P_Mail)`）、
  System[Reference] は `()` 省略で ID のみ。`UserRef` / 参照 id の decode と一致。
- **案2b: スカラのみ既定送信、入れ子型はスキップ** — 実装は単純だが、User/参照項目が既定では `null` になり「簡易」型の約束を満たさない。

### 軸3: 「主キーだけ」用途の逃げ道（件数取得など）

- **案3a: 既定は全項目、`field: []`（明示的空配列）で主キーのみに絞れる** — 既定は有用側、オプトアウトを用意。
- **案3b: 逃げ道は設けず、絞りたい場合は `field` を明示** — 最小実装。count 専用 API は将来。

### 軸4: `U_` / `A_` カスタム項目

カタログは既知 `P_` のみ（[ADR-0019][0019] U1）。よって既定 field にも `U_`/`A_` は含めない（SD-2 `defineFields` の将来作業）。
実行時は従来どおり raw 通過するので、ユーザーが `field` に明示すれば取得・decode（raw string）はできる。

## Decision Outcome

採用: **案A ＋ 案2a ＋ 案3a ＋ 軸4（`U_`/`A_` は既定対象外）**。

- **A**: フェイルセーフと SD-3「簡易」型の約束（既知項目が入る）を実行時で実現する最短路。`get`/`search`/`searchAll` で挙動を揃えると驚きが少ない。
- **2a**: 既定 field を「カタログ → `{prefix}.{alias}`、User は 4 サブ展開、System[Reference] は ID のみ」で生成。[ADR-0011][0011] の decode 形と 1:1 対応。
- **3a ＋ 透明化**: 既定は有用側（全項目）に倒し、`field: []`（明示的空配列）を API ネイティブの「主キーのみ」へのオプトアウトに割り当てる（件数・存在確認用途）。**「既定で全項目を送る」ことは README/JSDoc に明記**し、生挙動を隠さない。`field` 明示は従来どおり射影。
- カタログを既定 field 生成にも使うことで [ADR-0019][0019] の single source of truth を一段広げる。

### Consequences

- Good: `get`/`search` が既定で意味あるレコードを返す。型（全項目 optional+nullable）と実行時が一致。README 例が正しくなる。RV-1 解消。生挙動（ID のみ）は `field: []` で到達可能＝薄いラッパーの fidelity を保つ。
- Bad: 既定の over-fetch（多項目・入れ子展開でリクエストが伸びる／レートに僅かに不利）。`field: []` の意味づけ（空＝主キーのみ）を周知する必要。
  実装は「カタログ→既定 field 文字列（入れ子含む）」生成＋ `get` への field 適用＋ [RV-2][findings]（非現実的 fixture）の是正。
- Neutral: `U_`/`A_` は既定取得対象外（明示すれば取得可、型補助は SD-2 待ち）。リクエスト長超過時は既存の送信前ガードが働く。

## Pros and Cons of the Options

### 軸1

- **案A**: Good=フェイルセーフ・型と実行時の一致・get/search 一貫。Bad=既定 over-fetch。
- **案B**: Good=最も薄い・PORTERS 仕様そのまま。Bad=footgun 継続（型は項目ありと言うのに空が返る）＝フェイルセーフに反する。
- **案C**: Good=「取得 vs 検索」の直感に合う。Bad=メソッド間で既定が割れ、search の footgun が残る。

### 軸2

- **案2a**: Good=decode 契約と一致し UserRef/参照 id が既定で埋まる。Bad=既定 field 生成が型別ロジックを要する。
- **案2b**: Good=生成が単純。Bad=User/参照が既定 null＝「簡易」型の約束未達。

### 軸3

- **案3a**: Good=既定有用＋件数用途に逃げ道。Bad=空配列の特別な意味を学習コストとして要する。
- **案3b**: Good=最小。Bad=件数取得のたびに全項目 field を明示 or over-fetch。

## More Information

- 接地: [docs/reference Read パラメータ（field 入れ子・User 4 項目・既定）][ref-read]、原典 [115010010367][src-mitigation]。
- 検出元: [RV-1 / RV-2（docs/reviews/findings.md）][findings]。
- 依存/関連: [ADR-0005][0005]（公開 API・SD-3）／[ADR-0019][0019]（カタログ SoT）／[ADR-0011][0011]（decode の User/Reference/Option 形）／[ADR-0016][0016]（DataType）。
- 関連実装: `src/resources/resource.ts`（`buildReadUrl` / `search` / `searchAll` / `get` / `SearchQuery`）、各 `src/resources/*.ts` のカタログ、`src/xml/decode.ts`。
- フォローアップ: accept 後に実装 PR（既定 field 生成・`get` の field 対応・RV-2 の fixture/テスト是正）。

[0005]: 0005-public-api-shape.md
[0011]: 0011-xml-parse-serialize.md
[0016]: 0016-field-type-granularity.md
[0019]: 0019-static-resource-types.md
[ref-read]: ../reference/resource-api/README.md
[src-mitigation]: ../../tmp/porters-docs/txt/115010010367-2015-07-01-Read系APIのfieldパラメータがセットされなかった場合の挙動-緩和措置あり.md
[findings]: ../reviews/findings.md
[claude]: ../../CLAUDE.md
