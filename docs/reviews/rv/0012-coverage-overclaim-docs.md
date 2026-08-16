# RV-12 🟢 roadmap/PRD の coverage 過大主張

- 重要度: 🟢 ／ 観点: ドキュメント
- 状態: fixed

## 概要

roadmap が「P0 = R-1〜R-15 すべて実装」「P1 すべて実装」と記すが、横断監査で **R-5（`order`/`keywords`/`itemstate`）が partial・R-4（Link/Image 正規化）が未実装・マルチテナント（`tenant(id)`／per-call `partition`）が未実装**と判明＝実態より過大。加えて R-4 は basic-design・roadmap で実質 future 扱いなのに **PRD 本文は P0 で名指し**＝PRD 内の不整合

## 根拠

`docs/design/roadmap.md:26-28`（P0/P1 全実装の主張）/ `docs/design/requirements.md:69-70`（R-4/R-5）/ `docs/design/basic-design.md:142`・`docs/design/roadmap.md:99`（Link/Image を future 扱い）。未実装サーフェスの一次根拠は [ADR-0033][adr33] 案F に集約

## 推奨

roadmap の coverage 節を実態へ訂正（R-5/R-4/multitenancy を partial・未実装と明記し ADR-0033 案F へリンク）。R-4 の「P0 名指し vs future 扱い」の不整合は PRD 側で解消（defer 明記 or スコープ縮小）。実装は ADR-0033 案F・**doc 訂正は本 finding**

## 処置

roadmap の P0 見出しを「R-1〜R-15 を実装」→「大半を実装・一部に積み残しあり（※）」に訂正（R-5/R-4/マルチテナントの積み残しは既存脚注＋ADR-0033 案F に集約済み）。PRD の R-4 を「Link/Image の正規化は v1 では未対応・deferred」と明示し、P0 名指し↔future 扱いの不整合を解消。0.3.0 プレリリース整備で対応

[adr33]: ../../adr/0033-post-mvp-direction.md
