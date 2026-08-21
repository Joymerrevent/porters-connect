# RV-11 🟡 refresh 失効時の挙動が doc と乖離していた

- 重要度: 🟡 ／ 観点: 認証
- 状態: fixed

## 概要

R-1 の受け入れ基準と [ADR-0007][adr7] は「Refresh も失効 → **判別可能な再認証エラー**
（`PortersAuthError`）」を約束していたが、実装は refresh 不可時に
**黙って `code_direct` 再取得へフォールバック**する。再認証エラーは code_direct 自体が
失敗したときだけ表面化していた。

## 根拠

- `src/auth/token-provider.ts:90-96` — `renew` が `canRefresh = false` のとき `acquire()` にフォールバック。
- 同 `:83` — `code_direct` が失敗したときにのみ `PortersAuthError`。
- `docs/design/requirements.md:64-65`（R-1 受け入れ基準）/ `docs/adr/0007-oauth-public-surface.md:113`。

## 影響

**透過的な既定としては実装の挙動のほうが妥当**（利用者は何もせず回復できる）。
問題は挙動そのものではなく、**受け入れ基準と実装が食い違っている**こと。
どちらが正なのかを決めないと、後から「仕様どおりに直す」人が正しい挙動を壊しかねない。
利用者への実害は現時点で無いため 🟡。

## 検出経緯

横断監査 [2026-06-22-03][run3]。accepted ADR / PRD の受け入れ基準を実装と全件突き合わせた際に、
「約束はしているが実装が違う」ケースとして検出した（未実装サーフェス群とは別の B 群）。

## 推奨

挙動と doc を整合させる — (a) refresh 失効を**判別可能な再認証イベント／エラー**として表面化させる、
(b) 「透過既定では自動再取得する」を R-1 / [ADR-0007][adr7] に明記して受け入れ基準を更新する。
どちらを正とするかの**決定を要するため ADR amend を伴う**可能性がある。

## 処置

[ADR-0036][adr36] を **accepted**（案A）とし、**doc を実装に合わせて amend** した。
透過既定は refresh 不可時に自動 `code_direct` 再取得を行い、`PortersAuthError` は
`code_direct` 自体が失敗したとき（初回付与の取り消し・資格情報不正）のみ送出する。
PRD R-1 の受け入れ基準を更新し、[ADR-0007][adr7] / [ADR-0012][adr12] に amend のポインタを付けた。

## 検証

**コード変更なし**（実装は元からこの挙動）。doc 側だけを実装に合わせたため、
挙動の退行リスクがそもそも無い。[ADR-0043][adr43] のフェイクサーバーでも
「refresh 失効時の再取得」が往復として検証されている（[2026-08-09-01][run809]）。

[adr7]: ../../adr/0007-oauth-public-surface.md
[adr12]: ../../adr/0012-token-cache-refresh.md
[adr36]: ../../adr/0036-refresh-expiry-reacquire.md
[adr43]: ../../adr/0043-local-fake-server.md
[run3]: ../2026-06-22-03.md
[run809]: ../2026-08-09-01.md
