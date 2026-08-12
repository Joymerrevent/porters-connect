# 50. 認証 API 経路にも HTTP ステータスを配線する（[ADR-0044][adr44] の適用範囲）

- Status: accepted
- Date: 2026-08-12
- Deciders: jun.shiromoto (Joymerrevent)

> [findings][findings] **RV-19** の是正案。[ADR-0044][adr44] で `requester` は `res.status` を見るようになったが、
> **OAuth / Token の 2 経路は `transport.send` を直接呼んでおり status を捨てたまま**で、同じ穴が認証系にだけ残っている。
> 0044 の影響範囲が `requester` に限定されていたため実装時には手を付けず、別 finding として起票した。
> **decider が案A を選択し `accepted`（2026-08-12）**。実装は accept 後・別 PR。

## Context and Problem Statement

[ADR-0044][adr44] は「reference がエラーを **HTTP 200 以外、または `<Code>`≠0** の 2 系統で定義している以上、
どちらが来ても正しく扱えなければならない」と決め、`requester` に判定順（envelope 優先 → 無ければ status から分類）を入れた
（`src/http/requester.ts:52-73`）。

ところが**トークンを取りに行く 2 経路はその外側にある**。

- `src/auth/token-provider.ts:92-93` — `code_direct` の `GET /v1/oauth`
- `src/auth/token-exchange.ts:42-48` — `POST /v1/token`

どちらも `transport.send()` の戻り値から **`body` だけを読み、`status` を捨てて** `parseAuthentication` に渡す。
ロードバランサ・プロキシ・WAF が返す**非 XML の 4xx/5xx** はルートに `<Authentication>` を持たないため、
`parseAuthentication` は「unparseable authentication response」を throw する（`src/xml/parser.ts:137-142`）。
その結果:

- **`category: "unknown"` ／ `httpStatus: undefined` ／ `retryable: false`** になる。
  何が起きたのかも、再試行してよいのかも分からない。
- **トークン取得は全リクエストの前段**なので、影響が Resource API 呼び出し全体に及ぶ。
  同じ 502 でも、Resource 経路なら [ADR-0044][adr44] により `server`・retryable に分類され
  `requester` のバックオフで**自動的に回復**しうる（`requester.ts:149`）。認証経路だと**その場で失敗**する。

つまり **同じ障害が、どの経路で起きたかによって挙動が変わる**。認証系だけが取り残されている。

なお **RV-20（HTTP 200 ＋ 非 PORTERS ボディが「空ページ」として通る）は認証経路には無い**。
`parseAuthentication` はルート `<Authentication>` を要求するので、非 envelope は必ず throw する。
本 ADR の争点は**分類とリトライ可否**であって、「黙って成功に見える」問題ではない。

問い: **[ADR-0044][adr44] の判定順を認証経路にも適用するか。適用するなら、判定ロジックをどこに置き、
status 由来のエラーをどの系統（サブクラス）で表すか。**

## Decision Drivers

- **自己一貫性**: 同じライブラリ内で、同じ HTTP 障害の扱いが経路によって違うのは説明がつかない
  （[ADR-0046][adr46] が「Transport 層と公開リソース面で例外契約が逆」を是正したのと同じ性質の不整合）。
- **フェイルセーフ**: 「原因不明で落ちた」より「5xx は一時障害」と分かる方が安全側。とくに**全リクエストの前段**で
  起きる失敗は、回復可能なら回復させたい。
- **API 忠実性 / 接地**（[ADR-0002][adr2]）: reference の 2 系統定義は Resource API だけの話ではない。
- **薄さ**: 判定ロジックを 2 つ持たない。既にある `readResponse` を使い回す。
- **後方互換**: 既存利用者の `catch` が壊れないこと。

## Considered Options

- **案A: `readResponse` を共有し、認証経路にも同じ判定順を適用する**（推奨）
  `requester.ts` の中に閉じている `readResponse` を `http/` の 1 ファイルへ出し、
  `token-provider` / `token-exchange` からも呼ぶ。判定順・写像・`httpStatus` の付与は [ADR-0044][adr44] のまま。
- **案B: `httpStatus` を添えるだけで、分類は変えない**
  非 envelope の失敗は従来どおり「unparseable」＝ `unknown` のまま、`httpStatus` だけ載せる。
- **案C: 認証経路専用の分類を作る**（すべて `PortersAuthError` に寄せ、category だけ status 由来にする）
  「認証 API 由来のエラーは `PortersAuthError`」という系統の一貫性を優先する。
- **案D: 現状維持**（findings に残すだけ）

## Decision Outcome

採用: **案A（`readResponse` を共有し、認証経路にも同じ判定順を適用する）**。decider が 2026-08-12 に選択。

理由: [ADR-0044][adr44] が決めたのは「**PORTERS の応答でない HTTP エラーをどう扱うか**」であって、
Resource API 固有の話ではない。**同じ問いに 2 つの答えを持たない**のが素直で、実装も
「既にあるものを 1 ファイルへ出して呼ぶ」だけで済む（写像も判定順も新規に決めるものは無い）。

案C（すべて `PortersAuthError`）は一見筋が通るが、**502 は認証の失敗ではない**。
[ADR-0006][adr6] のサブクラスは**発生系統**で分かれており、LB が落ちたことを「認証 API のエラー」と名乗らせるのは
かえって誤診を招く。なお案A で出うるクラスは `PortersNetworkError`（5xx / 429 / 408）・`PortersAuthError`（401 / 403）・
`PortersConfigError`（その他 4xx）で、**いずれも `AuthApi.exchangeAuthorizationCode` の JSDoc が既に列挙している系統**に収まる
（未知 status の基底 `PortersError` だけが新顔）。

案B は `httpStatus` が載るだけで**リトライ可否が分からない問題が残る**ため、RV-19 の主眼を外す。

実装時に守ること（accept 時の合意事項）:

1. **判定ロジックは 1 つ**。`readResponse` を `src/http/` の独立ファイルへ移し、`requester` と認証 2 経路が同じものを使う。
   判定順・status→category の写像・`httpStatus` の付与は [ADR-0044][adr44] のまま**変更しない**。
2. **parse 関数はそれぞれのまま**（認証経路は `parseAuthentication`、Resource 経路は各 parse）。
   共有するのは「status と body のどちらを採るか」の判断だけ。
3. **テスト**: 認証経路で (a) ゲートウェイ 5xx（envelope 無し）が `server`・retryable・`httpStatus` 付きになること、
   (b) **HTTP 200 以外 ＋ `<Authentication><Error>`** では **envelope が勝つ**こと、
   (c) 既存の `<Error>` 由来のエラー（`103` / `401` など）が**一切変わらない**ことを pin する。
   フェイクは `failNext({ kind: "http", status })` が `/v1/oauth`・`/v1/token` にも当たるので L1 で書ける。
4. **`VERIFY(live)`**: 実 PORTERS がどの status を返すかは未確認（[live-verification][lv] **LV-9**）。
   [ADR-0044][adr44] と同じ仮定に乗る。

**semver**: **minor**（[ADR-0044][adr44] と同じ理由。観測可能な挙動が変わる）。
`category` が `unknown` から `server` / `permission` などに変わり、これまで失敗していた一時障害が**自動回復するようになる**。

**リリースとの関係**: **0.7.0 のブロッカーではない**。RV-19 は今回の変更による退行ではなく、
0.4.0 以前から存在する挙動なので、**0.7.0 に間に合えば同梱・間に合わなければ次版**でよい
（[ADR-0049][adr49] のように「先に入れないと利用者に往復を見せる」性質の変更ではない）。

### Consequences

- Good: 同じ HTTP 障害が経路によらず同じ分類になる。**トークン取得中の一時障害が自動リトライで回復**しうる
  （`requester` のバックオフは `e.retryable` を見るため、認証経路から上がってきた retryable なエラーにも効く）。
- Good: 判定ロジックが 1 箇所に集まり、[ADR-0044][adr44] の写像を将来変えるときの修正点が 1 つで済む。
- Bad: 認証経路が `PortersNetworkError` / `PortersConfigError` を投げうるようになる（従来は実質 `PortersAuthError` のみ）。
  `catch (e) { if (e instanceof PortersAuthError) … }` だけで組んでいる利用者コードは、分岐が増える。
- Neutral: **非冪等な `create` の冪等性ガードが、送信前の失敗にも掛かる**。`requester` のガードは
  `PortersNetworkError` かどうかしか見ないため（`requester.ts:147`）、**トークン取得で 5xx が出た場合**でも
  「送ったかもしれない」扱いで再送しない。実際には**リクエストは一度も出ていない**ので再送して安全である。
  これは fetch 失敗（既存の `PortersNetworkError`）でも同じく起きている**既存の保守的さ**で、本 ADR が作る問題ではないが、
  発生頻度は上がる。ガードの粒度そのものは [findings][findings] **RV-22** と同じ論点なので、
  **そちらで一緒に見直す**のが筋（本 ADR では触らない）。

## Pros and Cons of the Options

### 案A: `readResponse` を共有

- Good: 新しい決定を何も持ち込まない（[ADR-0044][adr44] の適用範囲を広げるだけ）。
- Good: 判定が 1 箇所。写像の変更に強い。
- Bad: `requester` に閉じていた内部関数を `http/` の公開面（モジュール内）に出す小さなリファクタが要る。

### 案B: `httpStatus` を添えるだけ

- Good: 差分が最小。分類の議論を持ち込まない。
- Bad: **リトライ可否が分からないまま**＝ RV-19 の主眼が解決しない。`unknown` が残る。

### 案C: すべて `PortersAuthError` に寄せる

- Good: 「認証 API を叩いて失敗した」という**呼び出し側の文脈**には合う。`catch` の分岐が増えない。
- Bad: **502 は認証の失敗ではない**。[ADR-0006][adr6] の「サブクラス＝発生系統」という約束を崩し、誤診を招く。
- Bad: Resource 経路と認証経路で**同じ status が別クラス**になる（自己一貫性が下がる）。

### 案D: 現状維持

- Good: 変更ゼロ。
- Bad: 経路によって同じ障害の扱いが違う状態が残る。**全リクエストの前段**で回復可能な失敗を回復させられない。

## More Information

- 出典: [findings][findings] **RV-19**（`file:line` つきの根拠・検出経緯）。[ADR-0044][adr44] の実装（PR #143）中に判明。
- 影響範囲（accept 後の実装 PR）: `src/http/requester.ts`（`readResponse` の切り出し）・
  `src/http/`（新ファイル）・`src/auth/token-provider.ts`・`src/auth/token-exchange.ts`・
  それぞれのテスト ＋ L1（`test/integration/`）・CHANGELOG。
- 関連: [ADR-0044][adr44]（本 ADR が適用範囲を広げる決定）／[ADR-0006][adr6]（エラーモデル＝サブクラスは発生系統）／
  [ADR-0010][adr10]（リトライ方針・冪等性ガード）／[ADR-0034][adr34]（`porters.auth.*` の公開サーフェス）。

[findings]: ../reviews/findings.md
[lv]: ../live-verification.md
[adr2]: 0002-ground-design-in-live-api-docs.md
[adr6]: 0006-error-model.md
[adr10]: 0010-retry-throttle.md
[adr34]: 0034-oauth-public-surface-impl.md
[adr44]: 0044-http-status-handling.md
[adr49]: 0049-host-port-roundtrip.md
[adr46]: 0046-guard-error-contract.md
