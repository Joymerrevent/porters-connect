# 48. アクセスポイント `host` の書式を検証する（設定ミスを安全側へ倒す）

- Status: proposed
- Date: 2026-08-10
- Deciders: jun.shiromoto (Joymerrevent)

> [findings][findings] **RV-17** の是正案。`host` は検証されないまま URL に連結されるため、書式を誤ると
> 例外ではなく**別ホスト宛の実リクエスト**になる。[ADR-0047][adr47] で `scheme` が独立し `host` の意味が
> 「ホスト（＋ポート）のみ」と確定した今、その契約を**実行時にも強制するか**を決める。

## Context and Problem Statement

[ADR-0047][adr47] で URL 組立は `apiUrl()` 1 本に集約された（`src/http/access-point.ts:20-29`）。
そこで行われるのは**文字列連結だけ**で、`host` の書式は一切検証されない。
`PortersClient` も `options.host` を素通しで `AccessPoint` にする（`src/client.ts:136-139`）。

問題は、書式を誤っても**例外にならない**ことにある。連結結果はたいてい「それ自体は valid な URL」になり、
`new URL()` を通り抜けて**別のホスト名**として解釈される。実測（`new PortersClient({ host }).candidate.search()` の
1 本目の宛先）:

| 設定した `host`                             | 組み立てられる URL                           | 実際の DNS 宛先           |
| ------------------------------------------- | -------------------------------------------- | ------------------------- |
| `xxxxx.example.com`（正しい）               | `https://xxxxx.example.com/v1/oauth`         | `xxxxx.example.com`       |
| `https://xxxxx.example.com`（スキーム込み） | `https://https://xxxxx.example.com/v1/oauth` | **`https`**               |
| `""`（env 未設定を `!` で押し通した）       | `https:///v1/oauth`                          | **`v1`**                  |
| `xxxxx.example.com/`（末尾スラッシュ）      | `https://xxxxx.example.com//v1/oauth`        | 正しいがパスが `//v1/...` |

`PORTERS_HOST` に**スキーム込みで入れる**のは、環境変数の名前が「HOST」でも起こりがちな取り違えで、
`.env` を手で書く運用（[ADR-0047][adr47] で `localhost:4010` のような手編集も増えた）では現実的な確率で起きる。

結果は 2 通りで、どちらも安全側ではない:

1. **その名前が解決してしまった場合** — 認証情報が意図しないホストへ実際に飛ぶ。
   1 本目の `/v1/oauth` は `app_id` をクエリに載せ（`docs/reference/authentication-api/oauth.md`）、
   続く `/v1/token` は **`secret` を body に載せて POST** する（`src/auth/token-exchange.ts:37-38,44`）。
   社内 DNS のサーチドメインやワイルドカード解決の下では `https` / `v1` のような裸のラベルも解決しうる。
2. **解決しなかった場合** — fetch の失敗は一律 `retryable: true` の `PortersNetworkError` になる
   （`src/http/fetch-transport.ts:29-33`）。**直しようのない設定ミスをリトライで叩き続け**、
   利用者に見えるのは `category: "network"`＝「ネットワークの問題」という誤った診断になる。

ドキュメント側は正しい。README は「ポートが要る場合は `host` に含めます」と書き（`README.md:347`）、
`.env.example` も [ADR-0047][adr47] も「ホスト（＋ポート）のみ」を前提にしている。
**足りているのは説明で、足りないのは強制**である。

問い: **`host`（および `scheme`）の書式を実行時に検証し、設定ミスを `PortersConfigError` として
早く・明確に落とすか。落とすなら、どこで・どこまで厳しく検証するか。**

## Decision Drivers

- **フェイルセーフ**（本プロジェクトの設計哲学）: 壊れたときに安全側へ倒す。
  「資格情報を知らないホストへ送る」「設定エラーをネットワークエラーとして無限に再試行する」は**逆側**に倒れている。
- **秘匿情報を漏らさない**（CLAUDE.md）: App Secret / トークンの送信先は、設定ミス 1 つで変わってよいものではない。
- **エラーは判別可能に**（[ADR-0006][adr6]）: 設定の誤りは `category: "config"`。`network` に化けさせない。
- **既存の系列との一貫性**: ライブラリは既に「送信前に落とす」ガードを 2 つ持つ
  （リクエスト長 ~15000 字＝`requester.ts:83`／Attachment 10MB＝`attachment.ts:200,214`）。
  アクセスポイントの書式はその**最も手前**に位置する同種のガード。
- **薄いラッパー**: URL の完全な正規化・IDN 変換・プロキシ設定などを抱え込まない。「明らかな誤りを弾く」に留める。
- **既存の正しい設定を壊さない**: 現在動いている設定（ホスト名・`host:port`）は 1 文字も変えずに通ること。

## Considered Options

- **案A: `PortersClient` 構築時に検証し `PortersConfigError` を投げる**（推奨）
  1 回だけ・最も早く・リクエスト経路を汚さない。
- **案B: `apiUrl()` で毎回検証する**
  `AccessPoint` を作る経路が増えても漏れない。ただし毎リクエストのコストと、
  失敗が「リクエスト時」に出る（設定時ではない）。
- **案C: 寛容に受け入れて正規化する**（`https://host` を渡されたらスキームを剥がす、末尾 `/` を落とす）
  利用者は何もせず動く。ただし「渡した設定と実際の接続先が違う」状態を**黙って**作る。
- **案D: 現状維持＋ドキュメント強化**（README / JSDoc に「スキームを含めないこと」を明記）
  変更ゼロ。人の注意に依存する。

検証の**強さ**は案A/B と直交する小論点なので、併せて決める:

- **機構1: 禁止パターンの列挙** — 空でない／`://` を含まない／`/` を含まない／空白・制御文字を含まない。
  読んで意味が分かる。列挙漏れは残る（例 `user@host`）。
- **機構2: `new URL()` ラウンドトリップ** — `https://` を付けてパースし、
  「パースが成功する」「`url.host` が入力（小文字化）と一致する」「`url.pathname` が `/` である」を要求する。
  **知らない壊れ方も落ちる**（未知の入力は拒否＝フェイルセーフ）。副作用として IDN は punycode に正規化されるため
  非 ASCII ホストは弾かれる（PORTERS のホストは契約通知の ASCII 値なので実害なしと考えるが、
  必要なら punycode 表記で渡す道は残る）。

`scheme` も同じ場所で見る: TypeScript の型は `"https" | "http"` に縛るが、JS からの利用や `as` 越しでは
任意の文字列が入りうる。`ftp://host/v1/...` を黙って組み立てるより、同じ `PortersConfigError` で落とすほうがよい。

## Decision Outcome

採用: **（未決定・議論用）案A ＋ 機構2 を推奨**。

理由: 検証は**設定の問題**であって通信の問題ではないので、設定を受け取った瞬間＝構築時に落とすのが素直
（案A）。`apiUrl` は「1 箇所で組み立てる」役に徹したままにできる。
機構2 を推す理由は**列挙に頼らないこと**で、想定外の書き方（`user@host`・空白・`//host`）も
「ラウンドトリップしない」の一言で落ちる。ライブラリ側のコードはむしろ短くなり、薄いラッパーの方針と両立する。

`scheme` の検証も同じガードに含める（`"https" | "http"` 以外は `PortersConfigError`）。

**[ADR-0046][adr46] との関係**: あちらは「**Promise を返す公開メソッド**は同期 throw しない」という契約であり、
本 ADR の対象は**コンストラクタ**＝ Promise を返さない同期 API なので、同期 throw で矛盾しない
（ADR-0046 の Consequences(Neutral) が明示している範囲）。

**semver**: 受け入れ入力を狭めるが、狭めるのは**そもそも正しく動いていなかった入力**だけ
（誤ったホストへ送られていた／リトライで失敗していた）なので **patch** が妥当と考える。
ただし「今まで例外が出なかった経路で例外が出る」ことは事実なので、minor に倒す判断もありうる（decider 判断）。

### Consequences

- Good: 設定ミスが**最初のリクエストが飛ぶ前に**、`category: "config"` ＋ 直し方の hint 付きで落ちる。
  資格情報が意図しない宛先へ出ることも、無意味なリトライも起きない。
- Bad: 公開挙動が 1 つ増える（コンストラクタが投げうる）。利用者のテストで `new PortersClient({...})` に
  ダミー host を入れている箇所があれば、書式次第で落ちる（`"fake.test"` 等は通る）。
- Neutral: パス prefix 付きゲートウェイ（`https://gw/porters/v1/...`）は [ADR-0047][adr47] で対象外と決めた通りで、
  本 ADR はその決定を**実行時にも明示**することになる（`/` を含む host は弾かれる）。
  将来対応するなら、そのとき別 ADR で `basePath` 等を足す。

## Pros and Cons of the Options

### 案A: 構築時に検証

- Good: 1 回で済む。失敗が「設定した場所」で出る＝原因が自明。リクエスト経路に分岐が増えない。
- Bad: `AccessPoint` を内部で直に組む経路（テスト・将来のヘルパ）は素通りする。
  ただし公開の入口は `PortersClient` だけなので実害は小さい。

### 案B: `apiUrl` で毎回検証

- Good: 入口が増えても漏れない。
- Bad: 毎リクエストの無駄。エラーが「検索したとき」に出るので、設定ミスなのに利用箇所を疑うことになる。

### 案C: 寛容に正規化

- Good: 利用者は何もしなくてよい。
- Bad: **渡した設定と実際の接続先が食い違う**状態を黙って作る。`https://a.test` を渡した人が
  `scheme: "http"` も指定していたらどちらが勝つのか、という新しい曖昧さも生む。
  「曖昧な値で黙らない」という [ADR-0047][adr47] の姿勢と逆行する。

### 案D: 現状維持＋ドキュメント

- Good: 変更ゼロ。
- Bad: 既に README・`.env.example`・ADR-0047 は正しく書いてある。それでも防げないから RV-17 が起票された。
  「人の記憶でなく仕組みで守る」に反する。

## More Information

- 出典: [findings][findings] RV-17（`file:line` つきの根拠・実測値・検出経緯）／
  スナップショット [2026-08-10-01][run]。
- 影響範囲（accept 後の実装 PR）: `src/http/access-point.ts` または `src/client.ts`（検証関数の追加）・
  `src/http/access-point.test.ts`（異常系の pin: スキーム込み／空／末尾 `/`／パス付き／不正 `scheme`）・
  `PortersClientOptions.host` の JSDoc（「スキーム・パスを含めない」を明文化）・
  `docs/guide/error-handling.md`（config カテゴリの例）。
- 関連: [ADR-0047][adr47]（`host` と `scheme` の分離＝本 ADR の前提）／[ADR-0006][adr6]（エラーモデル）／
  [ADR-0046][adr46]（例外の届き方。コンストラクタは対象外）／[ADR-0009][adr9]（Transport seam）。

[findings]: ../reviews/findings.md
[run]: ../reviews/2026-08-10-01.md
[adr6]: 0006-error-model.md
[adr9]: 0009-http-transport.md
[adr46]: 0046-guard-error-contract.md
[adr47]: 0047-access-point-scheme.md
