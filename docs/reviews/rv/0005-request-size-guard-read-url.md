# RV-5 🟡 送信前ガードの非対称

- 重要度: 🟡 ／ 観点: API 忠実性
- 状態: fixed

## 概要

送信前リクエスト長ガード（`MAX_REQUEST_LENGTH`）が `req.body` だけを検査するため、Read（GET）の URL 長は送信前に弾けない。ADR-0020 で field 省略時に既定 field を全送信するようになり Read URL が伸びた（さらに利用者が大きな明示 `field`/`condition` を渡せば一段伸びる）。約 15000 文字を超えても明確な `PortersConfigError` でなく不透明な server 400 に倒れる。ADR-0020 の Consequences(Neutral) は「リクエスト長超過時は既存の送信前ガードが働く」と記すが、その Read 経路は実際には未カバー

## 根拠

`src/http/requester.ts:75-87`（`req.body !== undefined` 前提＝GET は body 無しで素通り）/ `src/resources/resource.ts:127-132`（`defaultFieldList`）, `:229`（field 省略時に既定 field 送信）/ `docs/reference/resource-api/README.md:86`（「リクエスト全体の長さ ~15000 文字」＝GET は URL 全体が対象）/ `docs/adr/0020-read-field-default.md:83`（Consequences Neutral の当該記述）

## 推奨

いずれか — (a) ガードを Read URL 長にも適用（送信前に URL 長を ~15000 で検知し `PortersConfigError`）、(b) ADR-0020 の当該記述を「Read 経路は送信前ガード未カバー。現行カタログは小さく実害なし、将来 count API／大規模カタログ／巨大 field 指定時に再評価」へ訂正。現行 MVP カタログ（最大 Job=34 項目・既定 Read URL ~1.2KB）では未発火＝latent（今すぐ壊れる問題ではないが、フェイルセーフの中核ガードに非対称な穴があり ADR の記述が実装と食い違う）

## 処置

案(a)。送信前ガードを `requester.ts` で **URL + body の合算長**判定に変更（`req.url.length + (req.body?.length ?? 0) > MAX_REQUEST_LENGTH`）。Read（GET・body 無し）の URL 長も送信前に `PortersConfigError` で弾く。`unboundedBody`（Attachment アップロード）は従来どおり全体スキップ（write URL は短いため安全）。メッセージ/hint を read/write 両対応に一般化。Read URL 超過の回帰テスト追加（`requester.test.ts`）。本修正により ADR-0020 Consequences「既存の送信前ガードが働く」が Read 経路でも真になり、accepted ADR の改稿は不要
