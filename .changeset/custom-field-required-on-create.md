---
"@joymerrevent/porters-connect": minor
---

カスタム項目を宣言で `create` の必須にできるようになりました（`f.number({ required: true })`）。`generateFieldDecls` はテナントの入力必須（`P_Required`）を写し、`verifyFields` は食い違いを `requiredMismatch` で報告します（ADR-0089・RV-62）。

`FieldVerification` に `requiredMismatch` が増えたので、報告を自分で組み立てているコード（テストのスタブなど）は `requiredMismatch: []` を足してください。
