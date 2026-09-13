# RV-43 🟡 スロットルが client 単位で、テナント別 client を作ると自制が分裂する

- 重要度: 🟡 ／ 観点: フェイルセーフ / API 忠実性
- 状態: fixed

## 概要

1 分あたりの Read/Write 上限を自制するスロットルは、**`PortersClient` 1 つにつき 1 つ**作られる。
ドキュメントは複数の場面で**テナントごとに client を構築する**ことを勧めているため、そのとおりに
書くと 1 プロセス内にバケットが client の数だけ並び、**合計は client 数倍まで出せる**。
PORTERS から見えるのは合計なので、[R-7][prd]（レート上限の自制）が成立しなくなる。

## 根拠

- `src/client.ts:207` — `throttle: createThrottle(),` が**コンストラクタの中**にある。
  client ごとに requester ごと新しく作られる。
- `src/http/throttle.ts:39-45` — `createThrottle` は呼ばれるたびに `makeBucket` でバケットを
  2 本作る。モジュールスコープに共有状態は無い＝**プロセス内で束ねる仕掛けが無い**。
- 既定 `safety` は 0.9 なので 1 client あたり Read 1800 / Write 450 /分。**N client なら N 倍**。
- 正典 [ADR-0010][adr10]（Consequences）— 「**単一プロセス前提**のため多インスタンス/分散では
  厳密な上限保証は弱い（MVP で協調）」。弱いと認めているのは**プロセスを跨ぐ**場合であって、
  1 プロセス内で分裂することは想定に入っていない。
- PRD [R-7][prd] — 「1 分 Read 2000 / Write 500 を**自前スロットリングで超えない**（429 は返らない前提）」。

**そしてドキュメントが、分裂する形を勧めている。**

- `docs/usage/howto/multi-tenant.md`「3. 認証を完全分離したい」— 「partition ごとに別トークンで
  運用したい場合は、テナント別に `PortersClient` を構築します」
- `docs/usage/howto/custom-fields.md`「複数テナントで項目が違う場合」— 「テナントごとに
  `PortersClient` を構築してください」
- **どちらもスロットルが分裂することに触れていない。**

さらに `docs/usage/concepts/limits.md`（レートの節）は「**数えているのはプロセス 1 つ分です**」と
書いている。実装は client 単位なので、この記述は**誤り**。

## 影響

**単一テナント（client 1 つ）では発火しない。** 効くのはマルチテナント SaaS で、しかも
**ドキュメントが勧めた形に従ったとき**に限って壊れる。自分で踏みに行った覚えが無いのに壊れる側。

超過しても PORTERS は判別可能なコードを返さず接続を切る（[ADR-0044][adr44]）。表に出るのは
`PortersNetworkError`（`category: "network"`・`retryable: true`）なので、**リトライでさらに叩く**。
原因が「client を分けたこと」だと気づく手がかりが、エラーにもドキュメントにも無い。

月 15 万アクセスの契約条件にも効く。「公認に値する品質＝上限内に自制する」（[requirements][prd]
目標2）に直結するため、テナント数が増えるほど 🔴 に近づく。50 テナントなら上限の 50 倍を
許すことになる。

## 検出経緯

使い方ドキュメントを実装と突き合わせる作業（[#270][pr270]）のあと、「カスタム項目をテナント単位で
差し替えられないか」という問いを検討していて分かった。回避策（テナント別 client）の費用を
数えようとして、`createThrottle()` がコンストラクタの中にあることに気づいた。

## 推奨

**挙動が変わるので要 ADR**（既定を変えるか、注入を足すかの判断を含む）。

- **(a) 既定でプロセス内共有にする** — アクセスポイント（host）ごとに 1 つのバケットを持つ。
  - Good: 利用者が何もしなくても正しくなる＝安全側に倒れる。ドキュメントの「プロセス 1 つ分」が
    真になる。
  - Bad: モジュールスコープに可変状態を持つことになり、テスト間で漏れる。同一プロセスの
    別アプリとも混ざる（それが正しい場面と、そうでない場面がある）。
- **(b) `PortersClientOptions` に `throttle` を足して注入できるようにする**
  - Good: 明示的で、テストしやすい。既存の挙動を変えない（後方互換）。
  - Bad: **知らない人は分裂したまま**。黙って壊れる側が残るので、単独だと弱い。
- **(c) そもそも client を分けなくて済むようにする** — カタログ（とトークン）を `tenant(id)` 側で
  差し替えられるようにする。
  - Good: 根本。client を分ける理由が減れば、分裂の機会そのものが消える。
  - Bad: 公開 API の形が変わる。カスタム項目をテナント単位で持つ設計の ADR と同じ論点になる。
- **(d) ドキュメントに警告を書くだけ**
  - Good: すぐできる。`limits.md` の誤り（「プロセス 1 つ分」）はどの案でも直す必要がある。
  - Bad: 仕組みで守っていない。このリポジトリが繰り返し避けてきた形。

**(a) ＋ (b)**（既定は安全側・必要なら差し替え）を軸に、(c) は別 ADR で扱うのが素直だと考える。
(d) の文言修正は、どれを採るにしても先に必要。

## 処置

[ADR-0073][adr73] を accepted（4 論点すべて推奨案）ののち実装。**(a) 既定でプロセス内共有**＋
**(b) 注入できるようにする**の両方を入れた。

- バケットは**ホストごと**になった（`createThrottleRegistry` / `sharedThrottleFor`）。鍵は
  アクセスポイントのホストを小文字化したもの。ローカルのフェイクは別ホストなので本番向けの枠を
  食わない。状態はファクトリに持たせ、プロセス全体のインスタンスをそこから作る
  （`insecure-http-warning` と同じ形）
- `PortersClientOptions.throttle` を追加。共有から降りる・別の上限で走らせる・
  **プロセスを跨いで協調する**（Redis 実装）がすべて利用側でできる
- 公開記号が 3 つ増えた: `createThrottle` ／ `Throttle` ／ `ThrottleOptions`（semver minor）
- **既定の挙動が変わる**（同じホストへ複数 client を立てていた場合、以前より待つ）。changeset に明記

ドキュメントも直した。`concepts/limits.md` の「数えているのは〜」をホスト単位に、
`multi-tenant.md` / `custom-fields.md` の警告を「分けても分かれません」に、`sync-batch.md` に
別プロセスで回す場合の注入例を足した。

レート上限が何単位か（App / 契約 / ホスト）は正典に無いので [LV-23][lv23] を起票した。
仮定が外れても倒れ方は安全側（広く共有＝叩きすぎない）。

## 検証

- `src/http/throttle.test.ts` — 同じホストで同じ実体・違うホストで別実体・大小無視・ポート違いは
  別・`reset()` で忘れる、の 5 つをファクトリ直接で pin。プロセス全体の `sharedThrottleFor` も
  1 ホスト 1 バケットを確認
- `src/client.test.ts` — 同じホストの 2 client が**同じバケットを通る**（`sharedThrottleFor` の
  戻りを spy して 2 回呼ばれることを確認＝バケットが増えていない）／別ホストは通らない／
  注入が共有より優先される／書き込みが `write=true` で通る
- 全ゲート green（`lint:ts` / `tsc` / vitest / `check:api` / `check:docs` / `check:index` /
  `check:links` / `check-api-mentions` / `lint:md`）

[adr10]: ../../adr/0010-retry-throttle.md
[adr73]: ../../adr/0073-throttle-sharing.md
[adr44]: ../../adr/0044-http-status-handling.md
[pr270]: https://github.com/Joymerrevent/porters-connect/pull/270
[lv23]: ../../live-verification.md
[prd]: ../../design/requirements.md
