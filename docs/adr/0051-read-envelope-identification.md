# 51. Read 応答が PORTERS の envelope であることを同定する（HTTP 200 の穴）

- Status: accepted
- Date: 2026-08-13
- Deciders: jun.shiromoto (Joymerrevent)
- Implemented: 0.8.0

> [findings][findings] **RV-20** の是正案。[ADR-0044][adr44] は「**HTTP 200 以外**」を塞いだが、
> **HTTP 200 を返す中間装置**（キャプティブポータル・SSO のログイン画面・200 で通知ページを返す WAF）の
> ボディは、今も**正常な「0 件」として通る**。**どの条件を満たしたら「PORTERS の応答」と見なすか**を決める。
> **decider が案D を選択し `accepted`（2026-08-13）**。実装は accept 後・別 PR。

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
  **同定条件は仕様に書いてあるものだけ**にする。
- **既に依存している仮定に揃える**: 新しい賭けを増やさない。リソース名（`ResourceDescriptor.name`）は
  **Write リクエストのルート要素として既に wire に載っている**——ここで使っても仮定は増えない。
- **既存を壊さない**: 現行のテスト・fixture・フェイクサーバー、そして**公開 API の `createMockTransport`**
  （[ADR-0024][adr24]）で利用者が手書きするボディ。

## Considered Options

- **案A: ルート要素名を検証する**
  期待名（`ResourceDescriptor.name`＝「Root element + Write resource name」`src/resources/resource.ts:73`）を
  `parseResourcePage` に渡し、一致しなければ throw。
- **案B: `<Code>` の存在を envelope の要件にする（Read のみ）**
  reference の「成功は 200 **かつ** `<Code>0`」に接地。`<Code>` が無いボディは **PORTERS の応答ではない**と見なす。
- **案C: envelope マーカー（`<Code>` か `Total`/`Count`/`Start` 属性のいずれか）を要求する**
  名前に依存せず、「封筒らしさ」を構造で判定する。
- **案D: 案A ＋ 案B**（ルート名が期待どおり **かつ** `<Code>` がある）（**採用**）
  reference の成功形に完全一致させる。
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

採用: **案D（ルート要素名 ＋ `<Code>` の存在）**。decider が 2026-08-13 に選択。

理由: **reference の成功形は「ルートが `<{Resource}>` で、その直下に `<Code>` がある」**という 2 つの事実で
できている。片方だけを見る案A / 案B は、**実測表に「通る」列が残る**——つまり
「塞いだつもりで塞げていない範囲」を仕様として抱えることになる。両方を見れば実測したケースはすべて落ちる。

**ルート要素名は仮定ではなく documented な事実である**。起票時は「reference の総称形 `<{Resource}>` しか
根拠が無い」と見立てていたが、これは要約版の `docs/reference/` だけを見た誤りだった。
**取得済みの原記事（[ADR-0002][adr2] の接地元）を全数確認したところ、Read 記事 17 本すべてが
応答のルート要素を実例付きで示しており、全件がリソース名と一致する**:

| 記事（`tmp/porters-docs/txt/`）                                                                            | 応答のルート                                                                    |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Candidate-Read / Job-Read / Client-Read / Process-Read / Resume-Read                                       | `<Candidate>` `<Job>` `<Client>` `<Process>` `<Resume>`（＋ Total/Count/Start） |
| Contact-Read / Contract-Read / Activity-Read / Sales-Read / Phase-Read / Recruiter-Read / Opportunity-Read | 各リソース名（＋ Total/Count/Start）                                            |
| Partition-Read / User-Read / Field-Read                                                                    | `<Partition>` `<User>` `<Field>`（＋ Total/Count/Start）                        |
| **Option-Read**                                                                                            | **`<Option>`**（属性なし＝[ADR-0022][adr22] 事実5 と整合）                      |
| **Attachment-Read**                                                                                        | **`<Attachment Total="1" Count="1" Start="0">`**                                |

とくに、起票時に「未確認だから賭けになる」と挙げた **Attachment と Option がまさに実例付きで documented**
だった。さらにリソース名は **Write リクエストのルート要素として既に毎回 wire に載っている**
（`buildWriteXml` の `resource: config.name`）＝**ここで使っても新しい仮定は増えない**。
したがって「未確認の仮定に全 Read を賭ける」という案A / 案D への反論は成立しない。
他の wire 仮定（field alias・URL パス）と同格であり、**[live-verification][lv] への新エントリも不要**。

**実装時に守ること**（accept 時の合意事項）:

1. **判定順は「同定 → 値」**。`parseResourcePage` は
   (1) XML として読めるか → (2) **ルート要素名が期待名と一致するか** → (3) **`<Code>` があるか** →
   (4) `<Code>` の値（既存の `resourceError` 写像）の順に見る。
   **同定を値より先に置く**のは、応答が自分宛だと確かめられないうちは**その `<Code>` も自分のものではない**ため
   （[ADR-0044][adr44] の「情報量の多い順」は status と envelope の話で、ここは同じ envelope 内の順序）。
2. **比較は厳密一致**。XML は大文字小文字を区別し、記事の実例も一貫しているので**小文字化などの正規化はしない**。
3. **失敗は 3 種に切り分ける**（メッセージを分ける＝本 ADR の目的そのもの）:
   - XML として読めない → 既存の `unparseable resource response` のまま
   - **ルート不一致** → 観測したルート名と期待名の**両方をメッセージに載せる**
     （例 `resource response root is <Job>, expected <Candidate>`）
   - **`<Code>` 不在** → `<Code>` が無いことを名指しする
     （例 `resource response has no <Code> (not a PORTERS envelope)`）
4. **検査するのは `<Code>` の存在であって値ではない**。`body.Code` が `undefined` のときだけ throw する。
   `<Code/>`（空要素）は fast-xml-parser が `""` を返す＝**存在扱い**で、従来どおり `toInt("") === 0`＝成功。
5. **`PortersResourceError` / `category: "unknown"` / `code: null` / `retryable: false`**。
   PORTERS が答えていない以上、コードは無い（[ADR-0006][adr6]）。**新しい category は作らない**。
   `context.resource` には**期待した**リソース名を入れる（どの呼び出しが失敗したかが分かる）。
6. **hint を必ず付ける**（英語。`CLAUDE.md` の公開サーフェス規約）。
   中間装置（プロキシ／キャプティブポータル／SSO ログイン画面）と `PORTERS_HOST`・経路の確認を促す。
7. **`<Authentication>` への委譲はしない**。[findings][findings] RV-20 の原案 (a) は
   「期待するリソース名か `Authentication` か」を挙げていたが、**リソース経路で認証封筒が返る documented ケースは無い**
   （認証エラーは `<{Resource}><Code>401</Code>` で返る。`test/fixtures/errors/resource-401.xml`・
   [Authentication and Authorization Error][ref-auth-err] 記事が「Resource API の Result Code とは別体系」と明記）。
   投機的な分岐は薄さに反する。**観測したルート名がメッセージに載る**ので、
   万一起きても利用者は原因（認証封筒が返っている）を読み取れる——診断能力を失わない。
8. **`httpStatus` の配線は不要**。2xx で parse が投げた `PortersError` には
   `readResponse` が status を添える（`src/http/read-response.ts:37`）ので、`httpStatus: 200` が自動的に載る。
9. **配線**: `parseResourcePage` が期待名を受け取る。`runRead`（`src/resources/read-core.ts:95`）に 1 引数足し、
   その 4 呼び出し（`resource.ts:231` / `user.ts:88` / `field.ts:108` / `partition.ts:79`）と、
   直接呼ぶ 2 箇所（`attachment.ts:173` は `"Attachment"`・`option.ts:95` は `OPTION_DESCRIPTOR.name`）で渡す。
   名前はすべて descriptor かリテラルで手元にある。
10. **Write / 認証は触らない**。Write 応答のルート名検証は**本 ADR の範囲外**
    （沈黙しない＝実害の性質が違う。対称性のために足すなら別 ADR で。`firstWriteResultId` と
    `runBulkWrite` は既に `name` を持っているので、やるなら安価）。
11. **テスト**: `src/xml/parser.test.ts:84`「defaults missing attributes and Code to 0」は
    **`<Code>0` を付けた形に直して属性既定 0 の pin を残す**（この 1 件が現在の寛容さを固定している唯一のテスト）。
    そのうえで**上の実測表の全行を pin する**——HTML・`<Authentication>` 混入・別リソース envelope・`<Code>` 欠落を
    明示的に置き、「200 でも 0 件にはしない」ことが読み取れるようにする。
12. **ドキュメント**: [エラーハンドリング ガイド][guide]に「**0 件と『届いていない』の区別**」を追記。
    [resource-api/README][ref-resource] の「Read レスポンス XML」に**ルート要素はリソース名である**ことを
    事実として明記する（全 Read 記事で確認済み＝実装が依存する事実を正典に残す）。
    CHANGELOG には**公開 `createMockTransport` の手書きボディに正しいルート名と `<Code>` が要る**ことを明記する。

**既存への影響**（実測。案D で**書き換えが要るのは 1 テストだけ**）:

| 対象                                                                                                                                     | ルート名     | `<Code>`         | 影響       |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------- | ---------- |
| fixture（`test/fixtures/candidate/read-*.xml`・`errors/resource-*.xml`）                                                                 | 一致         | あり             | なし       |
| 単体テストの Read リテラル（resource `<Widget>` / candidate / attachment / option / user / field / partition / client / mock-transport） | **全件一致** | **全件あり**     | なし       |
| フェイクサーバー（`descriptor.name` から組み立て・`test/fake/wire.ts:249` が常に `<Code>0`）                                             | 一致         | あり             | なし       |
| README の `createMockTransport` 例（`README.md:109`）                                                                                    | 一致         | あり             | なし       |
| `src/xml/parser.test.ts:84`                                                                                                              | 一致         | **意図的に無し** | **要更新** |

**semver**: **minor**（[ADR-0044][adr44] / [ADR-0050][adr50] と同じ理由——観測可能な挙動が変わる）。
「今まで 0 件が返っていた入力が例外になる」が、それは**壊れた応答を正常と誤読していた不具合の是正**であり、
**正しい PORTERS 応答に対する挙動は 1 つも変わらない**。

### Consequences

- Good: **「データが無い」と「届いていない」が区別できる**。0 件を信じて分岐する利用側のコード
  （無ければ作る／差分なしと記録する）が、**誤った前提のまま進まない**。
- Good: **実測したケースがすべて落ちる**。案A / 案B に残る「通る」列が無い。
- Good: **失敗が 3 種に切り分かる**（読めない／宛先違い／封筒でない）。とくにルート不一致は
  **観測値をメッセージに載せる**ので、中間装置が何を返しているかがそのまま分かる。
- Good: 追加の依存も、HTML 判定のような**推測**も要らない。判定は名前比較と存在検査だけ。
- Bad: **同定条件が 2 つになる**。どちらで落ちたかはメッセージで分かるが、
  「PORTERS 応答として認められる形」の定義が 1 文では済まなくなる。
- Bad: **`parseResourcePage` のシグネチャが変わり、6 箇所の配線が要る**（案B なら 0 箇所）。
  期待名の SoT が `ResourceDescriptor.name` とリテラル `"Attachment"` に分かれている点も引き継ぐ。
- Bad: **手書きモックの要求が上がる**（正しいルート名 ＋ `<Code>`）。公開 API の `createMockTransport` を
  使う利用者のテストコードには手が届かないので、CHANGELOG とガイドで伝えるほかない。
- Neutral: Write / 認証の同定条件は**非対称のまま**残る（Read は名前＋`<Code>`、認証は名前、Write は無し）。
  reference の形がそもそも非対称なので**忠実ではある**が、「なぜ Write は違うのか」は
  コメントで説明する責任が生まれる。

## Pros and Cons of the Options

### 案A: ルート要素名を検証する

- Good: **cross-resource の取り違えまで塞げる**。同定の意味としては最も直接的（「何の応答か」を名前で確かめる）。
- Good: 期待名は既に `ResourceDescriptor.name` にあり、フェイクサーバーも同じ値から XML を組んでいる
  （`test/fake/fake-transport.ts:192` ほか）＝**リポジトリ内では SoT が 1 つ**。
- Bad: **`<Code>` の欠落は通してしまう**——RV-20 の見出しそのもの（中間装置）を塞ぎきれない組み合わせが残る。
- Bad: シグネチャ変更＋呼び出し 6 箇所の配線が要る。

### 案B: `<Code>` の存在を envelope の要件にする（Read のみ）

- Good: 差分最小（配線ゼロ）・機構 1 本・説明が一文。
- Good: **全 Read 形に共通するマーカー**（Option には Total/Count/Start が無い）。
- Bad: **別リソースの正規 envelope は通る**。「塞いだつもりで塞げていない範囲」が残る。
- Bad: 起票時は「ルート名は未確認だから案B が安全」と評価したが、**その前提が誤りだった**
  （Read 記事 17 本すべてに実例がある）。安全側に倒す理由が消えた。

### 案C: envelope マーカー（`<Code>` か Total/Count/Start 属性のいずれか）

- Good: 名前に依存せず、案B が塞ぐものはすべて塞ぐ。
- Bad: **OR を抱える＝列挙に戻る**。Option に属性が無いため OR を外せない。
- Bad: 案B より緩いのに複雑。**得るものが無い**（属性だけあって `<Code>` が無い PORTERS 応答は
  reference に存在しない）。

### 案D: 案A ＋ 案B（採用）

- Good: reference の成功形に**完全一致**。実測表のすべてを弾ける。
- Good: 2 つの条件が**独立に効く**——偶然どちらか片方を満たすボディが来ても、もう一方で落ちる。
- Good: 失敗の切り分けが 3 種になり、**エラーメッセージが原因を名指しできる**。
- Bad: 同定条件が 2 つ・配線 6 箇所・手書きモックの要求が上がる（上記 Consequences）。
- Bad: 将来 PORTERS がルート要素名を変えたら**そのリソースの Read が全面的に止まる**。
  ただし失敗は**静かではなく**、メッセージに観測値が載るので原因は即座に分かる（＝安全側の壊れ方）。

### 案E: 現状維持

- Good: 変更ゼロ。手書きモックも壊れない。
- Bad: **RV-20 が open のまま残る**。「0 件」の意味が定まらず、
  利用者は**ライブラリの外側で**（件数 0 を疑うコードを書いて）自衛するほかない。
- Bad: フェイルセーフの向きに反する。**沈黙する失敗**を仕様として抱え続けることになる。

## More Information

- 出典: [findings][findings] **RV-20**（検出経緯＝[ADR-0044][adr44] 実装中・PR #143）。
  本 ADR の実測値は現行 `src/xml/parser.ts` に各ボディを直接渡して採取した。
  ルート要素の全数確認は取得済み原記事（`tmp/porters-docs/txt/*-Read.md` 17 本）による。
- 影響範囲（実装 PR）: `src/xml/parser.ts`（同定 2 条件）・`src/resources/read-core.ts`（`runRead` の引数）・
  `src/resources/{resource,user,field,partition,attachment,option}.ts`（期待名の受け渡し）・
  `src/xml/parser.test.ts`（`:84` の差し替え＋実測表の pin）・
  [resource-api/README][ref-resource]（ルート要素の事実）・[エラーハンドリング ガイド][guide]・CHANGELOG。
- 見送った範囲（必要になったら別 ADR）: **Write 応答のルート名検証**（沈黙しないため優先度が低い）／
  **`<Authentication>` の委譲**（documented ケースが無い）。
- 関連: [ADR-0044][adr44]（HTTP 200 **以外**を塞いだ決定＝本 ADR はその対称形）／
  [ADR-0045][adr45]（Write ルート `<Code>` の先読み）／[ADR-0011][adr11]（XML パースの内部）／
  [ADR-0006][adr6]（エラーモデル・category）／[ADR-0024][adr24]（公開 mock transport）／
  [ADR-0022][adr22]（マスタ Read の封筒の形・事実5）／[ADR-0002][adr2]（実記事への接地）。

[findings]: ../reviews/findings.md
[guide]: ../guide/error-handling.md
[lv]: ../live-verification.md
[ref-resource]: ../reference/resource-api/README.md
[ref-write]: ../reference/resource-api/write-format.md
[ref-auth-err]: ../reference/authentication-api/errors.md
[adr2]: 0002-ground-design-in-live-api-docs.md
[adr6]: 0006-error-model.md
[adr11]: 0011-xml-parse-serialize.md
[adr22]: 0022-master-read-query-surface.md
[adr24]: 0024-mock-transport.md
[adr44]: 0044-http-status-handling.md
[adr45]: 0045-write-response-root-code.md
[adr49]: 0049-host-port-roundtrip.md
[adr50]: 0050-auth-http-status-handling.md
