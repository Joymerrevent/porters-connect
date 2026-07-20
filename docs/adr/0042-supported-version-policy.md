# 42. 対応 PORTERS / API バージョンの表記方針（Connect API Version を契約の正とする）

- Status: proposed
- Date: 2026-07-20
- Deciders: jun.shiromoto (Joymerrevent)

> [requirements §8][prd] のオープン論点 [eng]「**対応 PORTERS バージョンとして何を明記するか**（製品 8.x/9.x と
> API version 1/2 の関係）」を確定する。[[0033-post-mvp-direction]] 案E（採用の地固め）の一部。README には既に
> 「Connect API Version 2 / PORTERS 8.x・9.x 想定」と**記載はある**が、**何を互換性の約束（契約）とするかの方針が未定**で、
> 追従判断の基準も曖昧だった。本 ADR は**方針を明文化**して §8 を閉じる。
> **stakeholder は 2026-07-20 の議論で案A（API version を契約の正）を選択**。本 ADR は `proposed`（decider の accept 待ち）。
> **反映（README「対応バージョン」節・コードコメント・PRD 整合）は accept 後・別 PR。**

## Context and Problem Statement

PORTERS には 2 系統のバージョンがある：

- **製品バージョン**（PORTERS 8.x → 9.x …）: 顧客テナントが動いている製品世代。**更新が速く**、非公式ラッパー側で
  全数を追跡・検証できない。
- **Connect API Version**（HTTP ヘッダ `X-P-ConnectAPI-Version`。値は **1 / 2**、**現行最新は 2**）: API の
  インターフェース版。**担当者型・ユーザー型・部署型 Link は `2` 以降が必須**（[headers][headers]／[field-data-types][fdt]）。

現状の事実（接地）:

- ライブラリは **`X-P-ConnectAPI-Version: 2` を既定送信**する（`src/http/requester.ts` の `API_VERSION`・[[0009-http-transport]]）。
  Link 等 v2 前提の機能に依存するため、**実質 v2 が動作の前提**。
- README「対応バージョン」節は「Connect API Version 2／PORTERS 8.x・9.x を想定」と**併記**するのみで、
  **どちらが約束（契約）か・更新にどう追従するか**が未定。PRD R-14 は「対応 PORTERS / API バージョンを README・コードに明記」を要求。

問い: **(a) 互換性の約束を何に置くか**（API version か 製品版か）、**(b) 追従（新バージョン登場時）の判断基準**、
**(c) 明記の文面・箇所**。

## Decision Drivers

- **フェイルセーフ**: 検証できるものだけ約束する。全数検証できない製品マイナーを「対応」と言い切らない。
- **API 忠実 / 接地**（[[0002-ground-design-in-live-api-docs]]）: reference の事実（API version = インターフェースの版単位・Link は v2 必須）に接地する。
- **保守性 / 追従判断の単純さ**: 利用者ストーリー「アップデート追従を判断したい」に、ブレない基準で応える。
- **利用者の直感**: 読者は自社の製品世代を知っている。製品版にも触れておく価値はある（ただし約束ではなく参考）。

## Considered Options

- **案A**: **API version を契約の正**とし、製品版は参考情報として併記。
- **案B**: **製品バージョン（8.x/9.x）を第一**に明記し、API version は補足。
- **案C**: 両方を**対等に併記**し、どちらが契約かは決めない（現状維持・方針保留）。

## Decision Outcome

**選択: 案A**（stakeholder が 2026-07-20 に選択・recommended）。`accepted` は decider の明示承認を待つ。

明文化する方針:

1. **互換性の契約 = Connect API Version 2**。ライブラリは `X-P-ConnectAPI-Version: 2` を既定送信し、**v2 を動作の前提**とする
   （値は 1/2、既定 2。Link 等は v2 必須）。「対応」と言い切るのはこの API version。
2. **製品バージョン（PORTERS 8.x / 9.x）は参考情報**として併記する（「Connect API v2 が提供される PORTERS 製品世代」）。
   個別の製品マイナーの動作保証はしない。
3. **追従ポリシー**: **API version が変わったとき**（例: v3 登場）に対応方針を新 ADR で見直す。製品版は
   正典 [docs/reference][ref] が実 API に接地している範囲で言及する（reference が一次情報）。
4. **明記箇所**: README「対応バージョン」節（**契約 = v2 → 製品 = 参考**の順で明文化）／コードコメント（`requester.ts` の
   `API_VERSION` 付近）／PRD R-14 と整合。**（反映は accept 後・別 PR）**

### Consequences

- 良い: 約束が**検証可能で安定**。追従判断が単純（API version を見る）。フェイルセーフ。
- 中立/悪い: **製品版の厳密な対応表は出さない**（利用者が「自社製品版 → 使える API version」を確認したい場面は残る）。
  → [headers][headers]（値 1/2・現行 2）と [field-data-types][fdt]（Link=v2 必須）で補える。
- §8 の当該論点（対応バージョン表記）は**クローズ**。他の §8 項目（成功指標の数値化タイミング・npm/組織名最終確認 等）は別途。

## Pros and Cons of the Options

### 案A（API version を契約の正）← 採用

- 良い: ライブラリが実際に依存するのは API version（v2 送信・Link は v2 必須）＝**実態と一致**。全数検証できない製品版を約束しない＝フェイルセーフ。追従基準が単純。
- 悪い: 読者が自社製品版から API version を引く一手間が残る（reference で補完）。

### 案B（製品バージョンを第一）

- 良い: 読者の直感（自社の製品世代）に最も近い。
- 悪い: 製品更新が速く**全数検証不能**＝約束が脆い。非公式ラッパーが製品マイナー対応表を保証するのは過剰約束。

### 案C（対等併記・方針保留＝現状維持）

- 良い: 追加作業ゼロ。
- 悪い: 「**何を約束したか**」が曖昧なまま。PRD §8 が未解決で残り、リリースの地固めが進まない。

## More Information

- 要件: [requirements §8][prd]（オープン論点）／ R-14（対応バージョン明記）
- 事実（接地）: [headers][headers]（`X-P-ConnectAPI-Version` 値 1/2・現行 2）／[field-data-types][fdt]（Link は v2 必須）／[docs/reference][ref]
- 関連 ADR: [[0002-ground-design-in-live-api-docs]]（接地方針）／[[0009-http-transport]]（`X-P-ConnectAPI-Version: 2` 既定送信）／[[0033-post-mvp-direction]]（案E）

[prd]: ../design/requirements.md
[ref]: ../reference/README.md
[headers]: ../reference/authentication-api/headers.md
[fdt]: ../reference/resource-api/field-data-types.md
