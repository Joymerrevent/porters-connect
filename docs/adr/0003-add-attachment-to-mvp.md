# 3. MVP の対象リソースに Attachment を加える

- Status: accepted
- Date: 2026-06-13
- Deciders: jun.shiromoto (Joymerrevent)

> 案A で `accepted`（2026-06-13）。`CLAUDE.md` / `SPEC_v1.md` の MVP 記述へ反映済み。

## Context and Problem Statement

`SPEC_v1.md` 5.3 の MVP は **OAuth → Candidate → Job → Client → Process → Resume**（主要 5 リソース）で、
Attachment は「残りリソース（v0.2 以降）」に含めていた。
しかし実 API 接地（[[0002-ground-design-in-live-api-docs]]）で、Attachment の実用優先度が高いことが分かった。
Attachment を MVP に含めるべきか？

## Decision Drivers

- 最優先目標は「**多くの実利用者に使われること**」（収益化より普及）
- 既存 MVP リソースとの**結合度**（実需の連動）
- MVP を**膨らませすぎない**（薄く・堅く出す）
- 実装・テストコスト

## Considered Options

- 案A: Attachment を MVP に追加する
- 案B: 現状維持（MVP-5）。Attachment は v0.x 早期候補としてメモ
- 案C: 判断保留。公開 API / ロードマップの ADR で他リソースとまとめて優先度決定

## Decision Outcome

**採用: 案A**（Attachment を MVP に追加）。

- 添付＝**レジュメ/履歴書などのファイル**で、人材システムでの実需が高い。
- Attachment Read の必要スコープが **`candidate_r, resume_r, job_r, process_r, recruiter_r, client_r`** と
  **MVP リソースに密結合**。Candidate/Resume を扱う利用者はファイルも欲しくなる。
- 優先度は Sales / Contract / Opportunity より高いと判断。
- MVP 順序案: OAuth → Candidate → Job → Client → Process → Resume → **Attachment**（または Resume の直後）。

> ※ 反映先: `CLAUDE.md`「MVP 優先順」、`SPEC_v1.md` 5.3（反映済み）。

### Consequences

- Good: 実需の高いファイル連携を MVP で提供でき、普及目標に資する。
- Bad: MVP の実装範囲が 1 リソース増える（Base64・2MB 制限・Mime 検証）。
- Neutral: Attachment は項目が `Person.`/`Job.` のような接頭辞でなく短縮名（Id/Resource/…）で特殊（[resources/attachment.md][resources-attachment-md]）。

## Pros and Cons of the Options

### 案A: MVP に追加

- Good: 実需に直結。MVP リソースと結合度が高く一体で価値が出る。
- Bad: スコープ増。Image/Base64 の取り扱いが必要。

### 案B: 現状維持

- Good: MVP が最小のまま。出荷が速い。
- Bad: 「候補者は取れるがファイルは取れない」中途半端さが残り得る。

### 案C: 保留

- Good: 公開 API ADR で全体最適に決められる。
- Bad: 判断が先送りになり、設計時に都度ブレる。

## More Information

- 接地: [resources/attachment.md][resources-attachment-md]（項目・対応 MIME）、
  [write-format.md][write-format-md]（Image/Base64）。
- 関連: [[0002-ground-design-in-live-api-docs]], `SPEC_v1.md` 5.3, `CLAUDE.md`。

[resources-attachment-md]: ../reference/resource-api/resources/attachment.md
[write-format-md]: ../reference/resource-api/write-format.md
