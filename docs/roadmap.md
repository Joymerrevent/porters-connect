# ロードマップ / 現況棚卸し

- ステータス: living（随時更新）
- 最終更新: 2026-08-30
- 位置づけ: **「次に何をやるか」を確認する入口**。プロジェクト横断の「着手可能 / 待ち / 完了 / 将来」を 1 枚で見渡す。
  要件の正は [requirements][prd]（PRD）、決定の正は [docs/adr][adr]、レビュー指摘の正は [findings][findings]、
  契約後に確定する仮定は [live-verification][lv]。本書はそれらへの**インデックス＋進捗ビュー**であり、
  詳細・根拠は各正典を参照する（重複させない）。

---

## ▶️ いま何をやるか

**次の主軸が決まった**（2026-08-30・[ADR-0060][adr60]）。**「全リソース網羅 ＋ ドキュメント充実」**へ舵を切り、
[ADR-0033][adr33]（案A＝第2層 MCP 主軸）は **supersede** した。進め方は **リソース 1 種＝1 PR**
（実装・テスト・reference 突合・ドキュメントを同じ PR で出す）。完了条件は **D1〜D5**（下記「📊 完成度」）。
品質ゲートは全 green（**782 tests**・coverage は perFile 100%）。

### 着手可能（ブロック無し・上から順に）

- [x] **1. Recruiter の R/W**（[ADR-0060][adr60] D1 の 1 本目）＝ **実装済み・未リリース**。
      **横展開のものさしとして機能した** — 実装は `src/resources/recruiter.ts` **114 行**（Client の 89 行 ＋ 参照 1 本）で、
      新しい抽象は 1 つも要らなかった。**descriptor パターンは効く**と確認できたので、残り 5 種
      （Phase を除く）は同じ手数で見積もってよい。**横展開でぶつかったのは既存テストの前提**のほう
      （「Recruiter は未実装」を書いたテストが 4 件・型テストが 1 件）＝新リソースごとに同じ棚卸しが要る。
      副産物として **`Job.P_Recruiter` / `Process.P_Recruiter` が `expand` 可能**になった（参照先カタログが揃ったため）
- [x] **2. Contact** ＝ **実装済み・未リリース**。Recruiter と**項目構成が完全に同一**だったので、
      カタログを写して prefix / path を変えるだけで済んだ。共通化はしていない（別リソースである事実を
      2 つのカタログで保つ）が、「同一であること」自体をテストに書いて将来の乖離を検出できるようにした。
- [x] **3. Opportunity** ＝ **実装済み・未リリース**。12 項目で最小。
      **`P_Deleted` を持たない唯一のデータ系リソース**（PORTERS が公表していない）なので、
      突合テストの前提を「必ずある」から「**reference と有無が一致する**」へ両方向の検査に変えた
      ＝揃えたくなって無いものを足す事故を仕組みで防ぐ。
- [x] **4. Activity** ＝ **実装済み・未リリース**。`P_Resource`（Resource List の数値 ID）と
      `P_ResourceId` の組で任意の上位リソースに紐づく。**参照先が実行時に決まる**ので
      `expand` の対象にはできず（どのカタログで読むか型で決められない）、参照先 ID として読む形にした。
      **ADR は不要だった** — 既存の「参照先カタログが無いものは ID のまま」と同じ扱いに収まり、
      新しい決定を要さなかった（ADR-0060 が「要 ADR の可能性」としていた論点はここで解消）。
- [x] **5. Contract** ＝ **実装済み・未リリース**。39 項目で最大。
      **`P_Owner` を持たない唯一のデータ系リソース**なので `create` の必須は `P_Client` だけ。
      `Currency` の 3 項目は **Data Type が `Number`**（Field Type と Data Type は別の軸）なので
      **新しいデータ型は不要**だった＝ D3 の 14/17 は動かない。
- [x] **6. Sales** ＝ **実装済み・未リリース**。**参照 6 項目すべてが `expand` 可能**。
      **`create` の必須は `P_Owner` のみ**にした — 参照 6 項目は reference で `●` でなく **`※`（条件付き必須）**で、
      実体は依存の連鎖（`P_Job` → `P_Recruiter` → `P_Client` ← `P_Contract`）。フラットな必須リストでは表せず、
      一律必須にすると**サーバーが受ける呼び出しを手前で弾く**＝危険側に倒れる。
      **この判断は ADR にしていない**（既存の「手前で厳しくしすぎない」方針の適用に留まるため）。
      形式化したい場合は要起票 — 公開型 `SalesCreateInput` の形に効く判断ではある。
      併せて **`docs/guide/write-constraints.md` を新設**（D5）。
- [x] **7. Phase の実装** ＝ **実装済み・未リリース**。設計は [ADR-0061][adr61]（accepted 2026-08-31）。
      決定は **案1a ＋ 案2a ＋ 案3a ＋ 案4a ＋ 案5b**:
      `prefix: ""` を汎用 factory が受ける（＋ 主キー alias も descriptor から取る＝**共有コード 9 箇所**）／
      `t.phase.of("client")` で `resource` を束ねる／`System[Department]` に `DepartmentRef` を足す／
      Write の最新フェーズ条件は PORTERS に委ねる／`resource` は**リテラル名**で受ける。
      完了すれば **D1 が 13/13**、D3 が 14/17 → **15/17**。
- [ ] **分岐して起票する ADR**: ① ~~Phase の公開サーフェス~~ → [ADR-0061][adr61] で accepted ／
      ② `Link` / `Image` ＋ `defineFields` builder（＝ R-4 の積み残し・D3）／
      ③ マスタ項目の拡張（`System[Department]` の decode 形は 0061 で確定したので残りは項目の追加）／
      ④ **`Activity.P_Resource` を名前で受けるか**（0061 の案5b で `of()` は名前になったため、
      カタログ項目側との非対称をどうするか）

#### 直近の経緯（着手前に踏まえておくこと）

- ✅ **[ADR-0059][adr59] 実施済み・0.11.0 で公開**。`field` は接頭辞なしの型付き alias になり、
  綴り間違い・接頭辞付き・展開文字列がコンパイル時に止まる。**公開 API の破壊的変更**を含む。
- ✅ **[ADR-0058][adr58] 実施済み・0.11.0 で公開**（**RV-31 は fixed**）。型付き `expand` で
  参照先の項目が 1 往復で取れる。raw `field` の展開は送信前に弾いて `expand` へ誘導する
  （0059 で型でも書けないので**多層防御**）。
- **R-4 の Link / Image** は要 ADR。[ADR-0060][adr60] の **D3 に取り込まれた**ので「随時・任意」ではなくなった。
- **[LV-16][lv] に `VERIFY(live)` を設置済み**（`src/resources/expand.ts` の `expandEntry`）。
  外れても直すのは要求文字列だけ。
- ✅ **`pnpm changeset:version` は復旧済み**（2026-08-23・**`@changesets/cli` を 2.31.1 → 3.0.0 へ上げた**）。
  落ちていたのは `pnpm.overrides` の `js-yaml: ">=4.2.0"` が changesets の推移依存 `read-yaml-file@1.1.0`
  （`js-yaml: ^3.6.1` を宣言）にも効き、同パッケージが呼ぶ **js-yaml v3** の API（`yaml.safeLoad`）が
  **js-yaml v4** 以降で削除されていたため。**changesets v3** では `read-yaml-file` が依存から消えるので衝突しない。
  **override をスコープで緩める案は採らなかった** — `>=4.2.0` という指定は **js-yaml v3** 全体が対象の
  advisory を示唆するため、脆弱な版を意図的に呼び戻すことになる。
  仕様変更 2 点は [runbook][rb] に記載（**changeset が 0 枚だと exit 1**／**Node 22.11+ が必要**）。
  **時系列は「版上げで壊れた」ではなく「導入初日から動いていなかった」**（override が 2026-06-19・
  changesets 導入が 2026-06-20）＝下記リリース記録の注記を参照。
  📌 **紛らわしいので注意**: 上には無関係な「v3」が 2 つ出てくる。**js-yaml v3** は古く脆弱な版
  （`safeLoad` を持つ・戻してはいけない側）、**changesets v3** は最新版（上げた側）。
  今回やったのは **changesets の版上げ（2 → 3）**であって、**js-yaml のダウングレード（4 → 3）ではない**。
- **RV-22**（429 後に `create` を再送しない）は**まだ着手しない** — 実 PORTERS では発火しない（レート超過は強制切断）。
  429 が観測できるか自体が LV-9 の確認事項なので、契約後に判断する。
- **0.11.0 を公開済み**（2026-08-30）。**破壊的変更**（Read の `field` は接頭辞なし・[ADR-0059][adr59]）を含む。
  併せて **`expand` で参照先の項目が 1 往復で取れる**ようになった（[ADR-0058][adr58]・RV-31）。
  ひとつ前の 0.10.0（2026-08-22）も破壊的で、`partition` を `tenant(id)` 経由のみにし（[ADR-0055][adr55]）、
  **`P_Deleted` で削除済みを判別できる**ようにし（[ADR-0056][adr56]・RV-26）、
  `itemstate` の明示指定をそのまま送るようにした（[ADR-0057][adr57]）。
  **未リリースの変更は無し**（`.changeset/` は空）。

### 随時・任意（急がない）

- ✅ **R-4 の積み残し（Link / Image 型の正規化）は「随時」から外れた** — [ADR-0060][adr60] の **D3**
  （データ型 17/17）に取り込まれ、主軸の完了条件になった。以下は経緯として残す。
  [PRD R-4][prd] で **v1 未対応・deferred** と明記。**訂正（2026-08-16）**: 旧記載は「カスタム項目側の
  Image 対応は案D＝別物」としていたが、reference 実測で**標準 `P_` 項目に Link / Image を使うリソースは
  18 本中 0 件**と判明した。この 2 型は**カスタム項目（`U_`/`A_`）経由でしか現れない**＝ R-4 と案D の
  Image 対応は**同一層の同一作業**。`DataType` に足すだけでは誰も宣言できないので、
  **`defineFields` の builder への露出まで 1 本の ADR で**扱う
- [ ] 案D `defineFields` 深掘りの**残り**（値レベルの実行時検証・テナント実在チェック・Field Read からの宣言生成。[ADR-0023][adr23]）。
      値検証は**契約前に厳しくしすぎない**（サーバーが受けるものを手前で落とすと安全側でなく危険側に倒れる）＝ opt-in 前提
- [ ] （任意）README 英語版（日本語ファースト → 英語）

### 待ち（自分では進められない）

| 待ちの種類   | 中身                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------- |
| **契約待ち** | ライブ検証 **LV-1〜17**（[live-verification][lv]）。リリースのブロッカーではない                    |
| **需要待ち** | フェイクサーバー **フェーズ7**（package 昇格・配布。[実装計画][fake-plan]・stakeholder 2026-08-09） |
| **判断待ち** | PRD [§8][prd] オープン論点 **2 件**（次の主軸は [ADR-0060][adr60] で決着）                          |

### TODO の見取り図（どこを見れば何が分かるか）

TODO は役割ごとに分かれている。**本書が入口**で、詳細は各正典にある。

| ファイル                      | 何の TODO か                                 | いまの状態                               |
| ----------------------------- | -------------------------------------------- | ---------------------------------------- |
| **本書**（roadmap）           | **次に何をやるか**（着手可能 / 随時 / 待ち） | 着手可能＝[ADR-0060][adr60] D1 の 1 本目 |
| [findings][findings]          | レビュー指摘の処置台帳（RV-N）               | open 2 件 = RV-22（契約待ち）/ RV-32     |
| [docs/adr][adr]               | 【accept 済み・実装済み】＋論点バックログ    | proposed **なし**／実装待ちは 0060・0061 |
| [live-verification][lv]       | 契約取得後に実機確認する仮定（LV-N）         | LV-1〜17 が未確認（契約待ち）            |
| [フェイク実装計画][fake-plan] | フェイクサーバーのフェーズ別チェックリスト   | フェーズ0〜6 完了・フェーズ7 のみ未着手  |
| [release-runbook][rb]         | リリース手順のチェックリスト                 | 毎回使う手順書（常時 unchecked）         |

> GitHub Issues は使っていない（現在 0 件）。TODO の正典は上記のとおり `docs/` 配下にある。

---

## 📊 完成度（実装カバレッジ）

「どこまで完成しているか」の実測（2026-08-31 に再実測。初出は 2026-08-16 の[レビュー][run816]）。
**この 5 行が [ADR-0060][adr60] の完了条件 D1〜D5** ＝「網羅した」を主張でなく**検査結果**で言えるようにしたもの。

| ID  | 軸                         | 現在地                    | 目標と残り                                                                                                                        |
| --- | -------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **データ系リソースの R/W** | **13 / 13** ✅            | 完了。最後の Phase は [ADR-0061][adr61] の決定どおり汎用 factory に載せた                                                         |
| D2  | **マスタ Read の標準項目** | User 4/17 ほか            | → 全項目。Field 9/10（`P_ResourceType` 欠）・Option 6/7（`Items` 欠）・Partition 3/3 済。「マスタ 4/4」は**リソース単位**の数え方 |
| D3  | **データ型網羅**           | **15 / 17**               | → 17/17。残るは `Link` / `Image`（R-4・カスタム項目経由でのみ出現）。`System[Department]` は 0061 で対応（Read のみ）             |
| D4  | reference ↔ カタログ突合   | **データ系 13 / 13** ✅   | 完了。`P_Deleted` の有無も両方向で検査し、行パーサは接頭辞なし（Phase）にも対応した                                               |
| D5  | **ドキュメント**           | README ＋ **ガイド 7 本** | 各 PR で追従済み（リソース表・`expand` 表・新規必須の一覧・カスタム項目の対象）。新設は `write-constraints.md`                    |

**API 機能網羅は別枠で実質完成** ✅ — Read 8 パラメータ・Write・一括・ページング・OAuth 2 方式・
マルチテナント・制限対応・`P_Deleted`（RV-26）・参照の展開（RV-31）まで実装済み。
「API でやれることをできるようにする」の残りは、機能ではなく上表の **D2 / D3** に集約されている。

読み方 — **リソース網羅（D1）は完了**した。7 種のうち 6 種は descriptor パターンの横展開で 1 種 100〜130 行、
新しい抽象は 0 だった。**Phase だけが別物**で、接頭辞なし・主キー `Id`・`resource` 必須・`System[Department]` と
4 軸で違ったため専用 ADR（[ADR-0061][adr61]）を挟み、汎用 factory 側に 9 箇所＋受け口 2 つを足して載せた。
D3 が 17 に届かないのは `Link` / `Image` が**カスタム項目経由でしか現れない**ためで、R-4 と同じ 1 本の作業になる。
Contract / Sales の `Currency` は **Data Type が `Number`** なので新しい型は要らなかった（Field Type と Data Type は別物）。

> **訂正（2026-08-30）**: 本節の (d) 行は長らく「ガイド 4 本／`defineFields` の使い方が皆無（RV-24）／
> F-2 のガイドが無い（RV-27）」のままだったが、これは **2026-08-16 時点の写し**だった。
> **RV-24 / RV-27 はどちらも fixed** で、ガイドは **6 本**ある（oauth / read-query / multi-tenancy /
> bulk-write / custom-fields / error-handling）。**ドキュメントの残りは、型から漏れた領域ではなく
> リソースを増やしたぶんを同じ型で埋めること**＝ D5。

---

## 🧭 方針（[ADR-0060][adr60]・stakeholder 2026-08-30）

**案B（全リソース網羅）＋ ドキュメント充実が主軸**。進め方は **リソース 1 種＝1 PR**
（実装・テスト・reference 突合・ドキュメントを同じ PR で出す）＝**いつ止めても出荷可能**にする。
完了条件は上表の **D1〜D5 すべて**。各リソースの詳細設計は実装前に個別 ADR へ分岐する。

| 案  | 内容                      | 状態                                                    |
| --- | ------------------------- | ------------------------------------------------------- |
| B   | 全リソース R/W ＋ 網羅    | ▶️ **これが主軸**（D1〜D4）                             |
| —   | ドキュメント充実          | ▶️ **主軸と同じ PR で**（D5・[ADR-0035][adr35] の型）   |
| F   | v1 公開 API の積み残し    | ✅ **完了**（F-1〜F-4。下記）                           |
| C   | ローカル フェイクサーバー | ✅ フェーズ0〜6 完了（フェーズ7 は需要待ち）            |
| A   | 第2層 MCP サーバー        | **後続**（取り下げではなく順序の変更）                  |
| D   | `defineFields` 深掘り     | Link/Image 部分は **D3 に取り込み**／値検証の残りは随時 |
| E   | 対応バージョン表記        | ✅ [ADR-0042][adr42] で確定（残るは README 英語版のみ） |

> **なぜ順序を変えたか** — stakeholder の「**ライブラリの完成＝全リソースにアクセスでき、API でやれることを
> できるようにする ＋ 使い方のドキュメント充実**」を次の目標に据えた。旧方針 [ADR-0033][adr33] は
> **案A（MCP）を主軸・案B は需要に応じて機会的**（投機的拡充を避ける）としていたが、
> **MCP が露出できるのは第1層が持つものだけ**＝未実装 7 リソースはそのまま MCP の穴になる。
> 排他ではなく**順序の問題**として、第1層を先に広げる。0033 は [ADR-0060][adr60] で **superseded**。

**案F の内訳（すべて完了）**: F-1 OAuth 公開 API `porters.auth.*`（[ADR-0007][p7] SD-3/SD-6・[ADR-0034][adr34] ／ 0.3.0・`docs/guide/oauth.md`）／
F-2 Read クエリ（`order`/`keywords`/`itemstate` ＋ typed `condition`・[ADR-0038][adr38] ／ 0.4.0）／
F-3 マルチテナント（`porters.tenant(id)` ＋ `TenantScope`・[ADR-0040][adr40] 案1c ／ 0.5.0・`docs/guide/multi-tenancy.md`）／
F-4 一括書き込み（`createMany` / `updateMany` ＋ `BulkWriteResult`・[ADR-0041][adr41] 案1a/案2a ／ 0.6.0・`docs/guide/bulk-write.md`）。

横断監査 [2026-06-22-03][rv3] の検出ドリフト RV-10〜12 はすべて `fixed`（RV-11 は [ADR-0036][adr36] で refresh 挙動を amend）。

---

## ✅ 完了

### コア層

- HTTP transport（fetch 既定＋注入 seam）／requester（スロットル・認証・指数バックオフ・送信前サイズガード = URL+body 合算）
- **URL 組立を 1 関数に集約**（`apiUrl`）＋ アクセスポイント / scheme 設定（[ADR-0047][adr47]・既定 https・http は明示＋警告）
- XML parse/encode（Option・User/Reference・DateTime/Date を正規化）／datetime（ISO ⇄ PORTERS）
- OAuth（`code_direct`・トークン ms 単位・キャッシュ＋自動リフレッシュ・差し替え可能ストア）＋ **公開 API `porters.auth.*`**（初回ブラウザ付与 `authorizationUrl`/`exchangeAuthorizationCode`・利用終了 `revokeUrl`/`clearTokens`・`ensureAuthenticated`/`getToken`・F-1 / [ADR-0034][adr34]）
- エラーモデル（基底 `PortersError` ＋ 系統別 4 サブクラス ＋ `category` 11 種・未知は `unknown`）
  - **HTTP ステータスも分類**（[ADR-0044][adr44]・envelope 優先／status 由来は `code: null` ＋ `httpStatus`。`rateLimit` を解禁）
  - **Write のルート `<Code>`** を先読みしてリクエスト単位の失敗を保全（[ADR-0045][adr45]・仮定は LV-11）
  - **例外は常に reject で届く**（[ADR-0046][adr46]・Promise を返す公開メソッドは同期 throw しない）
  - **認証経路も同じ判定**（[ADR-0050][adr50]・トークン取得中のゲートウェイ 5xx も分類され自動回復しうる）
  - **アクセスポイントの書式検証**（[ADR-0048][adr48]・構築時に `PortersConfigError`。誤設定で別ホストへ繋がない。
    ポートはどれでも書ける＝[ADR-0049][adr49]）

### リソース（MVP 完了 = [R-3][prd]）

- データ R/W: Candidate / Job / Client / Process / Resume ＋ Attachment（Base64）
- マスタ Read: Partition / User（`current()`）/ Field / Option
- ※ **標準項目の網羅は 0.9.0 で充足**（RV-23 の 4 項目を追加）。以降は **reference ↔ カタログの突合を
  CI が検査**するので、取りこぼし・型の取り違えは仕組みで防がれる（RV-29）

### 要件（[PRD §6][prd]）

- P0 = R-1〜R-15（**大半を実装。一部に積み残しあり**＝下記 ※）（OAuth・型付き client・リソース・XML 隠蔽・型付きクエリ・自動ページング・
  レート市民＋リトライ・サイズガード・構造化エラー・日時 ISO・秘匿非漏洩・モック transport・型安全・配布・言語方針）
  - ※ 横断監査で一部に**積み残し**判明。**R-5 の `order`/`keywords`/`itemstate` は F-2（0.4.0）で是正済み**、**マルチテナント（`tenant(id)`）は F-3（[ADR-0040][adr40]・0.5.0）で公開済み**。残るは **R-4 の Link / Image 正規化のみ**（PRD で deferred 明記済み・上記「随時・任意」に掲載）。
- P1 = **すべて実装**: R-16 `defineFields`（[ADR-0023][adr23]）／ R-17 `createMockTransport`＋サンドボックス（[ADR-0024][adr24]）／ R-18 エラー対処ガイド

### 評価基盤（[ADR-0043][adr43]・フェーズ0〜6）

- in-repo フェイクサーバー（`test/fake/`・dev-only＝tarball 非同梱）: 独自 OAuth・状態あり CRUD 往復・
  Read クエリ・マスタ Read・制約（~15000字/200件/レート）・注入（result code / per-item / auth / network / HTTP）
- `pnpm fake:serve` で **ローカル HTTP 起動**（curl・別プロセスから叩ける）＋ 転送 Transport（ライブラリ非依存）
- **アプリ無改造で接続**: `host` ＋ `scheme: "http"` のみ（[ADR-0047][adr47]）。http は毎プロセス 1 回警告・抑止は専用 env
- L1 結合テストが契約なしで回る（`PortersClient` をそのまま駆動）
- **curl だけで叩く手順書**（[fake-server-runbook][fake-runbook]）— 認証 → CRUD → マスタ → 制約・注入まで実測検証済み

### 基盤・記録

- ADR 0001〜0061 accepted（0037 は 0039 で・**0033 は 0060 で** superseded）・**proposed は無し**／
  **実装待ちは [ADR-0060][adr60]**（主軸そのもの）と **[ADR-0061][adr61]**（Phase の設計。[索引][adr]）
- CI（ci / mutation / codeql / commitlint / test / scorecard）＋ eslint / prettier / markdownlint ＋ vitest coverage（perFile stmts/funcs/lines=100・branch≥90）＋ Stryker ＋ pre-commit（simple-git-hooks ＋ lint-staged ＋ commitlint）
- 品質ゲート green・**762 tests**／project-review プロセス＋台帳（[findings][findings]：**open は 2 件**＝
  RV-22（契約待ち）と RV-32（`searchAll` のクエリ書き換え）。台帳は [ADR-0052][adr52] で **1 件 1 ファイル**になり、
  索引とのズレは `pnpm check:index` が CI で弾く）
- 初期 scaffold 資料を [docs/history][history] へ移設（ルート直下を利用者向けに整理）
- **リポジトリ内スキル** `.claude/skills/` — 繰り返す判断を手順として固定する置き場。
  - `project-review` — 多観点クロスレビュー（上記の findings 台帳を更新するプロセス本体）
  - `dependabot-merge` — 依存更新 PR の検証とマージ。**cooldown（熟成期間）の突き合わせ**・
    CI を head SHA で見る・**base の鮮度と 1 件ずつのマージ順**を固定する。2026-08-22 に
    #173/#174/#175 を処理したときの判断を写した（#173 が cooldown で自動クローズされた件を含む）。
    **2026-08-23 に #188 で §1〜§5 を通し検証済み**。同じ更新（fast-xml-parser 5.11.0）で
    **cooldown の両側**を観測できた — 6 日 10 時間では dependabot が自動クローズ（#173）、
    7 日でマージ可（#188）。未検証で残るのは `update-branch` と複数 PR の順序決めで、
    どちらも「次に複数たまったとき」に確認する

## 🔜 リリースに向けた残タスク

手順は [release-runbook][rb]。リリースは**半自動**（main マージで `tag.yml` が自動タグ → 人/CC が GitHub Release 作成 → `release.yml` が **OIDC Trusted Publishing** で npm 公開・NPM_TOKEN 不要）。決定は [ADR-0025][adr25]〜[0032][adr32]（commitlint は [ADR-0039][adr39] で改訂：リリース PR は lint 範囲を限定して実行＋feature PR は PR タイトルも検査。旧 ADR-0037 のスキップは superseded）。

- [x] `version` 0.1.0 確定 ／ CHANGELOG 作成（Keep a Changelog・npm 同梱）
- [x] `v0.1.0` タグ付与 ＋ git-flow（release → main → develop back-merge）
- [x] **npm アカウント作成 ＋ `@joymerrevent` 組織作成 ＋ OIDC 信頼登録**
- [x] 公開済み — **`@joymerrevent/porters-connect@0.11.0`**（npm latest・2026-08-30 にレジストリで確認）。**全 15 版**を半自動フローでリリース:
      0.1.0 → 0.1.1 → 0.2.0 → 0.2.1 → 0.3.0 → 0.4.0 → 0.5.0 → 0.6.0 → 0.6.1 → 0.6.2 → 0.7.0 → 0.8.0 → 0.9.0 → 0.10.0 → 0.11.0
      （0.1.1 でメンテナンス＝`src/` 変更なし・fast-xml-parser の下限を `^5.9.2` へ・開発依存の脆弱性 4 件を解消、
      0.3.0 で F-1 OAuth 公開 API `porters.auth.*`、0.4.0 で F-2 Read クエリ＝typed `condition` ＋ `order`/`keywords`/`itemstate`、
      0.5.0 で F-3 マルチテナント＝`porters.tenant(id)` ＋ `TenantScope`、0.6.0 で F-4 一括書き込み＝`createMany` / `updateMany` ＋ `BulkWriteResult`、
      0.6.1 で fast-xml-parser `^5.10.1` 追従、0.6.2 で CI/CD ハードニング＝Actions の SHA ピン留め ＋ OpenSSF Scorecard、
      0.7.0 でエラーの見え方の是正 ＋ アクセスポイント設定＝ADR-0044〜0050 の 7 本、
      0.8.0 で「0 件」と「届いていない」の区別＝[ADR-0051][adr51]（Read 応答の同定）、
      0.9.0 で Candidate の標準 4 項目 ＋ reference 突合検査 ＋ 利用ガイド 2 本、
      0.10.0 で partition を `tenant(id)` 経由のみに（破壊的）＋ `P_Deleted` で削除済みを判別、
      **0.11.0 で参照先の展開 `expand`（RV-31）＋ `field` を接頭辞なしの型付き alias に（破壊的）**）。
      各版の詳細は [CHANGELOG][changelog]
- [x] 対応 PORTERS / API バージョン明記の確定（[ADR-0042][adr42]・案A＝**Connect API Version を契約の正**／製品 8.x・9.x は参考。README「対応バージョン」節・PRD §8・CLAUDE.md・コードコメントへ反映済み）

> ⚠️ **下記 0.7.0〜0.9.0 の「changeset N 件を消費して」は `pnpm changeset:version` の実行結果ではない**
> （2026-08-23 に判明）。同コマンドは changesets 導入初日（2026-06-20）から一度も動いていなかったため、
> 版 bump と changeset 削除は実際には手作業だったと見られる。件数そのものは正しい。
> 経緯は [runbook][rb]「現在の状況」の時系列。

- [x] **0.7.0 リリース**（2026-08-13）— changeset 6 件を消費して `0.6.2` → `0.7.0`。
      `v0.7.0` 自動タグ → back-merge → GitHub Release → OIDC publish まで完了
- [x] **0.8.0 リリース**（2026-08-14）— changeset 1 件を消費して `0.7.0` → `0.8.0`。
      `v0.8.0` 自動タグ → back-merge → GitHub Release → OIDC publish（provenance 付き）まで完了
- [x] **0.9.0 リリース**（2026-08-21）— changeset 2 件を消費して `0.8.0` → `0.9.0`。
      `v0.9.0` 自動タグ → back-merge → GitHub Release → OIDC publish（provenance 付き・7 files / 366.6 kB）まで完了
- [x] **0.10.0 リリース**（2026-08-22）— changeset 3 件を消費して `0.9.0` → `0.10.0`。
      `v0.10.0` 自動タグ → back-merge → GitHub Release → OIDC publish（provenance 付き・7 files / 377.7 kB）まで完了。
      **`pnpm changeset:version` が動かず**、版 bump と changeset 削除は手で実施（後日復旧・[runbook][rb]「現在の状況」）
- [x] **0.11.0 リリース**（2026-08-30）— changeset 2 件を消費して `0.10.0` → `0.11.0`。
      `v0.11.0` 自動タグ → back-merge → GitHub Release → OIDC publish（provenance 付き・7 files / 430.0 kB）まで完了。
      **`changeset:version` が実際に動いた最初のリリース**（下記の修復以降で初）。
      準備中に co-located UT の取りこぼし 2 件（`resources/expand.ts` / `auth/token-exchange.ts`）を
      見つけてリリース PR に含めた（[runbook][rb] §1 の判断軸どおり）
- [x] **`changeset:version` の修復**（2026-08-23）— `@changesets/cli` を **2.31.1 → 3.0.0** へ。`read-yaml-file` が
      依存から消え、`js-yaml` override との衝突が解消。`.changeset/config.json` の `$schema` も
      `@changesets/config@4.0.0` へ追従
- [ ] （任意）README 英語版（日本語ファースト → 英語）

## 🧱 基盤構築（完了）

機能開発を一旦止め、公開リポジトリの基盤（コミュニティ・ヘルス＋開発体験＋CI/CD）を固めた期間の記録。
リリース自動化の決定は [ADR-0025][adr25]〜[0032][adr32]（accepted）。WS-C の任意項目（OpenSSF Scorecard / SHA ピン留め）まで入れて**基盤構築は完了**しており、**残タスクはない**。

### WS-A. コミュニティ・ヘルス／ガバナンス

- [x] `SECURITY.md`（報告窓口・非公式の免責）＋ GitHub private vulnerability reporting 有効化
- [x] `CONTRIBUTING.md`（git-flow／Conventional Commits／pnpm／コーディング規約 [ADR-0013][p13]／公開サーフェスは英語・内部コメント日本語可／契約＋Connect API オプション契約が必要・非公式／PR はメンテナがマージ）
- [x] `.github/ISSUE_TEMPLATE/`（bug / feature の Issue Forms ＋ `config.yml`）
- [x] `.github/PULL_REQUEST_TEMPLATE.md`（全ゲート green／決定を伴うなら ADR／秘匿情報なし）
- [x] `.github/CODEOWNERS`
- [x] `CODE_OF_CONDUCT.md`（Contributor Covenant）
- [x] README に「Contributing／セキュリティ報告／非公式の免責」節

### WS-B. 開発体験・ローカルゲート

- [x] `.editorconfig`
- [x] **pre-commit 導入**（薄い構成：`simple-git-hooks` ＋ `lint-staged`）。旧記載の「pre-commit あり」は誤りで未導入だったため、ここで正式導入した
- [x] commitlint（`@commitlint/config-conventional`）を**ローカル**（commit-msg フック）で強制。**CI ジョブは WS-C**
- [x] 定型セットアップを `project-recipes` スキルへ codify 済み（**`ts-commit-gates` レシピ**＝simple-git-hooks ＋ lint-staged ＋ commitlint。既存 `git-hooks` は core.hooksPath 方式なので別レシピとして分けた）

### WS-C. CI/CD ハードニング

- [x] CodeQL（コードスキャン）ワークフロー（`codeql.yml`。**default branch=main にも反映済み**＝main で走る）
- [x] commitlint の CI ジョブ（`commitlint.yml`。PR のコミット範囲＋PR タイトルを検査・リリース PR は範囲限定。[ADR-0039][adr39]）
- [x] テスト Node マトリクス（20/22/24）＋ **最低 Node を 20 に引き上げ**（18 は EOL・vitest/eslint が非対応のため。engines/README/CLAUDE.md/CHANGELOG 反映）
- [x] OpenSSF Scorecard ワークフロー（`scorecard.yml`・週次＋`main` push＋branch_protection_rule／SARIF を code scanning へ＋OpenSSF 公開・README バッジ）／全ワークフローの Actions を**コミット SHA にピン留め**（版コメントで Dependabot が SHA＋版を追従更新＝両立）。サプライチェーン強靭化＝フェイルセーフ。既存 `github-actions` Dependabot 設定で追従（設定変更不要）
- [x] **依存更新の熟成期間（cooldown）7 日**＝公開直後の版は取り込まない。入口は Dependabot `cooldown`（npm は minor/patch 7 日・major 14 日／Actions は 7 日）、出口は pnpm `minimumReleaseAge: 10080`（手元の `pnpm add` / `pnpm update` も守る）。悪性リリースは概ね数時間〜数日で発見・削除されるため**防御の本体は「時間」**。**cooldown は version updates のみに効き security updates は素通り**＝待っても脆弱性の穴は開かない＝フェイルセーフ

### WS-D. リリース自動化（[ADR-0025][adr25]〜[0032][adr32]）

- [x] ADR-0025 を **accepted**（**changesets・git-flow 維持**。release-please/手運用は不採用）
- [x] changesets 導入（`@changesets/cli`・config: `access: public` / `baseBranch: develop`・scripts）。**version bump のみ**に使用（CHANGELOG は**手書き**＝[ADR-0026][adr26] 案B・`changelog: false`）
- [x] publish ワークフロー `release.yml`（**Release 公開**で起動・**OIDC Trusted Publishing**・**NPM_TOKEN 不要**・provenance 自動）＋ npm 側の信頼登録済み（0.1.0〜0.9.0 の**全 13 版**で運用実績あり）
- [x] タグ自動化 `tag.yml`（main マージで `vX.Y.Z` 自動作成・[ADR-0029][adr29]）／ back-merge は**手動**（[ADR-0030][adr30]）／ リリース前ゲート `check:release`（版番号 semver＋単調増加・[ADR-0027][adr27]/[0031][adr31]/[0032][adr32]）
- [x] CHANGELOG 形式確定（[ADR-0026][adr26] 案B）／[release-runbook][rb] を半自動フローへ更新済み

## 🧹 小さな整理（技術的負債）

- [x] `src/resources/{job,process,resume}.ts` のコメント「first alias only」を実態（全 alias を `string[]` で返す・[ADR-0017][adr17]）に修正
- [x] メモリ `field-type-fidelity-followup` の更新（Option 複数選択・ラベル distinct 化は解消済み／残は per-type 値検証）
- [x] 初期 scaffold 資料（SPEC_v1 / KICKOFF_PROMPT）を `docs/history/` へ移設（PR #50）

## 🚀 将来の機能アップ（Non-Goals / Future）

[PRD §3 非ゴール][prd] ／ [ADR 論点バックログ][adr] と対応。

- 第2層 MCP サーバー（`@joymerrevent/porters-mcp`）＝ 案A。**主軸の後続**（[ADR-0060][adr60] で順序を変更）
- フェイクサーバーの **package 昇格・配布**（`@joymerrevent/porters-fake`・フェーズ7・需要が出てから）
- ~~MVP 外リソースの R/W~~ → **主軸に昇格**（[ADR-0060][adr60] D1。上記「いま何をやるか」を参照）
- CJS 出力 / CLI / Docker 配布 / 公開プレイグラウンド
- `defineFields` follow-up（[ADR-0023][adr23]）: 値レベルの厳格な実行時検証・テナント実在チェック・Field Read からの宣言雛形生成・Attachment / Reference / Image 型のカスタム項目

## 🔌 ライブ検証（契約環境が必要・契約後タスク）

実 PORTERS 契約が無いと確定できない仮定は [live-verification][lv]（**LV-1〜17**）に集約。リリースのブロッカーではないが、
契約取得後に実機で確定し、必要なら fixture を実データへ差し替える。
LV-9〜12 はフェイクサーバー実装中に増えた項目（制約違反時の HTTP 応答・System[Reference] の入れ子・Write 失敗時の Result Code・Field Read の表記）。

## 関連

- 要件: [requirements][prd]（PRD・フェーズ計画は §9）
- 決定: [docs/adr][adr]
- レビュー指摘台帳: [findings][findings]（最新スナップショット: [2026-08-16-01][run816]／前回: [2026-08-10-01][run]）
- 契約後検証: [live-verification][lv]
- フェイクサーバー: [実装計画][fake-plan] ／ [curl 手順書][fake-runbook]
- 歴史的経緯: [docs/history][history]

[prd]: design/requirements.md
[rb]: release-runbook.md
[changelog]: ../CHANGELOG.md
[adr17]: adr/0017-option-read-shape.md
[adr23]: adr/0023-custom-field-declaration-dsl.md
[adr24]: adr/0024-mock-transport.md
[adr25]: adr/0025-release-automation.md
[adr26]: adr/0026-changelog-format.md
[adr27]: adr/0027-release-readiness-gate.md
[adr29]: adr/0029-release-tag-automation.md
[adr30]: adr/0030-backmerge-method.md
[adr31]: adr/0031-version-number-validation.md
[adr32]: adr/0032-monotonic-check-release-scope.md
[adr33]: adr/0033-post-mvp-direction.md
[adr34]: adr/0034-oauth-public-surface-impl.md
[adr36]: adr/0036-refresh-expiry-reacquire.md
[adr38]: adr/0038-read-query-surface-impl.md
[adr39]: adr/0039-commitlint-release-range.md
[adr40]: adr/0040-multitenancy-surface-impl.md
[adr41]: adr/0041-bulk-write-surface-impl.md
[adr42]: adr/0042-supported-version-policy.md
[adr43]: adr/0043-local-fake-server.md
[adr44]: adr/0044-http-status-handling.md
[adr45]: adr/0045-write-response-root-code.md
[adr46]: adr/0046-guard-error-contract.md
[adr47]: adr/0047-access-point-scheme.md
[adr48]: adr/0048-access-point-host-validation.md
[adr49]: adr/0049-host-port-roundtrip.md
[adr50]: adr/0050-auth-http-status-handling.md
[adr51]: adr/0051-read-envelope-identification.md
[adr55]: adr/0055-partition-binding-guard.md
[adr56]: adr/0056-deleted-flag-typing.md
[adr57]: adr/0057-itemstate-existing-explicit.md
[adr58]: adr/0058-reference-expansion-read.md
[adr59]: adr/0059-read-field-bare-alias.md
[adr60]: adr/0060-full-resource-coverage-direction.md
[adr61]: adr/0061-phase-resource-surface.md
[adr35]: adr/0035-usage-documentation-structure.md
[adr52]: adr/0052-findings-register-layout.md
[fake-plan]: design/fake-server-plan.md
[fake-runbook]: fake-server-runbook.md
[p7]: adr/0007-oauth-public-surface.md
[p13]: adr/0013-coding-conventions-class-vs-function.md
[rv3]: reviews/2026-06-22-03.md
[run]: reviews/2026-08-10-01.md
[run816]: reviews/2026-08-16-01.md
[adr]: adr/README.md
[findings]: reviews/findings.md
[lv]: live-verification.md
[history]: history/README.md
