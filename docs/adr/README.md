# Architecture Decision Records (ADR)

このディレクトリは `@joymerrevent/porters-connect` の設計判断を、決めた理由ごと残す場所です。
`SPEC_v1.md` は**素案**であり、ここで議論・確定した内容が正となります。

## ADR とは

「なぜその設計にしたか」を 1 判断 1 ファイルで残す軽量な記録です。
コードを読んでも分からない「選ばなかった選択肢」と「その理由」を未来の自分／貢献者に伝えます。
形式は [MADR（Markdown Any Decision Records）](https://adr.github.io/madr/) のフル版に準拠します。

## 運用ルール

- 1 判断 = 1 ファイル。ファイル名は `NNNN-kebab-title.md`（連番 + 内容）。
- **番号は ADR を起票する時に採番**する（その時点の最大番号 + 1）。**連番のみ・欠番や振り直し・再利用はしない**。
  バックログには番号を振らない（差し込みのたびに番号と参照を直す事故を防ぐため）。
- **未起票の ADR を参照するときは番号でなくトピック名で指す**（例: 「→ 型設計の ADR」）。起票後にリンクへ更新してよい。
- ステータスは次のいずれか：`proposed`（議論中）/ `accepted`（確定）/ `rejected`（不採用）/ `deprecated`（廃止）/ `superseded by NNNN`（後続で置換）。
- 一度 `accepted` した ADR は**書き換えず**、変えたくなったら新しい ADR を起こして旧 ADR を `superseded by NNNN` にする。
- 雛形は [`0000-template.md`](0000-template.md)（MADR フル）をコピーして使う。
- セクション構成：Context and Problem Statement → Decision Drivers → Considered Options → Decision Outcome（+ Consequences）→ Pros and Cons of the Options → More Information。

## 一覧

| #                                              | タイトル                                       | ステータス |
| ---------------------------------------------- | ---------------------------------------------- | ---------- |
| [0001](0001-record-architecture-decisions.md)  | ADR で設計判断を記録する                       | accepted   |
| [0002](0002-ground-design-in-live-api-docs.md) | v1 設計を実 PORTERS API ドキュメントに接地する | accepted   |

## 論点バックログ（今フェーズで詰める・未起票）

**番号は付けない**（起票時に採番）。上から依存の浅い順。前方参照はトピック名で行う。

- **HTTP トランスポート** — 標準 `fetch` か `ky` か ＋ リトライ/スロットリング
- **エラーモデル** — 判別可能 union の設計
- **OAuth トークンのライフサイクル** — `code` / `code_direct`・取得・キャッシュ・更新
- **型設計（XML → 型）** — 手書き型 + テスト担保 / スキーマ駆動、カスタム項目の扱い
- **公開 API の形** — `PortersClient` のオプション・リソースアクセサの返り値型
- **ページング・検索条件の抽象化**
- **日時の UTC ↔ JST 取り扱い**
