# Write API（XML 形式 / 新規・更新 / Phase）

出典: Write API - XML Format（updated_at 2025-02-18）／ Write API - Phase の更新について（2020-06-09）。
取得 2026-06-12。

- <https://hrbcapi.porters.jp/hc/ja/articles/115008171988-Write-API-XML-Format>
- <https://hrbcapi.porters.jp/hc/ja/articles/115008171688>

Write は `POST https://{host}/v1/{resource}`、`Content-Type: application/xml; charset=UTF-8`、
ヘッダに Access Token。詳細は [authentication.md][authentication-md] / [resource-api.md][resource-api-md]。

## 標準フォーマット

```xml
<{Resource}>
  <Item>
    <Alias>値</Alias>
    ...
  </Item>
</{Resource}>
```

- `<Item>` を複数並べて**一括書き込み**できる（1 リクエスト最大 **200 件**）。
- **新規作成は `{Resource}.P_Id` に `-1`**、**更新は対象 ID** を指定。1 リクエスト内で新規と更新を混在可。
- `P_Owner`（User 型）は**新規作成時は通常必須**。`P_RegisteredBy` / `P_UpdatedBy` は省略時に自動割当。
- `P_RegistrationDate` / `P_UpdateDate`（System[DateTime]）は **Write 不可**。

## データ型ごとの書式

- **Number**: 小数第 3 位以下は切り捨て。
- **Option**: `<FieldAlias><OptionAlias/></FieldAlias>`。複数選択は Option Alias を並べる。**末端 Alias のみ**（子を持つ選択肢は不可）。
- **System[Reference] / User**: **ID のみ** `<FieldAlias>123</FieldAlias>`。
  - 参照先 ID の出どころに注意（例: `{Resource}.P_Candidate` は `Person.P_Id`）。詳細は [field-data-types.md][field-data-types-md]。
- **Link**: ID のみ `<FieldAlias>10001</FieldAlias>`（Contact ID 等）。`X-P-ConnectAPI-Version: 2` 必須。
- **Image**: `<FieldAlias><FileName/><ContentType/><Content/></FieldAlias>`。
  - `Content` は Base64（**2MB 以下**）、`ContentType` は image/jpeg・gif・png・bmp、`FileName` は 255 バイト以下。

### 例（Resume の新規＋更新を 1 リクエストで）

```xml
<Resume>
  <Item>
    <Resume.P_Id>-1</Resume.P_Id>
    <Resume.P_Owner>5</Resume.P_Owner>
    <Resume.P_Candidate>1001</Resume.P_Candidate>
    <Resume.P_Name>レジュメ名称</Resume.P_Name>
  </Item>
  <Item>
    <Resume.P_Id>10347</Resume.P_Id>
    <Resume.P_Name>レジュメの名称2</Resume.P_Name>
  </Item>
</Resume>
```

## Phase の更新（特殊な制約）

Phase 関連項目（`{Resource}.P_Phase` / `P_PhaseDate` / `P_PhaseMemo` ほか）は
Client / Recruiter / Job / Candidate / Resume / Process / Sales / Activity に標準で存在する。

- 更新時、指定する Phase は**現在の最新 Phase に対して「最新」となる条件**を満たす必要がある:
  1. **フェーズ日付が現在の最新 Phase より新しい**こと
  2. （日付が同じ場合）フェーズ選択肢の並び順がより大きいこと（互換用・将来非保証 → 原則は日付で新しく）
- 同じ Phase で他項目のみ変更 → 最新 Phase を**上書き更新**。異なる Phase を指定 → **新しい Phase として追加**。
- 新規登録時は既存 Phase が無いため実質制約なし。ただし**フェーズ日付・メモはフェーズと必ずセット**で指定する
  （単体指定は不可。Result Code 127）。

[authentication-md]: ../authentication/README.md
[resource-api-md]: README.md
[field-data-types-md]: field-data-types.md
