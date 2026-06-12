# Architecture Decision Records (ADR)

このディレクトリは `@joymerrevent/porters-connect` の設計判断を、決めた理由ごと残す場所です。
`SPEC_v1.md` は**素案**であり、ここで議論・確定した内容が正となります。

## ADR とは

「なぜその設計にしたか」を 1 判断 1 ファイルで残す軽量な記録です。
コードを読んでも分からない「選ばなかった選択肢」と「その理由」を未来の自分／貢献者に伝えます。
形式は [MADR（Markdown Any Decision Records）](https://adr.github.io/madr/) のフル版に準拠します。

## 運用ルール

- 1 判断 = 1 ファイル。ファイル名は `NNNN-kebab-title.md`（連番 + 内容）。
- ステータスは次のいずれか：`proposed`（議論中）/ `accepted`（確定）/ `rejected`（不採用）/ `deprecated`（廃止）/ `superseded by NNNN`（後続で置換）。
- 一度 `accepted` した ADR は**書き換えず**、変えたくなったら新しい ADR を起こして旧 ADR を `superseded by NNNN` にする。
- 雛形は [`0000-template.md`](0000-template.md)（MADR フル）をコピーして使う。
- セクション構成：Context and Problem Statement → Decision Drivers → Considered Options → Decision Outcome（+ Consequences）→ Pros and Cons of the Options → More Information。

## 一覧

| #                                             | タイトル                 | ステータス |
| --------------------------------------------- | ------------------------ | ---------- |
| [0001](0001-record-architecture-decisions.md) | ADR で設計判断を記録する | accepted   |

## 論点バックログ（今フェーズで詰める）

依存関係の浅い順に 1 つずつ詰める。番号は確定時に採番する。

| 候補 # | 論点                                                                             |
| ------ | -------------------------------------------------------------------------------- |
| 0002   | HTTP トランスポート（標準 `fetch` か `ky` か）＋ リトライ/スロットリング         |
| 0003   | エラーモデル（判別可能 union の設計）                                            |
| 0004   | OAuth トークンのライフサイクル（`code` / `code_direct`・取得・キャッシュ・更新） |
| 0005   | XML → 型 の戦略（手書き型 + テスト担保 / スキーマ駆動）                          |
| 0006   | 公開 API の形（`PortersClient` のオプション・リソースアクセサの返り値型）        |
| 0007   | ページング・検索条件の抽象化                                                     |
| 0008   | 日時の UTC ↔ JST 取り扱い                                                        |
