# 78. アクセスポイントを `hostname` と `port` に分ける

- Status: accepted
- Date: 2026-09-16
- Deciders: jun.shiromoto (Joymerrevent)
- Implemented: 0.18.0

> [ADR-0047][adr47]（scheme を設定可能に）／[ADR-0048][adr48]（`host` の書式検証）／
> [ADR-0049][adr49]（既定ポートを落とさない）で作った**アクセスポイントの形**を見直す。
> **decider が案1 を選択し `accepted`（2026-09-16）。** 実装は accept 後・別 PR
> （**0.17.0 の後＝0.18.0**）。

## Context and Problem Statement

いまの公開オプションは `host` 1 本で、**ポートを含んでよい**ことになっている。

```ts
host: string;          // 「ホスト（＋必要ならポート）」＝ URL の authority
scheme?: "https" | "http";
```

**しかし、契約で渡される値にポートは無い。** 出典（PORTERS の記事）は URL を
`https://{Request Host}/v1/…` と書き、`{Request Host}` の説明は全記事で 1 種類しかない。

> ※`{Request Host}` には、通常は共有サーバー「api-hrbc-jp.porterscloud.com」が入ります。
> 個別にサーバーを立てられる場合は、該当の**サーバー名**を入れてください。

取得済みの記事を通して**ポート表記は 0 件**で、scheme は常に `https`（443 が暗黙）。
つまり**利用者が受け取り、設定に入れる値は「サーバー名」＝ hostname** である。

**名前と中身がずれている。** URL 仕様では `host` は**ポートを含む** authority、含まないのは
`hostname`。いまの実装も `url.host` と比較して検証している（[ADR-0049][adr49] の probe scheme）。
`host` という名前で受けながら、利用者が入れるのは hostname、という状態が続いている。

**ポートが要るのは PORTERS ではない。** ローカルのフェイクサーバーやプロキシ／トンネルだけで、
リポジトリ内の実例も 3 か所（`test/fake/serve.ts` / `test/fake/http-server.ts` /
`docs/usage/howto/handle-failures.md` の例）。

**分けても「authority を作る」仕事は消えない**（調査で分かった要点）。`host` 文字列は
**2 か所で内部キーとして使われている**。

| 使い道                        | 場所                                                      | 分離したらどうなるか                                                                |
| ----------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| スロットルのバケット          | `sharedThrottleFor(host)`（[ADR-0073][adr73]）            | **合成した authority をキーにしないと**、同じ名前の別ポートが同じバケットを共有する |
| http 警告のラッチとメッセージ | `warnIfInsecureScheme(scheme, host)`（[ADR-0047][adr47]） | 表示にポートを含めるかを決める                                                      |

問い: **`host` を `hostname` と `port` に分けるか。分けるなら互換をどう扱うか。**

## Decision Drivers

- **契約値と名前が一致すること**: 渡ってくるのはサーバー名。設定の名前もそう読めること。
- **曖昧さを作らない**: 同じことを 2 か所で言える形（`host` にポート ＋ `port`）を残さない。
  [RV-10][rv10]（効かない設定を JSDoc が宣言していた）と同じ形は作らない。
- **移行コスト**: `host:` を書いているファイルは 51（うち **42 がテスト**）、ドキュメント 8 本 ＋
  `.env.example`。ほとんどは機械的な置換で、危険度は低い。
- **内部キーの一意性**: スロットルと警告のキーが壊れないこと。
- **0.x のうちに整えること**: `1.0.0` 以降は major が要る。いま決めるほうが安い。

## Considered Options

- 案1: **`hostname` ＋ `port` に分け、`host` は廃止する**（破壊的・一発で切り替え）
- 案2: `hostname` ＋ `port` を足し、`host` は deprecated として当面も受ける（移行期間つき）
- 案3: `host` は authority のまま `port?` を足す（非破壊。両方にポートが来たら弾く）
- 案4: 現状維持（利用側で `` `${hostname}:${port}` `` を合成する）

### 派生する小さな論点（案1 / 案2 を採る場合）

- **公開ゲッター**: いまの `PortersClient#host`（「The configured API host.」）をどうするか。
  `hostname` ＋ `port` に割るか、合成した authority を返す 1 本にするか。
- **検証**: `hostname` にポート（`:`）が来たら弾く ／ `port` は 1〜65535 の整数に限る
  （[RV-28][rv28]（`count` の範囲）と同じく**手前で弾く**）。
- **IPv6**: `[::1]` の角括弧を利用者に書かせるか、`hostname: "::1"` を受けて組み立て側で括るか。
- **env**: `.env.example` に `PORTERS_PORT` を足すか（ライブラリは env を読まないので、
  ドキュメント上の取り決め）。

## Decision Outcome

採用: **案1**（`hostname` ＋ `port` に分け、`host` は廃止する）。

理由: 名前と契約値が一致し、**二重指定が構造的に起きない**（`hostname` にポートを書けば
検証で落ちる）。案2 の移行期間は、その期間ずっと「`host` と `hostname`＋`port` のどちらが勝つか」を
抱えることになり、いちばん避けたい形を自分で作る。`0.x` のうちなら一発で切り替えられる。

**派生する小さな論点は実装時に確定する**（決定そのものは変わらない）。起案時点の方針:

| 論点          | 方針                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| 公開ゲッター  | `PortersClient#hostname` と `#port` の 2 本に割る。合成した authority は**内部に留める**              |
| `port` の検証 | 1〜65535 の整数。範囲外は構築時に `PortersConfigError`（[RV-28][rv28] と同じく手前で弾く）            |
| IPv6          | **角括弧付き**（`[::1]`）を受ける。裸のコロンは弾き、hint で「ポートは `port` へ／IPv6 は括る」と言う |
| env           | `.env.example` に `PORTERS_PORT` を足す（ライブラリは env を読まないので、あくまで書式の取り決め）    |

**[ADR-0049][adr49] は実装 PR で `superseded by 0078` にする**（それまでは現行の挙動を説明している
文書なので、いま倒さない）。

### Consequences

- Good: 設定の名前が、契約で渡される値（サーバー名）と一致する。
- Good: ポートが**数値**になり、範囲を検証できる。env も `PORTERS_HOST` / `PORTERS_PORT` に割れる。
- Good: [ADR-0049][adr49] の probe scheme は役目を終える（`:443` を守るための仕掛けだった）。
  検証は「ポートを含まない名前」を見ればよくなり、単純になる。
- Bad: **破壊的変更**。`host` を書いているコードは全部直す（テスト 42 ファイルが主）。
- Bad: 公開ゲッター `PortersClient#host` の形も変わる。
- Neutral: 内部には authority を合成する 1 関数が残る（スロットルのキーと警告の表示）。
  「1 か所で組み立てる」という [ADR-0047][adr47] の線はそのまま。

## 信じている入力

| 値                       | 出どころ                   | 誰が書けるか | 守り方                                           | 取れなかったら            | 誤っていたら                               |
| ------------------------ | -------------------------- | ------------ | ------------------------------------------------ | ------------------------- | ------------------------------------------ |
| `hostname`               | 契約（人が env に入れる）  | —            | 仕組み（構築時に検証。ポート・スキーム等を弾く） | 空は `PortersConfigError` | 名前解決に失敗 → `network` と混同しない    |
| `port`                   | 人（ローカル／プロキシ用） | —            | 仕組み（1〜65535 の整数）                        | 省略 ＝ scheme の既定     | 範囲外は送信前に弾く                       |
| 契約値にポートが無いこと | PORTERS の記事             | PORTERS 社   | 散文（本 ADR の実測）。機械では確かめられない    | —                         | 将来ポート付きで配られたら `port` で渡せる |

**「契約値にポートが無い」は今日の観測**であって保証ではない。案1 でも `port` は残るので、
将来ポート付きで配られても表現できる — そこが案4（現状維持）との違いでもある。

## Pros and Cons of the Options

### 案1（`hostname` ＋ `port`・`host` 廃止）

- Good: 名前と契約値が一致。二重指定が起きない。ADR-0049 の仕掛けを畳める。
- Bad: 破壊的。51 ファイル（うちテスト 42）とドキュメント 8 本 ＋ env を直す。
- Bad: 利用者の移行が要る（`host: "a.test:4010"` → `hostname: "a.test", port: 4010`）。

### 案2（足して `host` は deprecated）

- Good: 既存コードが動いたまま移行できる。
- Bad: **移行期間ずっと優先順位を抱える**（`host` と `hostname`＋`port` の併用）。
  文書で説明し続けることになり、[RV-10][rv10] と同じ形を自分で作る。
- Bad: 消すときにもう一度破壊的変更が要る（2 回痛む）。

### 案3（`host` のまま `port` を足す）

- Good: 非破壊。テストもドキュメントも書き換え不要。
- Bad: 名前のズレは残る（`host` が authority のまま）。
- Bad: 「ポートは `host` にも書けるし `port` でも渡せる」が残り、弾く規則を足して守ることになる。

### 案4（現状維持）

- Good: 何も動かさない。ポートは `` `${hostname}:${port}` `` で足りる。
- Bad: 契約値（サーバー名）と設定名（authority）のズレが残る。
- Bad: ポートが文字列の中に埋もれ、範囲検証ができない。

## More Information

- 事実の出どころ: PORTERS の記事（`{Request Host}` ＝ サーバー名・ポート表記 0 件）／
  [エンドポイント × 機能マトリクス][coverage] 表 F・表 G（scheme と認証の形）
- 前提: [ADR-0047][adr47]（scheme と URL 組立の一本化）／[ADR-0048][adr48]（`host` の書式検証）／
  [ADR-0049][adr49]（既定ポートを落とさない — **案1 / 案2 を採るなら supersede 候補**）／
  [ADR-0073][adr73]（スロットルのキー）
- 順序: 本 ADR の実装は **0.17.0 の後**（0.18.0）。0.17.0 は添付の本体の運び方を変える版なので、
  アクセスポイントの設計変更を混ぜない（切り分けのため）
- 反映（accept 後・別 PR）: `src/http/access-point.ts`・`src/client.ts`・`src/http/throttle.ts`・
  `src/http/insecure-http-warning.ts`、テスト（42 ファイル）、`README.md` ＋ `docs/usage/` 8 本、
  `.env.example`、CHANGELOG（**Breaking**）

## パスの注記

<!-- 決定の本文は書き換えない。本文に書いたパスが移ったり名前が変わったりしたら、ここに今の場所を足す。 -->

本文に書いたパスのうち、あとで移したもの・名前を変えたものの今の場所（本文は決定したときのまま）:

- `docs/usage/howto/handle-failures.md` → `docs/usage/topics/errors.md`（2026-09-23・ADR-0088）
- `src/client.ts` → `src/porters-client.ts`（2026-09-26・ADR-0101 の追記＝1 ファイルに主な export は 1 つ）
- `src/http/insecure-http-warning.ts` → `src/http/insecure-scheme-warner.ts`（2026-09-26・ADR-0101 の追記＝1 ファイルに主な export は 1 つ）

[coverage]: ../design/endpoint-coverage.md
[rv10]: ../reviews/rv/0010-per-call-partition-jsdoc.md
[rv28]: ../reviews/rv/0028-count-range-unvalidated.md
[adr47]: 0047-access-point-scheme.md
[adr48]: 0048-access-point-host-validation.md
[adr49]: 0049-host-port-roundtrip.md
[adr73]: 0073-throttle-sharing.md
