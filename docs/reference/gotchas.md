# 運用上の落とし穴・前提（設計に効くもの）

出典: アプリ開発時の注意点（2025 系）／ サードパーティアプリ開発時の留意点（2025-11-21）／
よくあるご質問 ／ 開発概要（2026-05-15）／ Rate limit（2024-03-21）／ 開発環境について ／
マスタコピー申請。取得 2026-06-12。

- <https://hrbcapi.porters.jp/hc/ja/articles/360000430687-アプリ開発時の注意点>
- <https://hrbcapi.porters.jp/hc/ja/articles/45632513930265>
- <https://hrbcapi.porters.jp/hc/ja/articles/215425667>
- <https://hrbcapi.porters.jp/hc/ja/articles/215425677>

## レート・課金・接続

- **レート上限（1 分）**: Read 2000 / Write 500。超過すると**強制切断され得る**。
  **HTTP 429 や Retry-After の記載は無い** → ライブラリ側で**自前スロットリング**して上限内に収める必要がある（→ HTTP トランスポートの ADR）。
- **課金はアクセス数ベース**。クローリングや**ループの暴走がそのまま課金**につながる。無駄打ちを避ける設計（キャッシュ・差分取得・自動ページングの上限）。
- **接続は通常無停止だがネット回線依存**。回線障害・メンテで失敗し得る（Result Code `9`）→ バックオフ再試行と「安全側に倒す」挙動（フェイルセーフ）。
- **並列処理にリスク**がある（公式が注意喚起）。同一データへの並行 Write は競合し得る → 既定は控えめな並行度・順序保証を検討。

## 実行環境

- **GAS（Google Apps Script）/ Cloudflare Workers では期待通り応答しないことがある**（公式が明記、Result Code `9` の一因）。
  他ツール推奨。本ライブラリは **Node 前提**。エッジ/サーバーレスでの利用は非推奨と README に明記する。

## データモデル・Alias

- **Alias は環境・テナント依存**。本番と開発用テスト環境で項目・選択肢の Alias がズレると連携が壊れる
  （マスタコピーで一致させる運用）。→ ライブラリは **Alias をハードコードせず**、
  Partition / Field / Option Read で発見する手段を提供する（→ 型設計の ADR-0004）。
- **keyword（フリーワード）検索は Option 型項目を対象にできない**（FAQ）。Option は `condition` で指定する。
- **PORTERS 側で項目が変更・削除される**とアプリが壊れ得る。未知 Alias に強い設計（寛容なパース・明確なエラー）。
- **削除 API は無い**（データ・添付とも。提供予定なし）。`delete()` を生やさない。削除済みは `itemstate` で Read 可。
- **フィールド型は原典記事の値をそのまま転記**しているため、PORTERS 側の不揃いも残る。例: 携帯メール
  `P_MobileMail` の Field Type が Candidate=`Mail` / Recruiter・Contact=`Telephone` と割れている（原典どおり）。
  型生成時は原典差異に注意し、正典は `resource-api/field-data-types.md` の分類に寄せる（→ 型設計の ADR-0004）。

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

| 時期    | 変更                                                           |
| ------- | -------------------------------------------------------------- |
| 2025/03 | ユーザー型・ユーザー部署型 field／Department - Read の機能拡張 |
| 2024    | 1 分あたり Request 上限（Rate limit）を新設                    |
| 2023/06 | Resource API / Field Type & Data Type の機能拡張（Link 等）    |
| 2019/12 | Phase Read / Phase Write API の機能拡張                        |

> 設計は最新（version 2）前提。旧挙動は出典の「仕様変更のご案内」を参照。
