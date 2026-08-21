# 46. 送信前ガードの例外契約（同期 throw か reject か）

- Status: accepted
- Date: 2026-08-09
- Deciders: jun.shiromoto (Joymerrevent)
- Implemented: 0.7.0

> [findings][findings] **RV-15** の是正案。Promise を返す公開メソッドの一部が、
> **Promise を返す前に同期 throw** する。[ADR-0024][adr24] が Transport 層で明示した原則と、公開リソース面がずれている。
> **decider が案A を選択し `accepted`（2026-08-09）**。実装は accept 後・別 PR。

## Context and Problem Statement

ライブラリは送信前にいくつかのガードを持つ（フェイルセーフ＝無駄な往復と不明瞭な 400 を避けるため）。
ところが**例外の届き方が経路によって違う**：

| ガード                                    | 実装位置                                     | 届き方         |
| ----------------------------------------- | -------------------------------------------- | -------------- |
| リクエスト長 ~15000 字                    | `src/http/requester.ts:83`（async 内）       | **reject**     |
| `keywords` 100 字超                       | `src/resources/query.ts:240`                 | **同期 throw** |
| `itemstate=deleted/all` の condition 制限 | `src/resources/query.ts:186`                 | **同期 throw** |
| Attachment 10MB 超                        | `src/resources/attachment.ts:200,214`        | **同期 throw** |
| 一括書き込みの単一レコード超過            | `src/resources/bulk-write.ts:58`（async 内） | **reject**     |

原因は評価順序で、`search()` は URL 組立（`buildReadUrl` → `appendReadQuery`）を **async 境界の外**で行う
（`src/resources/resource.ts:210-215`）。`attachment.create` も `guardContent` を Promise 生成前に呼ぶ。

実害は限定的だが確実にある：

- `porters.candidate.search(q).catch(handler)` は**同期 throw を捕まえられない**（`await` ＋ try/catch なら捕まる）。
- 「`Promise` を返す関数は throw しない」という一般的な期待に反する。型（`Promise<T>`）からは読み取れない。
- **プロジェクト自身が逆の原則を明文化している**: [ADR-0024][adr24] の `createMockTransport` は
  「Non-async on purpose: always return a Promise (resolve/reject) so an unmocked route rejects rather than
  throwing synchronously — faithful to the Transport contract」と書き、実装もそうしている。

問い: **公開メソッドの例外契約をどちらに統一するか。統一するとして、破壊的変更か。**

## Decision Drivers

- **least surprise / DX**: 「Promise を返すなら reject」で統一されている方が、利用者が書ける形が増える。
- **自己一貫性**: 同じライブラリ内で Transport 層と公開リソース面が逆の方針なのは説明がつかない。
- **フェイルセーフ**: 例外が想定外の場所（同期スタック）に飛ぶと、`catch` の網から漏れて unhandled になりうる。
- **後方互換**: `await` ＋ try/catch の利用者には影響ゼロ。`.catch()` だけの利用者には**修正**になる（今まで捕まえられなかった）。
- **薄さ**: 大掛かりな抽象を入れずに済む方法を選ぶ。

## Considered Options

- **案A: 公開メソッドを `async` にして reject に統一する**（推奨）
  `search`/`searchAll`/`get`/`create`/`update`/`createMany`/`updateMany`/Attachment/マスタ Read を `async` 化
  （または本体を `Promise.resolve().then(...)` で包む）。ガードの実装位置は変えない。
- **案B: ガードを requester 側（async 内）へ移す**
  クエリ検証を URL 組立から切り離し、リクエスト実行の内側で走らせる。
- **案C: 現状維持＋ドキュメント化**
  「設定ミスは同期 throw、通信起因は reject」と明記して、契約として認める。
- **案D: 同期 throw に統一する**
  逆方向。送信前ガードは全部同期 throw に揃える（requester のサイズガードも前倒し）。

## Decision Outcome

採用: **案A（公開メソッドを `async` にして reject に統一する）**。decider が 2026-08-09 に選択。

理由: 変更が**局所的**（関数を `async` にするだけ・ガードのロジックも位置も変えない）で、
[ADR-0024][adr24] が既に選んだ原則（Promise の契約に忠実）と揃う。案B はクエリ検証の実行位置が変わり、
「URL を組む前に弾く」という現在の設計意図（無駄な組立をしない）を薄める。

**破壊的変更ではない**と考える: 例外の種類・メッセージ・`category` は変わらず、届き方が「同期 → reject」に変わるだけ。
`await` 利用者は無影響、`.catch()` 利用者は**今まで漏れていた例外を捕まえられるようになる**（改善）。

**この ADR で確定する契約**: **`Promise` を返す公開メソッドは、いかなる理由でも同期 throw しない**。
設定ミス（`PortersConfigError`）も含め、すべて reject で届く。

実装時に守ること（accept 時の合意事項）:

1. **対象**: データ系リソース（`search` / `get` / `create` / `update` / `createMany` / `updateMany`）・
   Attachment（`search` / `get` / `create` / `update`）・マスタ Read（`search` / `current`）・
   `auth.exchangeAuthorizationCode` / `clearTokens` / `ensureAuthenticated` / `getToken`。
   **ガードのロジックと実装位置は変えない**（`async` 化＝例外の届き方だけを変える）。
2. **対象外（同期のままでよい）**: `Promise` を返さない API — `PortersClient` のコンストラクタ、`defineFields`、
   `auth.authorizationUrl` / `auth.revokeUrl`（`string` を返す）。ここは同期 throw が正しい。
3. **`searchAll` は既に問題ない**: `paginate` が async generator で、URL 組立は最初の `next()` 以降に走る
   ＝呼び出し時点では throw しない。**確認だけ行い、無用な変更はしない**（テストで固定する）。
4. **semver**: 観測可能な挙動が変わるため **minor** を既定とする（`patch` にはしない）。
   CHANGELOG に「`.catch()` で捕まえられるようになった／同期 throw を前提にしたコードは影響を受ける」を明記。
5. **テスト**: `expect(() => …).toThrow` を `rejects` へ書き換える（`test/integration/constraints.test.ts` ほか）。
   併せて「Promise を返す公開メソッドは同期 throw しない」を**横断的に確認するテスト**を 1 本置き、退行を防ぐ。
6. **ドキュメント**: [エラーハンドリング ガイド][guide]に「公開メソッドの例外は常に reject で届く」を明記する。

### Consequences

- Good: 公開面の例外契約が 1 つになる。`.catch()` が効く。ADR-0024 と一貫。
- Bad: 対象メソッドが多い（データ系 7 + Attachment 4 + マスタ 6）。テストの `expect(() => ...).toThrow` を
  `rejects` に書き換える必要がある（`test/integration/constraints.test.ts` ほか）。
- Neutral: `PortersClient` のコンストラクタなど**同期 API はそのまま同期 throw**（Promise を返さないので争点ではない）。

## Pros and Cons of the Options

### 案A: 公開メソッドを async 化

- Good: 局所的・意味論が明快・ADR-0024 と一致。
- Bad: 触るファイルは多い（機械的だが広い）。

### 案B: ガードを requester へ移動

- Good: 検証が 1 箇所に集まる。
- Bad: 「URL を組む前に弾く」意図が薄れる。クエリ検証は URL 組立の一部で、requester はクエリの意味を知らない
  ＝層を跨ぐ知識が増える（薄いラッパー方針に反する）。

### 案C: 現状維持＋明文化

- Good: 変更ゼロ。「設定ミスは即座に落ちる」という説明は一応成立する。
- Bad: 型から読み取れない契約を文書だけで支えることになる。ADR-0024 との不一致は残る。

### 案D: 同期 throw に統一

- Good: 「送信前に分かることは同期で落ちる」で一貫はする。
- Bad: requester のサイズガードは URL ＋ body 長を見るため、実行直前でしか判断できない箇所がある。
  Promise を返す API が throw する設計は一般的な期待に反し、ADR-0024 とも逆行。

## More Information

- 出典: [findings][findings] RV-15（`file:line` つきの根拠・検出経緯）。
- 影響範囲（accept 後の実装 PR）: `src/resources/resource.ts`・`attachment.ts`・マスタ 4 ファイル・
  `docs/guide/error-handling.md`（例外の届き方の記述）・該当テスト。
- 関連: [ADR-0024][adr24]（Transport の同契約）／[ADR-0005][adr5]（公開 API の形）／[ADR-0006][adr6]（エラーモデル）／
  [ADR-0038][adr38]（Read クエリ＝ガードの出所）。

[findings]: ../reviews/findings.md
[guide]: ../guide/error-handling.md
[adr5]: 0005-public-api-shape.md
[adr6]: 0006-error-model.md
[adr24]: 0024-mock-transport.md
[adr38]: 0038-read-query-surface-impl.md
