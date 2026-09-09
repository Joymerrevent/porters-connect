# Architecture Decision Records (ADR)

このディレクトリは `@joymerrevent/porters-connect` の設計判断を、決めた理由ごと残す場所です。
`docs/history/SPEC_v1.md` は**素案**であり、ここで議論・確定した内容が正となります。

> **ADR の一覧は [索引（index.md）][index]** にあります。本ファイルは**運用ルールと未起票の論点**を置きます
> （役割分担は [ADR-0053][0053]）。

## ADR とは

「なぜその設計にしたか」を 1 判断 1 ファイルで残す軽量な記録です。
コードを読んでも分からない「選ばなかった選択肢」と「その理由」を未来の自分／貢献者に伝えます。
形式は [MADR（Markdown Any Decision Records）][madr-markdown-any-decision-records] のフル版に準拠します。

## 運用ルール

- 1 判断 = 1 ファイル。ファイル名は `NNNN-kebab-title.md`（連番 + 内容）。
- **番号は ADR を起票する時に採番**する（その時点の最大番号 + 1）。**連番のみ・欠番や振り直し・再利用はしない**。
  バックログには番号を振らない（差し込みのたびに番号と参照を直す事故を防ぐため）。
- **未起票の ADR を参照するときは番号でなくトピック名で指す**（例: 「→ 型設計の ADR」）。起票後にリンクへ更新してよい。
- **ADR は自己完結させない**。フローは **起票（`proposed`）→ チームで議論 → 決定を反映（`accepted`）**。
  個人や AI が単独で `accepted` にしない。**決定事項の反映（`CLAUDE.md` / `SPEC` などの更新）は `accepted` 後**に行う。
- ステータスは次のいずれか：`proposed`（議論中）/ `accepted`（確定）/ `rejected`（不採用）/ `deprecated`（廃止）/ `superseded by NNNN`（後続で置換）。
- **`accepted` 後の直しは 2 通りある。「方針を変える」のか「間違いを直す」のかで扱いが違う**。
  - **方針（決定）を変える → 本文の書き換えは禁止**。新しい ADR を起こし、旧 ADR を
    `superseded by NNNN` にする。決定を上書きすると「なぜそう決めたか」の記録が消え、
    ADR が存在する理由そのものが無くなるため。
  - **事実の間違い・古くなった記述を直す → 直してよい**。決定が変わらないなら新 ADR は要らない。
    ただし**黙って直さない**: 誤った記述に取り消し線（`~~…~~`）を引き、**訂正（日付）**で始まる注記を
    続けて、①何が違ったか ②現状はどうか ③**決定そのものは変わらないこと**を書く。
    読んだ人が「決定が変わったのか」を判断できるようにするため。
    先例は [ADR-0049][0049]（実装時に前提の見立てが誤りと判明した箇所に
    `**訂正（実装時 2026-08-12）**` を注記し、決定は据え置いた）。
  - 判断に迷ったら**「その注記を読んで、決定が変わったと思う人がいるか」**で切り分ける。
    いるなら方針変更＝新 ADR、いないなら訂正注記でよい。
- 雛形は [`0000-template.md`][0000-template-md]（MADR フル）をコピーして使う。
- セクション構成：Context and Problem Statement → Decision Drivers → Considered Options →
  Decision Outcome（+ Consequences）→ 信じている入力 → Pros and Cons of the Options → More Information。
  「信じている入力」は**実装前に埋める**節で、該当が無ければ「該当なし — 理由」を 1 行書く
  （節ごと消さない）。信頼できない入力源が 3 つ以上ある決定では必須。

### 索引との付き合い方（[ADR-0053][0053]）

- **ADR を起票したら [索引][index] にも 1 行足す**。ステータスを変えたら索引も直す。
- **状態の正は各 ADR 本文**（`- Status:` と `- Implemented:`）で、索引はその写し。
  ズレは **`pnpm check:index`** が検出して CI で落とす（人の注意でなく仕組みで守る）。
- **`- Implemented: X.Y.Z`** は「その決定が世に出た版」。**任意**で、プロセス決定など実装の概念が無い ADR には書かない
  （索引では `—`）。書いたら索引の「実装」列と一致させる。
- **索引に散文を書かない**。「実装待ち」「議論中」といった状態の言い換えは、テーブルの列で表す。
  かつて索引に置いていた状態別の節は、**4 件が陳腐化した実績**があるため廃止した（[ADR-0053][0053]）。

## フェーズ凡例

各 ADR / バックログ項目に**フェーズ**を付ける：**プロセス**（進め方・メタ）／ **要件定義**（何を作るか・PRD 担当）／ **基本設計**（外部仕様・全体像：公開 API・型・エラー・認証・層責務）／ **詳細設計**（内部実装・実装フェーズで決める）。

## 論点バックログ（未起票）

**まだ ADR を起こしていない論点**だけを置く（起票済みのものは [索引][index] が正）。
**番号は付けない**（起票時に採番）。前方参照はトピック名で行う。フェーズは上記凡例に従う。

### 【要件定義】

- PRD オープン論点（[requirements §8][prd]）の確定 — **2026-08-09 の棚卸しで残るのは 2 件**：
  「成功指標の数値化タイミング」[stakeholder]／「v1 で CJS 出力まで出すか」[eng]。
  （バージョン表記は [0042][0042]、サンドボックス R-17 は P1 のまま出荷、npm スコープ/組織は公開実績で決着。
  「1 App トークンで複数 partition」は実機確認事項のため [live-verification][lv-doc] LV-13 へ移送）

### 【基本設計】

- **未起票の論点はなし**（過去にここへ挙げていた「ページング・検索条件の抽象化」は [0038][0038] として起票・accepted・実装済み）。

### 【詳細設計】

- **値レベルの実行時検証と、日時変換の例外の系統** — 宣言した Data Type に合わない値を
  どこまで手前で弾くか（既定 off の opt-in が前提）。**ゼロから足す話ではなく**、
  `Date` / `DateTime` / `Age` だけ既に検証が効いていて、そこだけ素の `RangeError` が飛ぶ
  （読み・書きの両方）現状を揃える話から始まる＝ [RV-36][rv36] を含む。
  ロードマップの**案D の残り 1 つ**（他の 2 つは [ADR-0069][0069] で起票済み）。
- 上記以外に未起票の論点はなし（HTTP トランスポート／リトライ・スロットリング／XML パース・シリアライズ／
  トークンのキャッシュ・更新／FieldType の粒度／Option の読み取り値／Attachment／マスタ Read は
  すべて起票済み。各々の状態は [索引][index] を参照）。

### 決定済み（ADR / PRD）

- 型モデル: [ADR-0004][0004]／公開 API: [ADR-0005][0005]／エラーモデル: [ADR-0006][0006]／OAuth 公開 API: [ADR-0007][0007]／マルチテナント: [ADR-0008][0008]／日時の表現: PRD R-10（ISO 8601・UTC）／MVP: [ADR-0003][0003]／接地方針: [ADR-0002][0002]

[madr-markdown-any-decision-records]: https://adr.github.io/madr/
[index]: index.md
[prd]: ../design/requirements.md
[lv-doc]: ../live-verification.md
[rv36]: ../reviews/rv/0036-write-value-validation-partial.md
[0069]: 0069-tenant-field-catalog-tooling.md
[0000-template-md]: 0000-template.md
[0002]: 0002-ground-design-in-live-api-docs.md
[0003]: 0003-add-attachment-to-mvp.md
[0004]: 0004-field-type-model.md
[0005]: 0005-public-api-shape.md
[0006]: 0006-error-model.md
[0007]: 0007-oauth-public-surface.md
[0008]: 0008-multitenancy-partition.md
[0038]: 0038-read-query-surface-impl.md
[0042]: 0042-supported-version-policy.md
[0049]: 0049-host-port-roundtrip.md
[0053]: 0053-adr-index-split.md
