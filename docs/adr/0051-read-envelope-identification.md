# 51. Read 応答が PORTERS の envelope であることを同定する（HTTP 200 の穴）

- Status: proposed
- Date: 2026-08-13
- Deciders: jun.shiromoto (Joymerrevent)

> [findings][findings] **RV-20** の是正案。[ADR-0044][adr44] は「**HTTP 200 以外**」を塞いだが、
> **HTTP 200 を返す中間装置**（キャプティブポータル・SSO のログイン画面・200 で通知ページを返す WAF）の
> ボディは、今も**正常な「0 件」として通る**。**どの条件を満たしたら「PORTERS の応答」と見なすか**を決める。
> 結論（案A〜E のどれか）は decider が選ぶ。

## Context and Problem Statement

`docs/reference` は Resource API の成否を **2 系統**で定義している
（[resource-api/README][ref-resource] `:78`）:

> 成功は **HTTP 200 かつ `<Code>0`**。エラーは **HTTP 200 以外**、または `<Code>` が 0 以外。

[ADR-0044][adr44] で前者の「HTTP 200 以外」は塞がった（`readResponse` が 200 以外では値を返さない）。
残っているのは **「HTTP 200 だが PORTERS の応答ではない」**ケースである。

`parseResourcePage`（`src/xml/parser.ts:48-74`）は **どんな XML を渡されても throw しない**。

1. `parser.parse()` が record を返し、
2. その先頭キー配下も record なら **body として採用**（ルート要素名は**見ていない**）、
3. `<Code>` が無ければ `toInt` が `undefined` を **0（＝成功）** に落とす（`:28-31`）。

結果、`total: 0 / count: 0 / items: []` の**正常な空ページ**が返る。**実測**（現行コードに直接ボディを渡した結果）:

| HTTP 200 のボディ                                               | 現在の Read                                      |
| --------------------------------------------------------------- | ------------------------------------------------ |
| キャプティブポータルの HTML（`<html>…Sign in…</html>`）         | **OK** `total=0 count=0 items=0`                 |
| SSO ログイン画面の HTML（`<form action="/login">`）             | **OK** `total=0 count=0 items=0`                 |
| WAF の通知 XML（`<error><message>Request blocked</message>`）   | **OK** `total=0 count=0 items=0`                 |
| 認証応答の混入（`<Authentication><Error>401</Error>`）          | **OK** `total=0 count=0 items=0`                 |
| 別リソースの応答（`<Job Total="3" …><Code>0</Code>`）           | **OK** `total=3 items=1`（Candidate として読む） |
| `<Candidate>` だが `<Code>` が無い                              | **OK** `total=0 items=1`                         |
| JSON（`{"status":"ok"}`）／空ボディ／空白のみ／プレーンテキスト | THROW `unparseable resource response`            |

**「XML ですらない」ものだけが落ち、「XML の形をした別物」はすべて通る**——ここが穴である。

**なぜ 0 件が危険か**。この誤読は静かに書き込み側へ伝播する:

- `search()` → 0 件、`searchAll()` → 何も yield しない、`get(id)` → **`undefined`**（`src/resources/resource.ts:242-247`）。
- 利用側の定石は「`get` して**無ければ作る**」。つまり**「届いていない」を「存在しない」と誤読した結果、
  重複レコードを作りにいく**。読み取りの静かな失敗が、**書き込みの実害**になる。
- 同期バッチなら「0 件同期＝差分なし」と記録され、**障害が起きたことにすら気づかない**。

**穴は Read だけである**（Write / 認証は該当しない）。根拠:

- **Write**: 成功形にはルート `<Code>` も `Total/Count/Start` も**無い**（[write-format][ref-write] `:29-33`）ので、
  Read と同じ規則は適用できない。ただし現状でも**沈黙しない**——HTML を渡すと `<Item>` が 0 件になり、
  単一 write は `write returned no result item`（`src/resources/resource.ts:147-151`）、
  一括 write は件数不一致（`src/resources/bulk-write.ts:150-157`）で **throw** する（どちらも `unknown`＝理由は的外れだが、静かには通らない）。
- **認証**: `parseAuthentication` は `root.Authentication` を**名指しで**取るため（`src/xml/parser.ts:138`）、
  別物のボディは `unparseable authentication response` になる。[ADR-0050][adr50] `:36` でも確認済み。

問い: **Read 応答を「PORTERS の envelope である」と同定する条件を何にするか。満たさないとき何を投げるか。**

## Decision Drivers

- **フェイルセーフ（誤りの向きが非対称）**: 見逃し（偽物を 0 件として通す）は**静かに書き込み事故へ繋がる**。
  誤検知（本物を弾く）は**その場で止まる**。**止まる方が安全側**であり、両者は等価な失敗ではない。
- **API 忠実性 / 接地**（[ADR-0002][adr2]）: reference が定義する成功形
  （`<{Resource} Total Count Start><Code>0</Code>`）のうち、**実装が実際に確認している条件**を増やす。
- **説明可能性**: 「なぜエラーになったか」を利用者に**一文で**言えること。実装の都合を漏らさない
  （[ADR-0049][adr49] と同じ driver）。
- **薄さ**: HTML 検出・Content-Type 推定・「怪しいボディ」のパターン列挙を抱え込まない。
  **判定機構は 1 本**にする（[ADR-0049][adr49] が機構1＝列挙を退けたのと同じ理由）。
- **未確認への耐性**: 契約前で live 検証ができない（[live-verification][lv]）。
  **仮定が外れたときに「全 Read が落ちる」種類の厳格さは避ける**。ライブラリが使えなくなるのは
  「多くの実利用者に使われること」という最優先目標（`CLAUDE.md`）に反する。
- **既存を壊さない**: 現行のテスト・fixture・フェイクサーバー、そして**公開 API の `createMockTransport`**
  （[ADR-0024][adr24]）で利用者が手書きするボディ。

## Considered Options

- **案A: ルート要素名を検証する**
  期待名（`ResourceDescriptor.name`＝「Root element + Write resource name」`src/resources/resource.ts:73`）を
  `parseResourcePage` に渡し、一致しなければ throw。
- **案B: `<Code>` の存在を envelope の要件にする（Read のみ）**（推奨）
  reference の「成功は 200 **かつ** `<Code>0`」に接地。`<Code>` が無いボディは **PORTERS の応答ではない**と見なす。
- **案C: envelope マーカー（`<Code>` か `Total`/`Count`/`Start` 属性のいずれか）を要求する**
  名前に依存せず、「封筒らしさ」を構造で判定する。
- **案D: 案A ＋ 案B**（ルート名が期待どおり **かつ** `<Code>` がある）
  reference の成功形に完全一致させる最も厳格な案。
- **案E: 現状維持**（[エラーハンドリング ガイド][guide]に「0 件と『届いていない』は区別できない」と注記するだけ）

**各案が何を落とすか**（上の実測表の各行に対して）:

| HTTP 200 のボディ                             | 現状     | 案A      | 案B      | 案C      | 案D   |
| --------------------------------------------- | -------- | -------- | -------- | -------- | ----- |
| HTML（キャプティブポータル / SSO）            | 空ページ | 弾く     | 弾く     | 弾く     | 弾く  |
| WAF の `<error>` 通知                         | 空ページ | 弾く     | 弾く     | 弾く     | 弾く  |
| `<Authentication><Error>401</Error>`          | 空ページ | 弾く     | 弾く     | 弾く     | 弾く  |
| 別リソースの正規 envelope（`<Job …><Code>0`） | 誤読     | 弾く     | **通る** | **通る** | 弾く  |
| `<Candidate>` で `<Code>` 無し                | 空ページ | **通る** | 弾く     | **通る** | 弾く  |
| JSON / 空 / テキスト                          | throw    | throw    | throw    | throw    | throw |

## Decision Outcome

採用: **（未決定・議論用）案B を推奨**。

理由:

1. **reference の明文にそのまま接地する**。「成功は HTTP 200 かつ `<Code>0`」である以上、
   **`<Code>` の存在は成功の要件**であって、既定値 0 で補ってよい任意項目ではない。
   実装は今、**書いてある条件の半分（値）しか見ていない**——本案はもう半分（存在）を見るだけで、
   新しい規則を発明しない。
2. **`<Code>` は全 Read 形に共通する唯一のマーカー**である。Option の封筒には `Total/Count/Start` 属性が
   **無い**（`<Code>` ＋再帰 `<Items>`。[ADR-0022][adr22] 事実5）。属性を条件に含める案C は、
   この「OR」を抱えた時点で**列挙**に戻る。
3. **機構が 1 本で、説明が一文で済む**——「PORTERS の応答には必ず `<Code>` がある。無いものは PORTERS の応答ではない」。
4. **差分が最小**。`parseResourcePage` のシグネチャも 3 つの呼び出し
   （`src/resources/read-core.ts:95`／`src/resources/attachment.ts:173`／`src/resources/option.ts:95`）も
   変えずに済む。Write / 認証には**触らない**。
5. **案A / 案D を今は採らない理由**: ルート要素名の正は
   **reference の総称形 `<{Resource}>` だけ**で、リソース別の記事に実例が無い。
   Attachment（alias prefix を持たない特殊なリソース。[live-verification][lv] LV-3 / LV-4 が未確認）や
   マスタ系で実 API が別名を返した場合、**全 Read が確実に落ちる**。
   これは「静かに壊れる」よりはましだが、**契約前に確かめられない仮定へ全機能を賭ける**ことになる。
   一方 `<Code>` の存在は reference に明記され、**リポジトリ内の全 fixture・テスト・フェイクサーバー・
   README の mock 例が例外なく満たしている**（下記「既存への影響」）＝確認済みの前提に乗れる。
   root 名の検証は **LV-14 で実 API を確認したのちに、本 ADR を superseding する形で段階的に**足せばよい。

**案B を採る場合、実装時に守ること**（accept 時の合意事項）:

1. **判定は `parseResourcePage` にだけ足す**。`parseWriteResult` は成功形にルート `<Code>` が無いので
   同じ規則を適用**しない**。`parseAuthentication` はルート名で既に同定済みなので**触らない**。
2. **検査するのは存在であって値ではない**。`body.Code` が `undefined` のときだけ throw する。
   `<Code/>`（空要素）は fast-xml-parser が `""` を返す＝**存在扱い**で、従来どおり `toInt("") === 0`＝成功。
   値の妥当性（非数値など）は既存の `toInt` → 非 0 → `resourceError` の経路のまま変えない。
3. **メッセージを既存と分ける**。`unparseable resource response`（＝XML として読めない）とは
   **原因が違う**ので別文言にする（例 `resource response is not a PORTERS envelope (no <Code>)`）。
   切り分けができることが本 ADR の目的そのものである。
4. **`PortersResourceError` / `category: "unknown"` / `code: null` / `retryable: false`**。
   PORTERS が答えていない以上、コードは無い（[ADR-0006][adr6]）。**新しい category は作らない**。
5. **hint を必ず付ける**（英語。`CLAUDE.md` の公開サーフェス規約）。
   中間装置（プロキシ／キャプティブポータル／SSO ログイン画面）と `PORTERS_HOST`・経路の確認を促す。
   利用者が自力で切り分けられることが、このエラーの価値。
6. **`httpStatus` の配線は不要**。2xx で parse が投げた `PortersError` には
   `readResponse` が status を添える（`src/http/read-response.ts:37`）ので、`httpStatus: 200` が自動的に載る。
7. **テスト**: `src/xml/parser.test.ts:84`「defaults missing attributes and Code to 0」は
   **`<Code>0` を付けた形に直して属性既定 0 の pin を残す**（この 1 件が現在の寛容さを固定している唯一のテスト）。
   そのうえで**上の実測表の全行を pin する**——とくに HTML・`<Authentication>` 混入・`<Code>` 欠落を明示的に置き、
   「200 でも 0 件にはしない」ことが読み取れるようにする。
8. **ドキュメント**: [エラーハンドリング ガイド][guide]に「**0 件と『届いていない』の区別**」を追記。
   CHANGELOG には**公開 `createMockTransport` の手書きボディに `<Code>` が要る**ことを明記する。

**既存への影響**（実測。案B で**書き換えが要るのは 1 テストだけ**）:

| 対象                                                                                                                          | `<Code>` の有無  | 影響       |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------- |
| fixture（`test/fixtures/candidate/read-*.xml`）                                                                               | あり             | なし       |
| 単体テストの Read リテラル（resource / candidate / attachment / option / user / field / partition / client / mock-transport） | **全件あり**     | なし       |
| フェイクサーバー（`test/fake/wire.ts:249` が常に `<Code>0` を出力）                                                           | あり             | なし       |
| README の `createMockTransport` 例（`README.md:109`）                                                                         | あり             | なし       |
| `src/xml/parser.test.ts:84`                                                                                                   | **意図的に無し** | **要更新** |

**semver**: **minor**（[ADR-0044][adr44] / [ADR-0050][adr50] と同じ理由——観測可能な挙動が変わる）。
「今まで 0 件が返っていた入力が例外になる」が、それは**壊れた応答を正常と誤読していた不具合の是正**であり、
**正しい PORTERS 応答に対する挙動は 1 つも変わらない**。

### Consequences

- Good: **「データが無い」と「届いていない」が区別できる**。0 件を信じて分岐する利用側のコード
  （無ければ作る／差分なしと記録する）が、**誤った前提のまま進まない**。
- Good: 中間装置の混入が **`httpStatus: 200` ＋ hint 付きのエラー**として出るため、**利用者が自力で切り分けられる**。
- Good: 追加の依存も、HTML 判定のような**推測**も要らない。判定は 1 行の存在検査。
- Bad: **`<Code>` を書いていない手書きモックが壊れる**（公開 API の `createMockTransport` を使う利用者）。
  リポジトリ内には該当が 1 件（`parser.test.ts:84`）しか無いが、外部の利用者には CHANGELOG とガイドで伝えるほかない。
- Bad: **別リソースの正規 envelope は素通りする**（`<Job>` を Candidate として読む）。
  URL が正しい限り起きないが、**塞いだつもりで塞げていない範囲**として自覚しておく必要がある。
- Neutral: Write / 認証の同定条件は**非対称のまま**残る（Read は `<Code>`、認証はルート名、Write は無し）。
  reference の形がそもそも非対称なので**忠実ではある**が、「なぜ Write は違うのか」は
  コメントで説明する責任が生まれる。

## Pros and Cons of the Options

### 案A: ルート要素名を検証する

- Good: **cross-resource の取り違えまで塞げる**。同定の意味としては最も直接的（「何の応答か」を名前で確かめる）。
- Good: 期待名は既に `ResourceDescriptor.name` にあり、フェイクサーバーも同じ値から XML を組んでいる
  （`test/fake/fake-transport.ts:192` ほか）＝**リポジトリ内では SoT が 1 つ**。
- Bad: **`<Code>` の欠落は通してしまう**——RV-20 の見出しそのもの（中間装置）を塞ぎきれない組み合わせが残る。
- Bad: **未確認の仮定に全 Read を賭ける**。リソース別 reference にルート要素の実例が無く、
  Attachment / マスタ系で名前が違えば**その resource の Read が全滅**する。
- Bad: `parseResourcePage` のシグネチャ変更＋呼び出し 3 箇所の配線が要る（Attachment だけ descriptor を持たず
  リテラル `"Attachment"` を使っている `src/resources/attachment.ts:203` との整合も要る）。

### 案B: `<Code>` の存在を envelope の要件にする（Read のみ）

- Good: reference の明文（`:78`）に**そのまま**接地。新しい規則を発明しない。
- Good: **全 Read 形に共通する唯一のマーカー**（Option には Total/Count/Start が無い）。
- Good: 差分最小・機構 1 本・説明が一文。既存の全 fixture / テスト / フェイク / README 例が**既に満たしている**。
- Bad: 別リソースの正規 envelope は通る（案A なら弾ける）。
- Bad: 「`<Code>` を書き忘れた手書きモック」が壊れる。ライブラリの外にある利用者のテストコードには手が届かない。

### 案C: envelope マーカー（`<Code>` または Total/Count/Start 属性）

- Good: 名前に依存せず、案B が塞ぐものはすべて塞ぐ。
- Bad: **OR を抱える＝列挙に戻る**。Option に属性が無いため OR を外せず、
  「どちらか一方があればよい」理由を説明しにくい（[ADR-0049][adr49] が案B＝特例を退けたのと同じ性質）。
- Bad: 案B より緩いのに複雑。**得るものが無い**（属性だけあって `<Code>` が無い PORTERS 応答は
  reference に存在しない）。

### 案D: 案A ＋ 案B

- Good: reference の成功形に**完全一致**。実測表のすべてを弾ける。
- Bad: **未確認の仮定（ルート名）を抱えたまま**厳格さだけが上がる。外れたときの被害は案A と同じ＝全 Read 停止。
- Bad: 一度に 2 つの判定を入れると、**利用者側で問題が起きたときにどちらが原因かを切り分けにくい**。
  段階的に足す方が安全（まず案B、LV-14 の確認後に名前を足す）。

### 案E: 現状維持

- Good: 変更ゼロ。手書きモックも壊れない。
- Bad: **RV-20 が open のまま残る**。「0 件」の意味が定まらず、
  利用者は**ライブラリの外側で**（件数 0 を疑うコードを書いて）自衛するほかない。
- Bad: フェイルセーフの向きに反する。**沈黙する失敗**を仕様として抱え続けることになる。

## More Information

- 出典: [findings][findings] **RV-20**（検出経緯＝[ADR-0044][adr44] 実装中・PR #143）。本 ADR の実測値は
  現行 `src/xml/parser.ts` に各ボディを直接渡して採取した。
- 影響範囲（accept 後の実装 PR）: `src/xml/parser.ts`（`parseResourcePage` の存在検査）・
  `src/xml/parser.test.ts`（`:84` の差し替え＋実測表の pin）・
  [エラーハンドリング ガイド][guide]（「0 件と『届いていない』の区別」）・CHANGELOG
  （`createMockTransport` の手書きボディに `<Code>` が要る旨）。**案A / 案D を採る場合はこれに加えて**
  `parseResourcePage` のシグネチャと呼び出し 3 箇所（`read-core.ts:95`／`attachment.ts:173`／`option.ts:95`）。
- フォローアップ: [live-verification][lv] に **LV-14「Read 応答のルート要素名は本当に `<{Resource}>` か」**
  を追加する（Attachment・Option・Field・User・Partition を含む）。確認が取れれば、
  ルート名の検証（案A の要素）を**本 ADR を superseding する形で**足せる。
- 関連: [ADR-0044][adr44]（HTTP 200 **以外**を塞いだ決定＝本 ADR はその対称形）／
  [ADR-0045][adr45]（Write ルート `<Code>` の先読み）／[ADR-0011][adr11]（XML パースの内部）／
  [ADR-0006][adr6]（エラーモデル・category）／[ADR-0024][adr24]（公開 mock transport）／
  [ADR-0022][adr22]（マスタ Read の封筒の形・事実5）。

[findings]: ../reviews/findings.md
[guide]: ../guide/error-handling.md
[lv]: ../live-verification.md
[ref-resource]: ../reference/resource-api/README.md
[ref-write]: ../reference/resource-api/write-format.md
[adr2]: 0002-ground-design-in-live-api-docs.md
[adr6]: 0006-error-model.md
[adr11]: 0011-xml-parse-serialize.md
[adr22]: 0022-master-read-query-surface.md
[adr24]: 0024-mock-transport.md
[adr44]: 0044-http-status-handling.md
[adr45]: 0045-write-response-root-code.md
[adr49]: 0049-host-port-roundtrip.md
[adr50]: 0050-auth-http-status-handling.md
