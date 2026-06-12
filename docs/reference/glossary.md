# 用語集（Terminology）

出典: Terminology（関連用語）（updated_at 2024-08-23、取得 2026-06-12）。

- <https://hrbcapi.porters.jp/hc/ja/articles/115008172808-Terminology-Related-Terms>

## アプリ・認証まわり

- **ユーザーアプリ**: PORTERS ユーザー企業が自社用途で開発するアプリ（自社サイト連携など）。
- **サードパーティアプリ**: 第三者が開発するアプリ。**本ライブラリの利用者は基本これ**（外部媒体エントリーの連携等）。
- **アプリ名**: アプリを判別する名称。未指定時はポーターズが `会社ID_api` で登録。アプリ一覧に表示される。
- **App ID**: アプリ識別子。認証に使用。**登録時にポーターズが発行・変更不可**。
- **Secret**: アプリの認証パス。認証に使用。発行はポーターズ。**再発行（変更）は可能**（開発会社変更時などに推奨）。
- **Redirect URL**: アプリ実行サーバの URL。API 申込時に契約ユーザーが指定（必須）。IP でもよいが URL 形式必須。`code` 認証で使用。
- **API アクセス数**: request 回数（**認証 request も含む**）。実装方式で大きく変わる（毎表示で取得＝多 / 定期取得して自社 DB 保持＝少）。
  → 課金・レート対策としてキャッシュ・差分取得が効く（[gotchas.md](gotchas.md)）。

## データモデル

- **Partition（パーティション）**: 会社ごとに独立したデータ単位。**Company DB** とも呼ぶ。Read では `partition` 必須。
- **Resource（リソース）**: Partition 内の各種データ（Candidate / Job …）。これにアクセスする API が Resource API。
- **Field（フィールド）**: Resource 内の項目。Read/Write で対象項目を Field 指定する。
- **Option（オプション）**: 選択肢を定義するマスタ。選択肢型 Field に関連付き、単一/複数選択。
  - ※ 既定の選択肢値の一覧は出典の Default Option List 参照（巨大かつテナントで上書き可のため本書には転記しない。実値は Option Read で取得）。

## Resource ↔ PORTERS 画面名（エディション差に注意）

メニュー名は変更可。エディションで既定呼称が異なる（型名の意味理解・命名の参考）。

| Resource  | PORTERS Agent（紹介向け） | PORTERS Staffing（派遣向け） |
| --------- | ------------------------- | ---------------------------- |
| Client    | 企業                      | 企業                         |
| Recruiter | 企業担当者                | 企業担当者                   |
| Job       | JOB                       | 案件                         |
| Candidate | 個人連絡先                | スタッフ連絡先               |
| Resume    | レジュメ                  | スタッフ                     |
| Process   | 選考プロセス              | 引当 / 就業管理              |
| Activity  | アクティビティ            | アクティビティ               |
| Contract  | 契約                      | 契約                         |
| Sales     | 成約（売上）              | 個別契約                     |

> Candidate の項目接頭辞が `Person.` なのは「個人連絡先＝人」を表すため。英語型名の検討時にこの対応表を参照する（→ 公開 API の ADR）。
