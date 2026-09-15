# RV-45 🟢 Attachment だけ `searchAll` が無く、無い理由も残っていない

- 重要度: 🟢 ／ 観点: 機能網羅 / ドキュメント
- 状態: open

## 概要

Read を持つ 17 エンドポイントのうち、**`searchAll` が無いのは Option と Attachment の 2 つ**。
Option は理由がはっきりしている（PORTERS 側に `start` が無く、オフセット式のページングができない）。
**Attachment は `start` を取れるのに `searchAll` が無く、置かなかった理由がどこにも書かれていない。**

## 根拠

実測（2026-09-15・[エンドポイント × 機能マトリクス][coverage] 表 D）。

| エンドポイント   | `start`  | `searchAll` | 無い理由                   |
| ---------------- | -------- | ----------- | -------------------------- |
| `/v1/option`     | 無し     | 無し        | ページングできない（表 A） |
| `/v1/attachment` | **有り** | **無し**    | **記録なし**               |

- `AttachmentSearchQuery` は `count` / `start` を持ち、`buildAttachmentReadUrl` は両方を送る
  （`src/resources/attachment.ts`）。ページングは成立する。
- [ADR-0018][adr18]（Attachment の設計）は公開メソッドを `create` / `get` / `search` と書き、
  `searchAll` に触れていない。当時はまだ `searchAll` がどのリソースにも無かった
  （オフセット走査は後から汎用 factory に入った）ので、**意図的に外したのではなく、
  横展開のときに素通りした**可能性が高い。
- 利用者向けドキュメントは「`t.attachment` は **`searchAll` なし**」と事実だけ書いており
  （[docs/usage/index.md][index]）、理由は書いていない。

## 影響

**小さい。** 添付が 200 件を超えるテナントで、利用者が `start` を自分で回す必要がある
（`search({ count: 200, start })` で回せるので、できないことは無い）。
ただし他の 15 エンドポイントと**語彙が揃っていない**ので、使う側は毎回ここで例外を覚える。

## 検出経緯

V1（機能網羅）のマトリクスを起こす過程（2026-09-15）。「エンドポイント × 操作」を並べたら、
**理由の無い空白セルが 1 つだけ残った**。項目の軸（D1〜D5）では見えない種類の穴で、
操作の軸を表にして初めて見えた。

## 推奨

**どちらかに決めて、決めたことを残す。**

- **足す**なら、汎用 factory の `searchAll` と同じ形（`paginate` で 200 件ずつ）を
  `attachment.ts` に置く。ただし `field` の既定が本体（`Content`）を含まないことが前提
  （[ADR-0020][adr20]）＝全件走査しても巨大な Base64 は流れてこない。
- **足さない**なら、理由を ADR に残す（[ADR-0041][adr41] 軸5 が一括書き込みで同じ判断をしている
  ＝「本体が巨大なので全件を一気に扱わせない」で揃うなら、その線）。

**決める前に 1 つ確かめること**: `searchAll` を足すと、既定の `field`（メタデータのみ）で
ページングすることになる。本体が要るときは `get(id)` を回すことになるので、
「一覧 → 本体を個別取得」の形をドキュメントで示せるかどうかも一緒に見る。

[coverage]: ../../design/endpoint-coverage.md
[adr18]: ../../adr/0018-attachment-design.md
[adr20]: ../../adr/0020-read-field-default.md
[adr41]: ../../adr/0041-bulk-write-surface-impl.md
[index]: ../../usage/index.md
