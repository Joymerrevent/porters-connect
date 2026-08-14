---
"@joymerrevent/porters-connect": minor
---

HTTP 200 で返る「PORTERS 以外の応答」を 0 件として扱わなくなりました（ADR-0051）: Read 応答は**ルート要素名（リソース名）と `<Code>` の両方**で同定し、
どちらかを欠くボディは `PortersResourceError`（`category: "unknown"` ＋ `httpStatus: 200` ＋ 中間装置を疑う `hint`）で拒否します。
従来はキャプティブポータル・SSO のログイン画面・WAF の通知ページ（いずれも HTTP 200）が `total: 0` の正常な空ページとして返っており、
`get(id)` が `undefined` を返すため「無ければ作る」コードが重複レコードを作りにいく状態でした（データが無いのか届いていないのかを区別できない）。
メッセージは原因を名指しします — `resource response root is <html>, expected <Candidate>` ／ `resource response has no <Code> (not a PORTERS envelope)`。
正しい PORTERS 応答に対する挙動は変わりませんが、観測可能な挙動が変わる（0 件 → 例外）ため minor。
`createMockTransport` でモックを手書きしている場合は、ボディにリソース名のルート要素と `<Code>` が必要です。
