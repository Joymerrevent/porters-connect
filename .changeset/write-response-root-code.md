---
"@joymerrevent/porters-connect": minor
---

Write 応答のルート `<Code>` を先読み（ADR-0045）: リクエストごと拒否された Write の Result Code が失われなくなりました。
従来は単件 write が「write returned no result item」（`category: "unknown"`）、一括 write が件数不一致エラーになっていましたが、
本当のコード（例 `102` → `validation`）が `PortersResourceError` として表面化します。成功パスは不変。挙動変更のため minor。
