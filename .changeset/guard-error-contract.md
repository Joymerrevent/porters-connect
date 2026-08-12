---
"@joymerrevent/porters-connect": minor
---

例外の届き方を reject に統一（ADR-0046）: **`Promise` を返す公開メソッドは、いかなる理由でも同期 throw しなくなりました**。
これまで `keywords` 100 字超・`itemstate` の制限違反・Attachment 10MB 超は Promise を返す前に同期 throw していたため、
`porters.candidate.search(q).catch(handler)` では捕まえられませんでした。今後は設定ミスも含め常に reject で届きます。
ガードのロジックと実装位置は不変（送信前に弾く点は変わりません）。`await` ＋ try/catch の利用者は無影響、
同期 throw を前提にしたコード（`expect(() => …).toThrow` 等）は修正が必要です。挙動変更のため minor。
