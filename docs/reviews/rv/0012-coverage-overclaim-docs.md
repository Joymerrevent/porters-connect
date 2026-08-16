# RV-12 🟢 roadmap / PRD が実装カバレッジを過大に主張していた

- 重要度: 🟢 ／ 観点: ドキュメント
- 状態: fixed

## 概要

roadmap が「P0 = R-1〜R-15 すべて実装」「P1 すべて実装」と記していたが、横断監査で
**R-5（`order` / `keywords` / `itemstate`）が partial・R-4（Link/Image 正規化）が未実装・
マルチテナント（`tenant(id)` / per-call `partition`）が未実装**と判明した。
加えて R-4 は basic-design と roadmap では future 扱いなのに、**PRD 本文は P0 で名指し**していた
（PRD 内部の不整合）。

## 根拠

- `docs/design/roadmap.md:26-28` — P0/P1 全実装の主張。
- `docs/design/requirements.md:69-70` — R-4 / R-5 の記述。
- `docs/design/basic-design.md:142`・`docs/design/roadmap.md:99` — Link/Image を future 扱い。
- 未実装サーフェスの一次根拠は [ADR-0033][adr33] 案F に集約。

## 影響

**計画の正典が実態より良く見えている**状態。次に何をやるかを roadmap で判断する運用なので、
過大主張は「もう終わっている」という誤った前提を作る。実際、この監査が無ければ
案F（v1 公開 API の積み残し）は起票されなかった。
コードには影響しないため 🟢 だが、**計画の信頼性**という意味では軽くない。

## 検出経緯

横断監査 [2026-06-22-03][run3]。3 つの監査が収束し、
「案F は氷山の一角で、accepted ADR / P0 要件が約束した v1 公開 API の未実装が複数ある」と分かった。
未実装サーフェス（A 群）は [ADR-0033][adr33] 案F へ、**doc の過大主張（B 群）は本 finding へ**振り分けた。

## 推奨

roadmap の coverage 節を実態へ訂正し（R-5 / R-4 / マルチテナントを partial・未実装と明記して
[ADR-0033][adr33] 案F へリンク）、R-4 の「P0 名指し vs future 扱い」の不整合は PRD 側で解消する
（defer 明記 or スコープ縮小）。**実装は案F・doc 訂正は本 finding**と役割を分ける。

## 処置

roadmap の P0 見出しを「R-1〜R-15 を実装」→「大半を実装・一部に積み残しあり（※）」に訂正した
（積み残しの内訳は既存の脚注 ＋ [ADR-0033][adr33] 案F に集約済み）。
PRD の R-4 を「Link/Image の正規化は v1 では未対応・deferred」と明示し、
P0 名指し ↔ future 扱いの不整合を解消した。0.3.0 のプレリリース整備で対応。

## 検証

roadmap / PRD / basic-design の 3 者で R-4・R-5・マルチテナントの記述が一致することを確認。
その後 R-5 は F-2（0.4.0）、マルチテナントは F-3（0.5.0）で実際に埋まり、
**残るのは R-4 のみ**という状態まで追跡できている。

[adr33]: ../../adr/0033-post-mvp-direction.md
[run3]: ../2026-06-22-03.md
