# OAuth API

出典: <https://hrbcapi.porters.jp/hc/ja/articles/115008017487-OAuth>（updated_at 2025-06-03、取得 2026-06-12）。
全体像は [認証 README][readme]。

`GET https://{host}/v1/oauth?app_id=&redirect_url=&response_type=&scope=&state=`

| パラメータ      | 必須             | 内容                                                             |
| --------------- | ---------------- | ---------------------------------------------------------------- |
| `app_id`        | ●                | アプリ登録時に発行された App ID。                                |
| `redirect_url`  | ●（code/remove） | 登録した Redirect URL。`code_direct` では不要。                  |
| `response_type` | ●                | `code` / `code_direct` / `remove`。                              |
| `scope`         | ●（code/remove） | 取得・削除する権限。カンマ区切り。`code_direct` では指定しない。 |
| `state`         | 任意             | redirect 時に引き継がれる任意値（CSRF 対策等に使える）。         |

`response_type`:

- `code`: ブラウザ経由。redirect で `?code=...`(または `?error=...`)。**初回の権限付与はこれが必須**。
- `code_direct`: サーバ間直接。Response Body に XML で code を返す。`redirect_url` / `scope` 不要。
- `remove`: 取得済み権限を削除（利用終了時）。redirect で `remove_confirmation=0`(成功)/`-1`(失敗)。

`code` の**有効期限は 30 秒**。取得後すぐ [Token API][token] で交換する。

`code_direct` の出力例:

```xml
<Authentication>
  <Code>aaa</Code>
  <Error>0</Error>
  <Message>Success</Message>
</Authentication>
```

## Company DB へのアクセス権付与（初回・ブラウザ）

`code_direct` を使う前に、対象 Company DB ごとに一度だけ実施する。

1. **PORTERS にログインしていない状態**で、ブラウザのアドレスバーに OAuth URL（`response_type=code`・付与したい
   scope をカンマ区切り）を入力して実行。
2. 表示されるログイン画面に会社 ID / ユーザー ID / パスワードを入力してログイン。
3. 権限付与の確認画面で **[承諾]**。
4. `code` が付加されて Redirect URL に戻る（`?response_type=code&code=...`）。
5. その `code` で [Token API][token] を呼び、Access Token を取得。

## アクセス権の削除（利用終了・`remove`）

PORTERS にログインしていない状態で `response_type=remove`・対象 scope（不明なら全 scope）を指定して OAuth URL を実行 →
ログイン → 削除承諾 → `remove_confirmation=0` なら成功。

## スコープ一覧

リソース別に R/W が分かれる（`{resource}_r` / `{resource}_w`）。複数はカンマ区切り。

- **マスタ系（読み取りのみ）**: `partition_r` / `user_r` / `field_r` / `option_r`
- **データ系（R/W あり）**: `client` / `recruiter` / `contact` / `job` / `candidate` / `resume` /
  `process` / `activity` / `contract` / `sales` / `phase` / `attachment` / `opportunity`（各 `_r` / `_w`）

注意: Read でも複数スコープが要ることがある（例: Candidate Read = `candidate_r, user_r, option_r`。参照・選択肢項目の取得のため）。
各リソースの正確な必要スコープは [リソース一覧][resources-list] を参照。

[readme]: README.md
[token]: token.md
[resources-list]: ../resource-api/resources-list.md
