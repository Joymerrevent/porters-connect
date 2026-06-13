# 1. ADR で設計判断を記録する

- Status: accepted
- Date: 2026-06-12
- Deciders: jun.shiromoto (Joymerrevent)

## Context and Problem Statement

`SPEC_v1.md` は調査ベースの**素案**で、主要な設計判断（HTTP・エラー型・OAuth ライフサイクル・XML→型・公開 API など）はまだ議論・確定していない。
本ライブラリの哲学は**フェイルセーフ**＝「壊れたときに安全側へ倒れるものを作る」で、長く保守し将来は外部貢献者も迎える前提。
設計判断の「なぜ」を、どこに・どの形式で残すか？

## Decision Drivers

- 「選ばなかった案とその理由」を後から追えること（コード・コミットログには残らない）
- 論点を分割して 1 つずつ合意形成できること
- 既存の lint / format / CI パイプラインにそのまま乗る軽さ
- 外部貢献者がオンボードしやすい標準的な形式であること

## Considered Options

- 案A: ADR を [MADR][ref1] 形式で `docs/adr/` に 1 判断 1 ファイルで記録
- 案B: `SPEC` を直接書き換え続ける
- 案C: Issue / PR の議論だけで管理

## Decision Outcome

採用: **案A（ADR / MADR フル形式）**。理由: 判断を 1 ファイル単位に分割でき、選ばなかった案と理由が残り、
Markdown だけなので既存パイプラインにそのまま乗る。標準形式なので貢献者にも伝わりやすい。
運用ルールは [README.md][ref2] に従う。

### Consequences

- Good: 設計の透明性・再現性。議論の単位化。貢献者のオンボードが楽。
- Bad: ADR を書く一手間がかかる（雛形 `0000-template.md` で軽減）。
- Neutral: 確定後は不変。変更は新しい ADR で supersede する。

## Pros and Cons of the Options

### 案A: ADR（MADR）

- Good: 1 判断 1 ファイルで追いやすい。標準形式でツール・貢献者に優しい。判断基準と各案の比較が構造化される。
- Bad: 記述コストがかかる。

### 案B: SPEC 直接書き換え

- Good: 置き場所が 1 つで単純。
- Bad: 「なぜ変えたか」が履歴に残らず、議論の経緯が消える。

### 案C: Issue / PR の議論のみ

- Good: 追加ファイル不要。
- Bad: リポジトリ単体で完結せず後から追いにくい。ホスティング先に依存する。

## More Information

- 形式: [MADR][ref1] フル。運用ルールは [README.md][ref2]。
- 関連: `SPEC_v1.md`, `CLAUDE.md`

[ref1]: https://adr.github.io/madr/
[ref2]: README.md
