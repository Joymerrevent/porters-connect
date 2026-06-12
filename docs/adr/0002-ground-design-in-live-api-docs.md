# 2. v1 設計を実 PORTERS API ドキュメントに接地する

- Status: accepted
- Date: 2026-06-13
- Deciders: jun.shiromoto (Joymerrevent)

## Context and Problem Statement

`SPEC_v1.md` は調査ベースの**素案**で、推測（例: リクエスト上限 32KB）を含む。
主要な設計判断（HTTP・エラー・OAuth・型・公開 API …）を素案のまま進めると手戻りリスクが大きい。
一方、実 API は契約ホストが無いと叩けず、公式ドキュメント（`hrbcapi.porters.jp`）も Cloudflare の
JS チャレンジでブラウザ以外からは直接読めない。
ADR を 1 本ずつ詰める前に、**設計を何にどこまで接地し、どの情報を先に集めるか**を決める必要がある。

## Decision Drivers

- 推測設計による手戻りを避け、**実仕様**に基づいて判断したい
- **非公式・著作権配慮**：公式ドキュメントを逐語コピーしない
- **再現性**：取得方法と出典を残す
- 契約環境が無くても**検証できる**テスト戦略
- 設計成果物をリポジトリ内に集約（[[0001-record-architecture-decisions]] と同じ流儀）

## Considered Options

- 案A: 公開ドキュメント（Zendesk コンテンツ API）を取得し、事実ベースで `docs/reference/` に再構成して接地する
- 案B: `SPEC_v1.md`（素案）のまま設計を進める
- 案C: 契約／テスト環境を用意し、実 API を観察してから設計する

## Decision Outcome

採用: **案A**。Zendesk のコンテンツ API（`hrbc-api.zendesk.com/api/v2/...`、Cloudflare を経由しない）で
最新記事を取得し、逐語転記せず事実を `docs/reference/` に整理する。収集範囲は優先度でトリアージした:

- **P1**（認証・型システム・Write 形式・運用の落とし穴）と **P2**（レート挙動・Phase・仕様変更・開発環境）は
  **設計着手前に収集済み**。
- **P3**（Attachment の Mime Type List / Option Default List / 用語集）は **v0.2 以降に必要時収集**（現時点は未収集として記録）。
- 契約ホストが無い間は、**ドキュメントの XML 例を vitest の fixture** にして検証する（実 API 接続は PoC・契約後）。

### Consequences

- Good: 後続 ADR を実仕様に接地でき手戻りが減る。出典 URL 併記で透明。SPEC の誤り（32KB→約15000文字 等）を早期に是正。
- Bad: `docs/reference/` は **2026-06-12 時点のスナップショット**でドリフトし得る。マスタ系など一部は出典に型表が無く欠落。
- Neutral: 取得・生成スクリプトは `tmp/`（git 管理外）。P3 は未着手のまま残る。

## Pros and Cons of the Options

### 案A: 実ドキュメントに接地（docs/reference）

- Good: 実仕様準拠で手戻り最小。再現可能。非公式方針・著作権に配慮（要約）。
- Bad: 取得・整理のコスト。スナップショットゆえ定期的な再取得が要る。

### 案B: 素案のまま進める

- Good: すぐ着手できる。
- Bad: 推測のまま設計し手戻り大。SPEC 自体に誤りが含まれる。

### 案C: 契約／テスト環境を待つ

- Good: 最も正確（実レスポンスを観察可能）。
- Bad: 有償・別契約で停滞。MVP 着手が遅れる。

## More Information

- 接地物: `docs/reference/`（`authentication` / `resource-api` / `resources` / `resources/` /
  `field-data-types` / `write-format` / `gotchas`）。取得方法は `docs/reference/README.md`。
- **P3 未収集（必要時に対応）**: Attachment - Mime Type List / Option - Default Option List / Terminology。
- 関連: [[0001-record-architecture-decisions]], `SPEC_v1.md`。
