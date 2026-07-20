# 43. ローカル フェイクサーバーの設計（忠実度ポリシー・提供形態・別パッケージ）

- Status: proposed
- Date: 2026-07-20
- Deciders: jun.shiromoto (Joymerrevent)

> [[0024-mock-transport]] の D7 が follow-up として本 ADR に送った「**ローカル フェイクサーバー（N2・アプリ無改変・
> 高忠実・コアと分離した別パッケージ）**」を設計する。roadmap 案C（**MCP の評価基盤・案A の加速**）に対応し、
> **MCP（案A）より先に着手**する方針（stakeholder 2026-07-20）。本 ADR は **忠実度ポリシー**を Decision の核に据え、
> 提供形態・パッケージ構成・`createMockTransport` との棲み分け・fixture 二重管理の回避を詰める。
> **`proposed`（decider の accept 待ち）。実装は accept 後・別 PR・別パッケージ。**

## Context and Problem Statement

**なぜ今か**: 実 PORTERS 契約が無く（ライブ検証 LV-1〜8 はブロック中）、評価は `docs/reference` の XML 例を
fixture にする段階に留まる。**layer-1 の結合テストも、次の主軸 layer-2（MCP・案A）の e2e 評価も、契約なしでは
回せない**。ローカル フェイクサーバーは、この詰まりを**プロジェクト全体で外す土台**になる（MCP 専用の付属物ではない）。

[[0024-mock-transport]] は評価ニーズを 2 つに分けた：

- **N1**（SDK 自身の単体テスト・自己完結サンプル）: 注入 seam で満たす → **`createMockTransport` で提供済み**（薄いスタブ・状態なし）。
- **N2**（利用者が自分のアプリを**無改変**でオフライン評価／本番に近い形）: seam 注入では満たせず、**`host` を向けるフェイクサーバー**が適任。**本 ADR＝N2**。

技術的前提（ADR-0024 D7 が指摘）: 本ライブラリは URL を `https://{PORTERS_HOST}/...` で組む（[[0009-http-transport]]）。
ローカルのフェイクへ HTTP で向けるには **localhost の http 許可 or 自己署名 TLS** への対応が要る＝コアの「薄く」に対して重い。

問い: **(a) どこまで忠実にするか（青天井の再実装を避けつつ評価に足る線）／(b) 提供形態（seam 注入 か 起動可能 HTTP サーバー か両方）／
(c) パッケージ構成／(d) `createMockTransport` との棲み分け／(e) fixture・ワイヤ形状をライブラリと二重管理しない方法**。

## Decision Drivers

- **評価可能性**: 契約なしで L1 結合テスト・L2（MCP）e2e をオフラインで回せる。
- **接地・忠実**（[[0002-ground-design-in-live-api-docs]]）: 「実 PORTERS」ではなく **`docs/reference` に忠実**。分かっている範囲を身の丈で再現。
- **フェイルセーフ**: reference が黙る挙動は**明示的な仮定**として実装し **LV 項目**に落とす（契約取得後に検証）。異常系のための**注入**を持つ。
- **薄く・堅く / コア非結合**: フェイクは**別パッケージ**。コア（`porters-connect`）は薄いまま（[[0024-mock-transport]] の方針継承）。
- **creep 回避**: 忠実度を「**layer-1 が実際に叩く範囲**」に固定（＝既存コード＋reference で一意に決まり、MCP 設計を待たない）。
- **二重管理の回避**: ワイヤ形状・fixture はライブラリと単一ソースを共有（フォークしない）。

## Considered Options

**主軸＝忠実度レベル**:

- **案A: 軽量**（評価に足るだけの最小応答）。
- **案B: ある程度忠実**＝**契約面は高忠実・業務面は浅い・接地に忠実・注入つき**（**推奨**）。
- **案C: 厳密再現**（PORTERS のクローンを目指す）。

（従属する設計軸＝提供形態・パッケージ・棲み分け・fixture は Decision Outcome で扱う。）

## Decision Outcome

**採用: 案B（ある程度忠実）**（stakeholder が 2026-07-20 に選択）。`accepted` は decider の明示承認を待つ。

### 忠実度ポリシー（この ADR の核）

**高忠実にする面（＝ライブラリが実際に「契約」している所）**:

- **XML ワイヤ形状**: パーサが食える／エンコーダが出す XML と互換（妥協不可）。
- **独自 OAuth**: `X-porters-hrbc-oauth-token`・`code`/`code_direct`・**code 30 秒失効**・トークン TTL／refresh（[[0007-oauth-public-surface]]/[[0012-token-cache-refresh]]/[[0036-refresh-expiry-reacquire]]）。
- **エラーの語彙**: 実 result code／エラー XML 形状を返し `PortersError`＋`category` を刺激（[[0006-error-model]]）。
- **制約のトリガ**: ~15000 字 → 400／200 件超 → 分割要求／レート → 429・スロットル（[[0010-retry-throttle]]）。requester のガード・retry・throttle を実際に発火。
- **状態を持つ CRUD 往復**: `create → read → update` が成立するインメモリ store（**削除 API は無い**＝honor 容易）。フィールド型（P_/U_/A_・Option 複数選択・User/Reference・DateTime）も往復。

**あえて浅くする面（＝「ある程度」の境界）**:

- 業務ロジック・検索の関連度/並び・網羅的な値バリデーション・MVP 外リソース・性能特性・**reference が言及しない挙動**。

**原則**: **接地に忠実**（reference が正）。黙っている所は**明示的な仮定**＝実装コメント＋**LV 項目**化。**注入を第一級**に（決定的に 400・rate・特定 code・遅延を出せる）＝静的 fixture に対するフェイクの勝ち筋。

### 従属する設計軸（recommended・proposed）

- **D-提供形態**: **「挙動コア」を1つ実装し、2 つのアダプタで露出**（推奨）。
  - (1) **状態あり Fake `Transport`**（インプロセス・[[0009-http-transport]] の seam に注入）＝ L1 結合テスト・SDK テスト向け。**TLS/https 問題を回避**でき最速・決定的。
  - (2) **起動可能な HTTP サーバー**（`host` を向ける）＝ N2（アプリ無改変）・**MCP の e2e**（別プロセスが HTTP で叩く）向け。**外部消費が要る＝package 昇格（D-パッケージ）と対で**用意する（近い需要は L1 なので (1) を先行）。
  - 1 つの挙動コア → 2 アダプタで、片方に寄せず**再利用最大化**。
- **D-localhost/https**: HTTP サーバー・アダプタは **http（localhost）と自己署名 TLS の両対応**を検討。ライブラリ側で localhost に http で向けられるか（`PORTERS_HOST`＋スキーム設定）を確認し、必要なら**コアに小さな設定 seam**を足す（別途・最小）。L1 はインプロセス Transport で https 問題を踏まない。
- **D-パッケージ**: **まず in-repo・dev-only**（このリポジトリ内・`src/` の外＝例 `test/fake/`）。既存設定で**公開 tarball 非同梱**（`files` は `dist` のみ）かつ**カバレッジ対象外**（coverage include は `src/**` のみ・perFile 100%）＝**追加設定なしで満たす**。`test/fixtures` を直接流用しドリフトを断つ。
  - ADR-0024 の「**コア非結合・薄く**」の本質は「**公開物に混ぜない**」ことで、**別 npm package は必須でない**。in-repo・dev-only で満たしつつ、この repo の開発（L1 結合テスト）に最も便利（stakeholder 2026-07-20）。
  - **昇格可能に保つ**: 公開サーフェス／共有 fixtures 境界で実装し、**MCP e2e／N2 配布の需要が出たら** workspace/公開 package へ昇格（名称候補 `@joymerrevent/porters-fake`。「mock」は `createMockTransport` と紛らわしいため **fake** で区別）。**monorepo 化の是非は昇格時に判断**（`porters-mcp` の配置＝案A と併せて・今は決めない）。
- **D-棲み分け（`createMockTransport`）**: **`createMockTransport`＝薄い・状態なし・N1**（[[0024-mock-transport]]）／**Fake＝状態あり・高忠実・N2＋e2e**。両者は `Transport` 契約型を共有。README/ガイドに「いつどちらを使うか」を明記。
- **D-fixture 共有**: ワイヤ形状は**ライブラリの encode/parse・`docs/reference` の XML 例を単一ソース**として共有（フェイクで手書きせず、可能な範囲で `porters-connect` に依存 or 共有 fixtures モジュール）。**ドリフト防止**。

### Consequences

- Good: 契約なしで **L1 結合・L2（MCP）e2e** をオフライン化。忠実度の**強制関数**（理解のズレを MCP 前に炙り出す）。注入で異常系テストが可能。**コアは薄いまま**（in-repo・dev-only＝`src` 外・tarball 非同梱）。**monorepo ツールを今は導入しない**（just-released な単一パッケージ構成を揺らさない＝小さな blast radius）。
- Bad: **https/localhost 対応**の重さ（HTTP サーバー・アダプタ＝昇格時）。API 理解の追随という保守コスト。昇格時に **extraction が要る**（ただし公開サーフェスで作れば機械的）。
- Neutral: 忠実度を reference に固定するため、**未文書の挙動は LV 項目**として明示的に残る（フェイルセーフ・後で契約検証）。

## Pros and Cons of the Options

### 案A: 軽量

- Good: 実装が最小・すぐ。
- Bad: 制約・エラー・状態往復を再現できず、**MCP の e2e にも L1 結合にも力不足**。北極星（評価可能性）に届かない。

### 案B: ある程度忠実 ← 採用

- Good: 契約面（XML/OAuth/エラー/制約/CRUD 往復）を高忠実に再現し、**評価に十分**。業務面を浅くし **creep を回避**。接地に固定でき身の丈。
- Bad: 軽量より実装が要る。忠実度の線引きを規律で守る必要（本ポリシーで固定）。

### 案C: 厳密再現

- Good: 最も本物に近い。
- Bad: **PORTERS の再実装**＝肥大化・保守崩壊。契約が無い以上、reference を超える忠実度は**検証不能な想像**になり接地方針に反する。

## More Information

- 直接の親: [[0024-mock-transport]] D7（本 ADR はその follow-up）／N1=`createMockTransport`・N2=本フェイク。
- 接地/前提: [[0009-http-transport]]（Transport seam・`https://` URL 組立）／[[0002-ground-design-in-live-api-docs]]（reference が正）／[[0006-error-model]]／[[0010-retry-throttle]]／[[0007-oauth-public-surface]]。
- 位置づけ: [[0033-post-mvp-direction]] 案C（MCP 評価基盤）→ 案A（MCP）。未文書挙動は [live-verification][lv] へ。
- 実装（accept 後・別 PR）: **まず in-repo・dev-only**（`test/fake/`）に挙動コア＋**Fake `Transport` アダプタ**→ L1 結合テスト・注入 API・`test/fixtures` 共有・`createMockTransport` との棲み分けを README/ガイドへ。**HTTP サーバー・アダプタ＋package 昇格（pnpm workspace / monorepo 判断）は N2・MCP e2e の需要時**。

[lv]: ../live-verification.md
