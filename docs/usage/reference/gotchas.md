# 運用上の落とし穴・前提（設計に効くもの）

出典: アプリ開発時の注意点（2025 系）／ サードパーティアプリ開発時の留意点（2025-11-21）／
よくあるご質問 ／ 開発概要（2026-08-28）／ Rate limit（2024-03-21）／ 開発環境について ／
マスタコピー申請 ／ TLS 変更のお知らせ（2026-08-28）／ 時分型のお知らせ（2026-08-28）。取得 2026-06-12（2026-09-20 に差分反映）。

- <https://hrbcapi.porters.jp/hc/ja/articles/360000430687-アプリ開発時の注意点>
- <https://hrbcapi.porters.jp/hc/ja/articles/45632513930265>
- <https://hrbcapi.porters.jp/hc/ja/articles/215425667>
- <https://hrbcapi.porters.jp/hc/ja/articles/215425677>
- <https://hrbcapi.porters.jp/hc/ja/articles/61643559096345>
- <https://hrbcapi.porters.jp/hc/ja/articles/60022630729497>

## レート・課金・接続

- **レート上限（1 分）**: Read 2000 / Write 500。超過すると**強制切断され得る**。
  **HTTP 429 や Retry-After の記載は無い** → ライブラリ側で**自前スロットリング**して上限内に収める必要がある（→ HTTP トランスポートの ADR）。
- **課金はアクセス数ベース**。クローリングや**ループの暴走がそのまま課金**につながる。無駄打ちを避ける設計（キャッシュ・差分取得・自動ページングの上限）。
- **接続は通常無停止だがネット回線依存**。回線障害・メンテで失敗し得る（Result Code `9`）→ バックオフ再試行と「安全側に倒す」挙動（フェイルセーフ）。
- **並列処理にリスク**がある（公式が注意喚起）。同一データへの並行 Write は競合し得る → 既定は控えめな並行度・順序保証を検討。
- **TLS 1.2 のみ**（2026/08/27 から。TLS 1.0 / 1.1 は廃止・暗号スイートは出典の 12 種）。Node 22 の `fetch` は
  既定で TLS 1.2 以上を使うのでライブラリ側の対応は不要。古い OpenSSL を同梱したランタイムや、独自
  transport<!-- 根拠: ADR-0077 -->で TLS を落としている場合だけ影響する。
- **Result Code 9 は `x-forwarded-for` ヘッダでも出る**（2026/07 追記）。プロキシ経由で付く場合は除外する。

## 実行環境

- **GAS（Google Apps Script）/ Cloudflare Workers では期待通り応答しないことがある**（公式が明記、Result Code `9` の一因）。
  他ツール推奨。本ライブラリは **Node 前提**。エッジ/サーバーレスでの利用は非推奨と README に明記する。

## データモデル・Alias

- **Alias は環境・テナント依存**。本番と開発用テスト環境で項目・選択肢の Alias がズレると連携が壊れる
  （マスタコピーで一致させる運用）。→ ライブラリは **Alias をハードコードせず**、
  Partition / Field / Option Read で発見する手段を提供する<!-- 根拠: ADR-0004 -->。
- **keyword（フリーワード）検索は Option 型項目を対象にできない**（FAQ）。Option は `condition` で指定する。
- **PORTERS 側で項目が変更・削除される**とアプリが壊れ得る。未知 Alias に強い設計（寛容なパース・明確なエラー）。
- **削除 API は無い**（データ・添付とも。提供予定なし）。`delete()` を生やさない。削除済みは `itemstate` で Read 可。
- **時分型（2026/08・PORTERS 9.3.0）は Field Read で年月日時分型と見分けが付かない**（同じ Field Type 12）。
  基準日 `1970/01/01` 付きの書式でしか書けず、任意の日時を書くと Code 103。どの項目が時分型かは環境の
  管理者に聞くしかない → 詳細は [field-data-types][fdt] の「時分型」節（ライブラリは `decodeTimeOfDay` /
  `encodeTimeOfDay` で変換する）<!-- 根拠: ADR-0086 -->。
- **フィールド型は原典記事の値をそのまま転記**しているため、PORTERS 側の不揃いも残る。例: 携帯メール
  `P_MobileMail` の Field Type が Candidate=`Mail` / Recruiter・Contact=`Telephone` と割れている（原典どおり）。<!-- 型生成時は原典差異に注意し、正典は resource-api/field-data-types.md の分類に寄せる（ADR-0004） -->

## ログイン中の企業 / ユーザーの特定

- ログイン中の企業・ユーザーを取得するには **`response_type=code`**（`code_direct` では取得不可）で認証し、
  - **Partition Read を `request_type=0`** → ログイン中 Partition
  - **User Read を `request_type=0`** → ログイン中ユーザー
- OAuth の **`state`** に任意値を載せると redirect 後に引き継げる（例: PORTERS アクションメニューから `state=resumeid:10001`）。

## 開発 / テスト環境（我々の検証戦略に直結）

- 開発用テスト環境は**別途有償申込**（初期費用あり・有効期限 3 か月）。本番とは別の PORTERS 環境＋App ID/Secret が納品される。
- **マスタコピー**で本番→テストの Alias を一致させる（テスト→本番は不可。コピー時テストデータは全削除）。
- 我々は契約ホストを持たないため、**ドキュメントの XML 例を vitest の fixture 化**して検証する（実 API は PoC・契約環境ができてから）。

## 直近の主な仕様変更（version は最新 `2`）

| 時期    | 変更                                                                                 |
| ------- | ------------------------------------------------------------------------------------ |
| 2026/08 | TLS 1.0 / 1.1 を廃止し TLS 1.2 のみ（8/27）                                          |
| 2026/08 | Data Type: DateTime に**時分型**を追加（PORTERS 9.3.0・8/4 完了）                    |
| 2026/07 | Result Code 9 に `x-forwarded-for` 起因を追記                                        |
| 2025/03 | ユーザー型・ユーザー部署型 field／**Department - Read API 追加**（Read のみ・8.2.1） |
| 2024    | 1 分あたり Request 上限（Rate limit）を新設                                          |
| 2023/06 | Resource API / Field Type & Data Type の機能拡張（Link 等）                          |
| 2019/12 | Phase Read / Phase Write API の機能拡張                                              |

> 設計は最新（version 2）前提。旧挙動は出典の「仕様変更のご案内」を参照。

[fdt]: resource-api/field-data-types.md
