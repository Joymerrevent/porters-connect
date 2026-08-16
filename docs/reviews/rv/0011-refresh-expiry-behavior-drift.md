# RV-11 🟡 refresh 失効時の挙動が doc と乖離

- 重要度: 🟡 ／ 観点: 認証
- 状態: fixed

## 概要

R-1 受け入れ基準・ADR-0007 は「Refresh も失効 → **判別可能な再認証エラー**（`PortersAuthError`）」を約束するが、実装は refresh 不可時に**黙って `code_direct` 再取得へフォールバック**する。再認証エラーは code_direct 自体が失敗したときだけ表面化。透過既定としては妥当な挙動かもしれないが、doc の受け入れ基準と一致しない（意図なら doc を直す、意図でないなら明確化が要る）

## 根拠

`src/auth/token-provider.ts:90-96`（`renew` が `canRefresh=false` で `acquire()` にフォールバック）, `:83`（code_direct 失敗時のみ `PortersAuthError`）/ `docs/design/requirements.md:64-65` / `docs/adr/0007-oauth-public-surface.md:113`

## 推奨

挙動と doc を整合させる — (a) refresh 失効を判別可能な再認証イベント／エラーとして表面化、(b) もしくは「透過既定では自動再取得する」を R-1／ADR-0007 に明記して受け入れ基準を更新。決定を要するため **ADR amend を伴う**可能性

## 処置

ADR-0036（accepted・案A）で doc を実装に合わせて amend。透過既定は refresh 不可時に自動 `code_direct` 再取得し、`PortersAuthError` は `code_direct` 自体が失敗したとき（初回付与の取り消し・資格情報不正）のみ。PRD R-1 受け入れ基準を更新し、ADR-0007/0012 に amend の一行ポインタを付与。**コード変更なし**（実装は元からこの挙動）
