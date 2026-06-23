# 36. refresh 失効時は code_direct で自動再取得する（ADR-0007/0012 の amend・RV-11）

- Status: accepted
- Date: 2026-06-23
- Deciders: jun.shiromoto (Joymerrevent)

> 横断監査 [RV-11][findings] で検出した doc↔実装の乖離を解消する。[[0007-oauth-public-surface]] / [[0012-token-cache-refresh]]
> が「Refresh も失効 → `PortersAuthError`」と定めるが、既定（透過 `code_direct`）の実装は**自動 `code_direct` 再取得**する。
> **実装が妥当**なので doc を実装に合わせる amend。コード変更なし。案A で `accepted`（2026-06-23）。

## Context and Problem Statement

[[0007-oauth-public-surface]]（line 113）・[[0012-token-cache-refresh]]（line 44）・PRD R-1 受け入れ基準は
**「Refresh Token も失効 → 判別可能な再認証エラー `PortersAuthError`」** を約束している。

しかし既定（透過）ストラテジの実装は、refresh が使えない（refresh token も失効/欠如）とき `PortersAuthError` を投げず、
**`code_direct` で自動再取得する**（`src/auth/token-provider.ts` の `renew()` が `canRefresh=false` で `acquire()` にフォールバック）。
`PortersAuthError` は **`code_direct` 自体が失敗したとき**（初回ブラウザ付与の取り消し・資格情報不正・スコープ不足等）にのみ表面化する。

これは [RV-11][findings] で起票したドリフトだが、**実装の方が透過既定として妥当**である:

- `code_direct` はサーバ間でブラウザ不要（初回付与済みが前提）。よって refresh 失効を「人手の再認証が必要」と扱う必要がなく、
  自動再取得の方が DX・可用性に資する（良き API 市民の範囲で無人運用を継続）。
- 利用者が読む `README` も既に「**トークン失効は内側で自動回復します**」と**実装側**を記述しており、エンドユーザー向けの
  記述は実装と一致している。乖離は**内部の設計記録（ADR-0007/0012・PRD R-1 の受け入れ基準）**に閉じている。

したがって「コードを doc に合わせて refresh 失効で `PortersAuthError` を投げる」のではなく、**doc を実装の事実に合わせる**のが正。
本 ADR は ADR-0007/0012 の当該決定（refresh 失効＝`PortersAuthError`）を amend する。

## Decision Drivers

- **API 忠実・フェイルセーフ**: 実装は安全側（自動回復で可用性維持）かつ良き API 市民。
- **DX**: 透過既定はトークンを意識させない（自動取得・更新・再取得）。
- **記録の整合（嘘をつかない）**: accepted ADR / PRD と実装の乖離を解消（[adr-workflow] に従い、accepted ADR 本文は
  直接書き換えず本 amend ADR ＋ 一行ポインタで処理）。
- **最小変更**: **コード変更なし**（挙動は据え置き）。doc/spec の整合のみ＝リリースリスク最小。

## Considered Options

- 案A: **doc を実装に合わせる**（refresh 失効時は `code_direct` 自動再取得・`PortersAuthError` は code_direct 失敗時のみ）。コード変更なし。（推奨）
- 案B: **実装を doc に合わせる**（refresh 失効で `PortersAuthError` を投げる）。
- 案C: **折衷**（refresh 失効を判別可能なイベント/警告で通知しつつ自動再取得）。

## Decision Outcome

**採用: 案A**。`code_direct` 既定では「refresh 失効＝自動再取得」が安全かつ望ましい挙動で、実装は既にそうなっている。
doc 側を実装の事実に合わせ、`PortersAuthError`（再認証が必要）は**本当に再認証が要るとき＝ code_direct 自体が失敗したとき**に
限定して定義する。案B は透過既定の可用性・DX を損ない `code_direct` 前提と矛盾。案C は hook/observability が要り過剰。

確定する挙動（**既定＝透過 `code_direct` ストラテジ**）:

- Access Token 失効 → 自動 refresh（従来どおり）。
- **Refresh Token も失効/不可 → 自動的に `code_direct` で再取得**（`PortersAuthError` は投げない）。
- **`code_direct` 自体が失敗**（初回ブラウザ付与の取り消し・資格情報不正・スコープ不足等）→ **`PortersAuthError`（`category: "auth"`）**。
  これが「再認証が必要」の唯一の表面化点。
- カスタム `TokenProvider`（[[0007-oauth-public-surface]] 案3）は対象外（自前ストラテジが投げ方を決める）。

### Consequences

- Good: accepted ADR / PRD と実装が一致。透過既定の可用性・DX を維持。利用者向け README（自動回復）とも整合。**コード変更ゼロ＝リスク最小**。
- Bad: 「refresh 失効＝`PortersAuthError`」を期待していた読者には変更。`PortersAuthError` の発火条件が「code_direct 失敗時のみ」に狭まる。
- Neutral: カスタムストラテジは各自の責務。多インスタンス協調・Refresh ローテーション挙動は引き続き契約環境で検証（[[0012-token-cache-refresh]]）。

## Pros and Cons of the Options

### 案A: doc を実装に合わせる（推奨）

- Good: 実装は安全側で妥当・README と整合・コード変更なし＝リスク最小。決定↔実装の乖離を解消。
- Bad: ADR-0007/0012 の当該記述を amend する必要（一行ポインタで処理）。

### 案B: 実装を doc に合わせる（PortersAuthError を投げる）

- Good: 旧 doc の文言どおりになる。
- Bad: `code_direct` は再取得できるのに無人運用を止める＝可用性・DX を損なう。`code_direct` 前提と矛盾。挙動変更＝回帰リスク。

### 案C: 折衷（通知しつつ再取得）

- Good: 可視性が上がる。
- Bad: イベント/フック API が新規論点。MVP には過剰。

## More Information

- 起点: [RV-11][findings]（refresh 失効時の挙動が doc と乖離）。本 ADR accepted 後に RV-11 を `fixed` にする。
- amend 対象: [[0007-oauth-public-surface]]（line 113「Refresh も失効 → PortersAuthError」）、[[0012-token-cache-refresh]]（line 44 同旨）。
  両 ADR には accepted 後に「refresh 失効時の挙動は ADR-0036 で amend」の一行ポインタを付す（本文の決定は不変・[adr-workflow]）。
- 反映（accepted 後・別 PR）: PRD R-1 受け入れ基準を上記挙動に更新。`findings` RV-11 → fixed。
- 根拠コード: `src/auth/token-provider.ts`（`renew()` → `acquire()` フォールバック、`acquire()` 失敗時のみ `PortersAuthError`）。
- 関連: [[0006-error-model]]（`category: "auth"`）、PRD R-1。

[findings]: ../reviews/findings.md
[adr-workflow]: README.md
