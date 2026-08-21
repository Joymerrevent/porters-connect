# 47. アクセスポイント / scheme を設定可能にする（http を明示的に許す条件）

- Status: accepted
- Date: 2026-08-09
- Deciders: jun.shiromoto (Joymerrevent)
- Implemented: 0.7.0

> [ADR-0043][adr43] が「D-アクセスポイント/scheme」として内包していた論点を、独立の判断として切り出す
> （フェイクサーバー実装計画の**フェーズ6**）。**公開サーフェスの追加とセキュリティ姿勢**を決めるため、実装前に単独で決める。
> **decider が案B を選択し `accepted`（2026-08-09）**。実装は accept 後・別 PR。

## Context and Problem Statement

ライブラリは URL を **`https://${host}/v1/...` でハードコード**している。現在 **10 箇所**：
`src/auth/token-exchange.ts:44`／`src/auth/token-provider.ts:85`／`src/auth/auth-api.ts:144`／
`src/resources/resource.ts:182,190`／`src/resources/attachment.ts:120`／`src/resources/partition.ts:64`／
`src/resources/user.ts:81`／`src/resources/field.ts:101`／`src/resources/option.ts:66`
（ADR-0043 起票時は 8 箇所。マスタ実装で増えた＝**集約されていないため増え続ける**）。

このため、次ができない：

- **N2（利用者の無改造アプリをローカル フェイクへ向ける）**: `PORTERS_HOST=localhost:4010` としても
  `https://localhost:4010/...` になる。フェイクは http（証明書不要）で動くため到達しない。
  現状の回避策は `transport` の差し替え（[ADR-0043][adr43] フェーズ5 の `createForwardingTransport`）＝**アプリのコードが 1 行変わる**。
- **VPN / 内部ゲートウェイ / リバースプロキシ越し**の接続。実運用でも「別のアクセスポイントへ向けたい」需要はある。

同時に、**http を安易に許すと事故る**。PORTERS のトークンは独自ヘッダで運ばれるため、平文化は資格情報の露出に直結する。

問い: **アクセスポイント（scheme ＋ authority）をどう設定させるか。http をどの条件で許し、どう警告するか。**

## Decision Drivers

- **フェイルセーフ**: 既定は https。http は「意識して選んだ」ときだけ。**許可と沈黙を分ける**（許しただけでは黙らない）。
- **秘匿情報を漏らさない**（CLAUDE.md）: トークン・App Secret が平文で流れる経路を、気づかないまま作らせない。
- **薄いラッパー**: プロキシ設定・証明書・mTLS などを抱え込まない。汎用ネットワーク要件は既存の Transport seam に委ねる。
- **ホスト名は非公開**（CLAUDE.md）: 既定値をコードに持たない方針は維持する。
- **保守性**: URL 組立が 10 箇所に散っている状態自体が負債。1 箇所に集約する。

## Considered Options

- **案A: `baseUrl` を 1 つ受け取る**（`https://host` / `http://localhost:4010` をそのまま）
  `host` と排他。URL 組立は `baseUrl + /v1/...`。
- **案B: `host` はそのまま、`scheme?: "https" | "http"` を足す**（推奨）
  既存の `host`（ホスト名のみ・非公開値）を維持し、scheme だけを設定可能にする。ポートは `host` に含められる。
- **案C: 環境変数だけで切り替える**（`PORTERS_ALLOW_HTTP=1`）
  公開 API を増やさない。ただしライブラリが env を読む設計は明示性に欠ける。
- **案D: 現状維持（Transport 差し替えのみ）**
  ローカル検証は `createForwardingTransport` 相当で足りるとして、ライブラリは触らない。

いずれの案でも共通で決めるべきこと：

1. **http の許可条件**: 明示設定のみ。既定は https。
2. **警告**: http 使用時は**ループバック含め毎起動で必ず出す**（`console.warn`・プロセス内 1 回＝毎リクエストのスパムは避ける）。
3. **抑止**: 専用の環境変数（例 `PORTERS_SUPPRESS_INSECURE_HTTP_WARNING`）でのみ黙る。**許可 ≠ 沈黙**。
4. **自己署名 https は不採用**（証明書運用の重さに見合わない）。フェイクは http のまま。

## Decision Outcome

採用: **案B（`host` はそのまま、`scheme` を足す）＋ 共通事項 1〜4**。decider が 2026-08-09 に選択。

理由: `host` は「契約時に通知される非公開値を env で受ける」という既存の運用（CLAUDE.md）と README・PRD の記述に
深く結びついており、`baseUrl` へ寄せると**その運用まで書き換わる**。scheme だけを足せば、既存利用者の設定は 1 文字も変わらず、
ローカル・VPN 越しの需要は満たせる。URL 組立の集約（10 箇所 → 1 関数）は案A/B どちらでも前提作業として行う。

実装時に守ること（accept 時の合意事項）:

1. **URL 組立を 1 関数へ集約**してから scheme 分岐を入れる（現在 10 箇所・リソースを足すたびに増えている）。
   集約が先＝分岐を 1 回だけ書くための前提作業。
2. **公開オプションは `scheme?: "https" | "http"`（既定 `"https"`）**。`host` の意味・`PORTERS_HOST` の運用は不変。
   ポートが要る場合は `host` に含める（`localhost:4010`）。
3. **警告は「毎起動・ループバック含め必ず」**。`scheme: "http"` のとき `console.warn` を **プロセス内 1 回**出す
   （毎リクエストのスパムは避ける）。localhost だからと免除しない。
4. **抑止は専用 env のみ**＝ `PORTERS_SUPPRESS_INSECURE_HTTP_WARNING`。**許可 ≠ 沈黙**：`scheme: "http"` を
   設定しただけでは黙らず、黙らせるには意識的な操作を要する。この分離が本 ADR の核心。
5. **自己署名 https は不採用**。フェイクは http のまま（証明書運用を持ち込まない）。
6. **semver は minor**（公開オプションの追加）。
7. **パス prefix 付きゲートウェイ**（`https://gw/porters/v1/...`）は**対象外**。必要になったら別 ADR で扱う。
8. **フェイク側の完了条件**: [フェイクサーバー実装計画][fake-plan] フェーズ6 として、
   `PORTERS_HOST=localhost:4010` ＋ `scheme: "http"` だけでフェイクに繋がること（＝アプリ無改造）を結合テストで示す。
   フェーズ5 の `createForwardingTransport` は**削除せず残す**（ライブラリ非依存で繋ぐ手段として有用）。
9. **ドキュメント**: README「ホスト名は非公開」節に scheme と警告の説明を追加、CONTRIBUTING のフェイク接続手順を
   transport 差し替えから `scheme` へ差し替える。

### Consequences

- Good: **無改造アプリ**をフェイクへ向けられる（真の N2）。VPN/LB 越しも同じ seam でカバー。
  URL 組立が 1 箇所になり、リソース追加のたびに `https://` を書かなくてよくなる。
- Bad: 公開 API が 1 つ増える（`PortersClientOptions.scheme`）＝ semver 上は minor。
  http 警告の実装（プロセス内 1 回・env 抑止）を持つ必要がある。
- Neutral: 「平文で動かせる」経路を公式に用意することになる。だからこそ**警告と抑止の分離**が本 ADR の核心。

## Pros and Cons of the Options

### 案A: `baseUrl` 一本

- Good: 概念が 1 つ。ポート・パス prefix まで表現できる。
- Bad: `host`（非公開値）を前提にした既存ドキュメント・env 運用（`PORTERS_HOST`）と二重化する。移行が必要。

### 案B: `host` ＋ `scheme`

- Good: 既存の設定・ドキュメントを壊さない。差分が最小。scheme だけが増える＝意味が明快。
- Bad: パス prefix 付きのゲートウェイ（`https://gw/porters/v1/...`）には対応できない（必要になれば別 ADR）。

### 案C: 環境変数のみ

- Good: 公開 API を増やさない。
- Bad: ライブラリが env を暗黙に読むのは、設定の出所が見えづらくテストもしにくい。`host` は既に利用者が渡す設計なので不整合。

### 案D: 現状維持

- Good: 変更ゼロ。ローカル検証は既に可能（フェーズ5 で達成済み）。
- Bad: 「無改造」は永久に達成できない。URL 組立の分散も残り、リソース追加のたびに増える。

## More Information

- 前提: [ADR-0043][adr43]（フェイクサーバー設計。本 ADR は同 ADR が「独立性が高いので将来別 ADR へ切り出しても可」と
  述べた部分の切り出し）／[フェイクサーバー実装計画][fake-plan] フェーズ6。
- 影響範囲（accept 後の実装 PR）: URL 組立 10 箇所の集約・`PortersClientOptions`・警告実装・
  README /「対応バージョン」節周辺・`docs/guide/`・フェイク側の利用手順。
- 関連: [ADR-0009][adr9]（Transport seam。汎用ネットワーク要件はこちらに委ねる）／
  [ADR-0005][adr5]（公開 API の形）。

[fake-plan]: ../design/fake-server-plan.md
[adr5]: 0005-public-api-shape.md
[adr9]: 0009-http-transport.md
[adr43]: 0043-local-fake-server.md
