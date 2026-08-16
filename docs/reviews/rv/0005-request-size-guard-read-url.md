# RV-5 🟡 送信前の長さガードが Read の URL を見ていない

- 重要度: 🟡 ／ 観点: API 忠実性
- 状態: fixed

## 概要

送信前のリクエスト長ガード（`MAX_REQUEST_LENGTH`）が **`req.body` の長さだけ**を検査していた。
Read（GET）は body を持たず `field` / `condition` は URL に載るため、**Read 経路は素通り**する。
正典は「リクエスト**全体**の長さ 約 15000 文字」なので、GET では URL 全体が対象のはずだった。

## 根拠

- `src/http/requester.ts:75-87` — `req.body !== undefined` 前提の判定＝GET は body 無しで素通り。
- `src/resources/resource.ts:127-132`（`defaultFieldList`）, `:229` — [ADR-0020][adr20] で
  `field` 省略時に既定 field を全送信するようになり、**Read URL が伸びた**。
- `docs/reference/resource-api/README.md:86` — 「リクエスト全体の長さ ~15000 文字」。
- `docs/adr/0020-read-field-default.md:83` — Consequences(Neutral) が
  「リクエスト長超過時は既存の送信前ガードが働く」と記すが、**Read 経路は実際には未カバー**
  ＝ ADR の記述と実装が食い違っていた。

## 影響

超過時に明確な `PortersConfigError` ではなく、**不透明なサーバー 400** に倒れる。
利用者は「なぜ 400 なのか」を自力で切り分けることになる。
現行 MVP カタログは小さいため（最大 Job = 34 項目・既定 Read URL 約 1.2KB）**未発火＝latent** だが、
**中核のフェイルセーフに非対称な穴**がある状態で、かつ **accepted ADR の記述が実装と食い違う**
（決定の信頼性が落ちる）ため、退行追跡として起票した。将来 count API・大規模カタログ・
巨大な `field` 指定が入れば発火する。

## 検出経緯

[2026-06-17-01][run1] Run 2。[ADR-0020][adr20] の実装確認中に、
「既定 field で URL が伸びたなら、長さガードは効くのか」を辿って判明した。
ADR の Consequences に書かれた保証が実際には成立していないことも同時に分かった。

## 推奨

いずれか — (a) ガードを **Read の URL 長にも適用**する（送信前に検知して `PortersConfigError`）、
(b) [ADR-0020][adr20] の当該記述を「Read 経路は未カバー」と訂正する。
(a) なら ADR の記述が真になるので、追加の ADR 改稿は要らない。

## 処置

案 (a)。`src/http/requester.ts` のガードを **URL + body の合算長**判定に変更した
（`req.url.length + (req.body?.length ?? 0) > MAX_REQUEST_LENGTH`）。
Read（GET・body 無し）の URL 長も送信前に `PortersConfigError` で弾く。
`unboundedBody`（Attachment アップロード）は従来どおり全体スキップ（write URL は短いので安全）。
メッセージと hint を read / write 両対応に一般化した。

## 検証

- Read URL 超過の回帰テストを `src/http/requester.test.ts` に追加。
- 本修正により [ADR-0020][adr20] Consequences の「既存の送信前ガードが働く」が
  **Read 経路でも真になった**ため、accepted ADR の改稿は不要と判断した。
- [ADR-0043][adr43] のフェイクサーバーが `~15000 字 → 400` をサーバー側でも再現しており、
  **送信前ガードとサーバー拒否の両側**が `test/integration/constraints.test.ts` で検証されている。

[adr20]: ../../adr/0020-read-field-default.md
[adr43]: ../../adr/0043-local-fake-server.md
[run1]: ../2026-06-17-01.md
