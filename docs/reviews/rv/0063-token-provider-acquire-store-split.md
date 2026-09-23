# RV-63 🟢 トークンの「取得」だけを差し替えて「管理」（キャッシュ・更新・`tokenStore`）をライブラリに任せる入口が無い

- 重要度: 🟢 ／ 観点: DX / アーキテクチャ
- 状態: open

## 概要

認証の差し替え口は 2 つある。`tokenStore`（保存先だけ変える。取得・更新はライブラリ）と、
`TokenProvider`（`getAccessToken` を丸ごと自前にする。キャッシュ・期限判定・同時呼び出しの 1 本化・
永続化もすべて自前）。**「取得だけ差し替えて、管理はライブラリに任せたい」中間が公開されていない**。
既定の実装の内側は、取得・更新（`code_direct` と Token API）と管理（キャッシュ・`forceRefresh`・
single-flight・`tokenStore` への読み書き）に分かれているが、その組み立てはライブラリの中に閉じている。

stakeholder の提案（2026-09-23）: 「TokenProvider を組み替えて tokenStore を使う実装のほうがよいのでは。
トークン管理とトークン取得の結合を分離する」。

## 根拠

- `docs/adr/0007-oauth-public-surface.md`「Decision Outcome」— 案4「注入可能な認証ストラテジ」。
  `TokenProvider` は `getAccessToken` の 1 メソッドで、**既定＝透過（`code_direct`＋キャッシュ＋自動更新）／
  自前＝独自ストラテジ**の 2 択として決めている。`tokenStore` は「既定ストラテジが使う」もの。
- `docs/adr/0012-token-cache-refresh.md` — 既定ストラテジ内部のキャッシュ・Refresh・single-flight・
  `TokenStore` への書き戻し。**既定の内側にだけ**ある。
- `src/auth/token-provider.ts:46` — `createDefaultTokenProvider(opts)` が取得（`acquire` / `exchange`）と
  管理（`ensure` / `renew` / `inflight` / `store`）を 1 つの closure に組んでいる。取得の関数を差し替える
  引数は無く、この factory 自体も `src/index.ts` から export していない。
- `src/auth/auth-api.ts:176` — `getToken` は `opts.provider.getAccessToken()` を呼ぶだけ。独自 provider の
  ときは `tokenStore` はどこからも参照されない（ガイド `docs/usage/topics/auth.md`「`tokenStore` が使われるのは
  既定の方式のときだけ」）。
- `docs/usage/topics/auth.md`「トークンを自前で管理するとき」— 独自 provider は「キャッシュし、`forceRefresh` の
  ときだけ取り直す実装例」を**自分で書く**形で示している＝管理の部分を利用者が再実装している。

## 影響

🟢。いまの 2 つの入口で用途は満たせる（保存先だけ／全部自前）。困るのは「トークンの取得を別の仕組み
（社内の中央サービスなど）に任せたいが、キャッシュ・期限・`forceRefresh`・永続化はライブラリのものを
使いたい」利用者で、その人は既定の管理と同じものを自前で書くことになる。書き間違えると、期限切れの
トークンを使い続ける・同時に何本も取り直す、といった既定なら起きない失敗が起きる。

ただし PORTERS のトークン取得は `code_direct` の 1 通りしかないので、「取得だけ差し替える」場面は
「別のサービスが発行したトークンを受け取る」形がほとんどで、その場合 Refresh Token による更新は
発行側が持つ。ライブラリの管理で再利用できるのはキャッシュと期限判定が主で、分離の価値は
見た目より小さい可能性がある。

## 検出経緯

使い方ドキュメントの校閲中（#378）に、stakeholder が `tokenStore` と `TokenProvider` の違いを質問し、
`porters.auth.getToken()` → `TokenProvider` → `tokenStore` の関係を確かめる流れで、既定の実装の内側が
取得と管理に分かれていること、その分離が公開されていないことを確認した。

## 推奨

- (a) **実例が 1 件出た時点で ADR を起票**し、既定の実装を組み立てる factory を公開する。
  例: `createTokenProvider({ acquire, store })` — `acquire(): Promise<StoredTokens>`（または
  `refresh` も）だけを渡すと、キャッシュ・期限判定・`forceRefresh`・single-flight・`tokenStore` への
  保存はライブラリが受け持つ。既存の `tokenStore` / `TokenProvider` は変えない（非破壊）。
  [ADR-0007][adr07] 案4 と [ADR-0012][adr12] への追加になる。
- (b) いま足すのは見送る。入口が 3 つになると使い分けの説明が要り、PORTERS の取得経路が 1 通りである以上、
  先回りする根拠が薄い。代わりに、ガイドの「認証とトークン」に **`porters.auth.getToken()` → `TokenProvider`
  （既定）→ メモリのキャッシュ → `tokenStore` → PORTERS** の順を図で書き、`tokenStore` は既定の
  `TokenProvider` の中の部品で、独自 `TokenProvider` を渡すと使われないことを明示する（今回の質問が
  そのまま読者の疑問になる）。
- (c) (a) を待つ間に独自 provider を書く人のために、ガイドの実装例に「キャッシュ・`forceRefresh`・
  同時呼び出しの扱い」を漏れなく載せておく（既に例はあるので、single-flight が抜けていないかを確かめる）。

## 処置

未着手。(b) の図はドキュメントの作業として先に入れられる。(a) はロードマップの「条件付き（実例が出たら起票）」。

## 検証

—

[adr07]: ../../adr/0007-oauth-public-surface.md
[adr12]: ../../adr/0012-token-cache-refresh.md
