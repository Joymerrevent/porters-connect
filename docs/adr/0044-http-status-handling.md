# 44. HTTP ステータスをエラーモデルに配線する（非 PORTERS ボディの扱い）

- Status: proposed
- Date: 2026-08-09
- Deciders: jun.shiromoto (Joymerrevent)

> [findings][findings] **RV-13** の是正案。[ADR-0043][adr43] のフェイクサーバー実装中に、
> 「PORTERS 以外が返す HTTP エラー」を通す経路が無いことが判明した。**挙動変更を伴うため実装前に決める**。

## Context and Problem Statement

`docs/reference` は Resource API のエラーを **2 系統**で定義している：
「成功は **HTTP 200 かつ `<Code>0`**。エラーは **HTTP 200 以外**、または `<Code>` が 0 以外」
（[resource-api/README][ref-resource] 該当節）。

しかし実装は後者しか見ていない。`requester` は `transport.send()` の戻り値の **`status` を参照せず**、常に body を parse する
（`src/http/requester.ts:105-106`）。`fetch` 側では status を取得済み（`src/http/fetch-transport.ts:27`）で、
`TransportResponse.status` にも載っているのに、そこで捨てられている。

その結果：

- LB・プロキシ・WAF・メンテナンス画面が返す **非 XML の 4xx/5xx** は `parseResourcePage` の
  「unparseable resource response」に落ち、`category: "unknown"` になる。**リトライしてよいかも判断できない**。
- `PortersError.httpStatus`（[ADR-0006][adr6] で型に用意した）は**常に `undefined`**。
- レート超過は「判別可能なコードを返さず切断」（reference）なので `network` に倒す設計だが、
  もし 429 が返る環境（プロキシ経由など）があっても `unknown` になる。`category: "rateLimit"` は予約のまま
  （[findings][findings] RV-3 の結論）。

問い: **HTTP ステータスをどこまで見て、どの `category` / `retryable` に写像するか。ボディに PORTERS の envelope がある場合、どちらを優先するか。**

## Decision Drivers

- **API 忠実性 / 接地**（[ADR-0002][adr2]）: reference が定義する 2 系統の片方を落とさない。
- **フェイルセーフ**: 「原因不明で落ちた」より「4xx は設定・5xx は一時障害」と分かる方が安全側。リトライ可否が判断できること。
- **エラーモデルの一貫性**（[ADR-0006][adr6]）: 既存 `category` の意味を壊さない。未知は握り潰さず `unknown`。
- **薄いラッパー**: HTTP の全ステータスを網羅した辞書は作らない。PORTERS の運用で実際に起こる範囲に絞る。
- **後方互換**: 既存利用者の `catch` が壊れないこと（型は増えるが、既存の値は変えない）。

## Considered Options

- **案A: status を見て分類し、ボディの envelope を優先する**（推奨）
  200 以外でも、まず body を PORTERS envelope として parse できるか試す。できればそのエラー（`<Code>`）を採用し、
  `httpStatus` を添える。parse できなければ status から分類する（5xx→`server`/retryable、429→`rateLimit`/retryable、
  408→`network`/retryable、その他 4xx→`permission` か `config`、未知→`unknown`）。
- **案B: status を見るが、200 以外は常に status で分類する**
  ボディを見ずに status だけで決める。単純だが、PORTERS が「HTTP 200 以外 ＋ `<Code>`」を返す場合に情報を捨てる。
- **案C: 現状維持（status は無視）**
  何も変えない。`httpStatus` は型から削る。

## Decision Outcome

採用: **（未決定・議論用）案A を推奨**。

理由: reference が「HTTP 200 以外**または** `<Code>`≠0」と書いている以上、**どちらが来ても正しく扱える**必要がある。
PORTERS の envelope があるならそれが最も具体的な情報なので優先し、無い場合だけ status に落ちる（＝情報量の多い順）。
`httpStatus` を常に載せることで、利用者が独自判断する材料も残る。

### Consequences

- Good: プロキシ・LB 越しの障害が `server`/`network` として**リトライ可能**に分類される。`httpStatus` が実際に使える。
  `rateLimit` category が初めて produce されうる（429 が観測できる環境で）。
- Bad: エラー分類のコード量が増える。既存テストの一部（`unknown` を期待するもの）を更新する必要がある
  — 実際に `test/integration/constraints.test.ts` の 429 テストは RV-13 を明示的に固定しており、これを書き換える。
- Neutral: 分類の写像は**仮定**であり、実 PORTERS がどの status を返すかは未確認（[live-verification][lv] **LV-9**）。
  確定するまでは「reference に無い挙動は明示的仮定」として扱う。

## Pros and Cons of the Options

### 案A: status を見て分類・envelope 優先

- Good: 2 系統の両方を扱える。情報量の多い方を採る。`httpStatus` が意味を持つ。
- Good: フェイクの HTTP アダプタ（400 / 429）と実運用の LB 障害を同じ経路で説明できる。
- Bad: 「parse できるか試す」分岐が増える（ただし既存の parse を try するだけ）。

### 案B: status のみで分類

- Good: 実装が最短・分岐が単純。
- Bad: HTTP 200 以外 ＋ 正しい envelope、という組み合わせで `<Code>` を捨てる。reference の記述と整合しない。

### 案C: 現状維持

- Good: 変更ゼロ。
- Bad: 非 XML エラーが恒久的に `unknown`。`httpStatus` が死んだ型のまま残る（[ADR-0006][adr6] の約束を満たさない）。
  利用者は「原因不明」としか分からず、リトライ判断もできない＝フェイルセーフに反する。

## More Information

- 出典: [findings][findings] RV-13（`file:line` つきの根拠）／[live-verification][lv] LV-9（実機で確定すべき点）。
- 影響範囲（accept 後の実装 PR）: `src/http/requester.ts`（status 分岐）・`src/errors/classify.ts`（status→category）・
  `docs/guide/error-handling.md`（「非 PORTERS ボディの HTTP エラー」の項を追加）・
  `test/integration/constraints.test.ts`（RV-13 を固定しているテストの更新）。
- 関連: [ADR-0006][adr6]（エラーモデル）／[ADR-0009][adr9]（Transport が status を運ぶ）／[ADR-0010][adr10]（リトライ方針）。

[findings]: ../reviews/findings.md
[lv]: ../live-verification.md
[ref-resource]: ../reference/resource-api/README.md
[adr2]: 0002-ground-design-in-live-api-docs.md
[adr6]: 0006-error-model.md
[adr9]: 0009-http-transport.md
[adr10]: 0010-retry-throttle.md
[adr43]: 0043-local-fake-server.md
