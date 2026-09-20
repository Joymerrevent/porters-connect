# 82. CJS は別実体を配らず `require` 条件で解決し、Node の下限を 22 に上げる

- Status: accepted
- Date: 2026-09-18
- Deciders: jun.shiromoto (Joymerrevent)

> [PRD §8][prd] に **2026-08-09 から残っていた未決**（「v1 で CJS 出力まで出すか」）の決着。
> **decider が案D ＋ Node 22 を選択し `accepted`（2026-09-18）。** 実装は accept 後・別 PR。
>
> `1.0.0` の完成条件 V3（判断待ちが 0 になるまで進めない）の 1 件目。

## Context and Problem Statement

CLAUDE.md は「ESM 前提、可能なら CJS も出力」と書き、[PRD §6][prd] は CJS 出力を **P2（v1 では
作らない）** に置き、[ロードマップ][rm]の「将来」節にも入れてある。一方 [PRD §8][prd] は
「v1 で出すか」を**未決**のまま残していた。**3 か所が食い違っている。**

**まず前提を測り直した**（2026-09-18・実測）。「ESM だけでも `require` はできる」と考えていたが、
公開中の 0.18.0 を実際に入れて叩くと**できない**。

```console
$ npm i @joymerrevent/porters-connect && node -e "require('@joymerrevent/porters-connect')"
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined
```

`exports` が `import` 条件しか持たないので、**CJS からの入口が無い**。TypeScript 側も
`moduleResolution: node16` の CJS 利用者で `TS1479` になり、**実行時もコンパイル時も使えない**。

問い: **CJS 利用者に入口を出すか。出すならどの形か。**

## Decision Drivers

- **薄く・堅く**（CLAUDE.md）。配布物と分岐を増やさない。
- **フェイルセーフ**＝壊れたときに安全側へ倒れる。**黙って別物になる形を採らない**。
- **エラーモデルは `instanceof` に立っている**（[ADR-0006][adr6]）。ここが壊れると `catch` を
  すり抜ける＝利用者のアプリが落ちる。
- 未決を 3 か所に散らしたままにしない（`1.0.0` の前提）。

## Considered Options

- 案A: **現状維持**（ESM のみ・`require` 条件を出さない）
- 案B: **dual**（`index.cjs` を別実体として配り、`require` 条件をそれに向ける）
- 案D: **`require` 条件も ESM 実体に向ける**（Node の `require(esm)` に載せる・型は `.d.cts`）

（案C＝「需要が出るまで保留」は、未決を閉じないので選択肢にならない。）

## Decision Outcome

採用: **案D**。あわせて **`engines.node` を `>=22.12.0` に上げる**（Node 20 を切る）。

3 案を**実際に tarball を作り、一時プロジェクトへ入れて**比べた結果（2026-09-18・Node 24.3.0）:

| 観点                             | 案A 現状          | 案B dual          | 案D `require`→ESM  |
| -------------------------------- | ----------------- | ----------------- | ------------------ |
| `require()` 実行時               | **失敗**          | OK                | OK                 |
| CJS の TS 利用者（`node16`）     | **失敗** `TS1479` | OK                | OK                 |
| `instanceof` が ESM/CJS をまたぐ | —                 | **`false`**       | **`true`**         |
| `dist` サイズ                    | 628K              | **1.2M（約2倍）** | 768K（下記の訂正） |
| ビルド                           | esm 1 本          | esm + cjs 2 本    | esm 1 本           |

**案B を落とした理由は `instanceof` である。** ESM と CJS で**別のクラスが 2 つ**読まれるため、
CJS 側で起きたエラーが ESM 側の `catch (e) { if (e instanceof PortersError) … }` を通らない
（実測で `false`）。[ADR-0006][adr6] のエラーモデルはこの分岐の上に立っているので、
**握りつぶしではなく素通り**＝利用者のアプリが落ちる。安全側に倒れない。
サイズ 2 倍はその次の理由でしかない。

**案D は実体が 1 つのまま**なので、同じ検査が `true` になる。`require` 条件を同じ ESM
ファイルへ向け、型だけ `index.d.cts` として置く（`.d.ts` と**内容が同一**なのでコピーで足りる）。

> **訂正（2026-09-18・0.19.0 の公開後）**: 上表の案D「628K（据え置き）」は**誤り**だった。
> 628K は `index.d.cts` を数えていない値で、**実装した案D の `dist` は 768K**（+140K ＝
> `.d.ts` のコピー 1 つぶん）。公開物でも **7 files / 727.9 kB → 8 files / 872.7 kB** に増えている。
> `.d.cts` を 1 行の再 export にはできない（CJS から ESM の `.d.ts` を読む形になり `TS1479` に戻る）
> ので、コピーである以上この増加は避けられない。**案B（1.2M・実体 2 つ）との比較と結論は変わらない**
> — 増えたのは型定義だけで、実行時の実体は 1 つのままだから `instanceof` は壊れない。

```jsonc
"exports": {
  ".": {
    "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "require": { "types": "./dist/index.d.cts", "default": "./dist/index.js" }
  }
}
```

### Node の下限を 22 に上げる

案D は Node の **`require(esm)`** に載っている。公式 changelog で確認した成立条件:

| Node                      | `require(esm)`                    |
| ------------------------- | --------------------------------- |
| 22.12.0（2024-12）        | 既定で有効                        |
| 20.19.0（2025-03）        | 既定で有効（20 系へバックポート） |
| 20.0〜20.18 / 22.0〜22.11 | **無い**（`ERR_REQUIRE_ESM`）     |

`engines` は `>=20` のままで、**Node 20 は 2026-04-30 に EOL** を迎えている（Node の
release schedule）。前提を人の記憶ではなく **`engines` で保証する**ため、**成立する最小の形＝
`>=22.12.0`** を宣言する。丸めて `>=22` と書くと 22.0〜22.11 に対して嘘になる。

副次的に、**Node 20 で `changeset` コマンドが動かない**という開発側の制約
（[runbook][rb]）も、下限を上げることで消える。

トップレベル `await` は `src/` に無い（実測）ので、`ERR_REQUIRE_ASYNC_MODULE` には当たらない。

### Consequences

- Good: **CJS 利用者に入口ができる**（実行時・型とも）。未決が閉じ、3 か所の食い違いも解消する。
- Good: **配布物が増えない**。実体が 1 つなので `instanceof` が壊れない
  （正確には**型定義が 1 つ増える** — 上の訂正を参照。増えないのは**実体**）。
- Good: EOL のランタイムを支えるのをやめる。CI のマトリクスも 1 本減る。
- Bad: **Node 20 を切る＝破壊的変更**（`engines` の引き上げ）。20 に留まる利用者は上げる必要がある。
- Bad: **`require` 条件を「CJS ファイル」と決め打ちするツール**は、ESM を渡されて解析に失敗しうる
  （CJS トランスフォームの Jest 等）。実例が出たら `module-sync` 条件 ＋ `.cjs` フォールバックへ
  広げられる（Node が公式に用意している逃げ道）。**いまは持たない** — `.cjs` を持たない以上、
  `module-sync` は `require` と同じファイルを指すだけで、分岐を増やすだけになるため。
- Neutral: `main` は `exports` を見ないツール向けの後方互換でしかない。ESM を指したまま置く。

## 信じている入力

| 値                                   | 出どころ                        | 誰が書けるか | 守り方                                        | 誤っていたら                            |
| ------------------------------------ | ------------------------------- | ------------ | --------------------------------------------- | --------------------------------------- |
| `require(esm)` が 22.12 以降で既定   | Node 公式 changelog（実読）     | Node 側      | `engines` で下限を宣言                        | `require` が `ERR_REQUIRE_ESM` で落ちる |
| 3 案の実測結果                       | **手元で tarball を入れて実行** | —            | 仕組み（下記の検査を CI に置く）              | 検査が落ちる                            |
| `src/` にトップレベル `await` が無い | 実測（grep）                    | 本リポジトリ | 仕組み（同上。混入したら `require` が落ちる） | `ERR_REQUIRE_ASYNC_MODULE`              |

**この決定は「Node の `require(esm)` が動き続ける」に賭けている。** 外れたときに気づけるように、
**CJS の入口を CI で実際に叩く**検査を置く（`require()` が通ること・CJS の TS 利用者が
コンパイルできること）。今回の食い違いは**誰も叩いていなかった**から 0.18.0 まで残った。

## Pros and Cons of the Options

### 案A（現状維持）

- Good: 何も増えない。
- Bad: CJS 利用者が**実行時もコンパイル時も使えない**まま。未決も閉じない。
- Bad: CLAUDE.md の「可能なら CJS も出力」と食い違ったままになる。

### 案B（dual）

- Good: 広く使われている枯れた形。古いツールチェーンでも確実に動く。
- Bad: **`instanceof` が ESM/CJS をまたげない**（実測）。エラーモデルの前提が壊れる。
- Bad: 配布サイズが約 2 倍。ビルドと検査の本数が増える。

### 案D（`require` 条件も ESM へ・採用）

- Good: 実体が 1 つ＝`instanceof` が壊れない。ビルドは 1 本のまま
  （**サイズは据え置きではない** — 型定義 1 つぶん増える。上の訂正を参照）。
- Bad: Node 20 を切る必要がある。`require` を CJS 決め打ちで読むツールには弱い。

## More Information

- 前提: [ADR-0006][adr6]（エラーモデル＝`instanceof` の分岐）／ [PRD §6・§8][prd]（P2 と未決）／
  [ロードマップ][rm]（V3・判断待ち）
- 反映（accept 後・別 PR）: `package.json`（`exports` の `require` 条件・`engines`・`build` の
  target）、`.d.cts` の生成、CI マトリクスから Node 20 を外す、**CJS の入口を叩く検査**、
  README / `docs/usage/start/install.md` / [PRD R-14][prd] / CLAUDE.md の「Node 20+」表記、
  CHANGELOG（**Breaking** — `engines` の引き上げ）

[adr6]: 0006-error-model.md
[prd]: ../design/requirements.md
[rm]: ../roadmap.md
[rb]: ../release-runbook.md
