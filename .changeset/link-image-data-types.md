---
"@joymerrevent/porters-connect": minor
---

`Link` / `Image` の 2 つの Data Type に対応しました（[ADR-0064][adr64]）。
これで **PORTERS の Data Type 17 種すべてを型で表せます**（[ADR-0060][adr60] D3 の完了）。

どちらも**標準項目には 1 つも存在せず**、テナントが作ったカスタム項目としてのみ現れるため、
`defineFields` の宣言が唯一の入口です。

```ts
const fields = defineFields({
  resume: (f) => ({ U_photo: f.image(), U_contact: f.link() }),
});
```

### Image

- **Read の既定は `FileName` のみ**（PORTERS の既定と同じ）。一覧取得が画像本体で重くなりません。
- `ContentType` / `Content`（Base64）が要るときは **`image` オプション**で選びます。選んだサブタグ
  だけが戻り型に出ます。

  ```ts
  const r = await t.resume.get(id, {
    image: { U_photo: ["FileName", "Content"] },
  });
  r?.U_photo; // { FileName: string | null; Content: string | null }
  ```

- **Write に対応**しました。約 15000 文字のリクエスト長ガードは画像を含む書き込みでだけ外し、
  かわりに **decode 後 2MB / ファイル名 255 バイト / mime 4 種（jpeg・gif・png・bmp）** を
  送信前に検査して `PortersConfigError` で弾きます。
- **一括書き込み（`createMany` / `updateMany`）には画像を混ぜられません**。一括は
  「1 リクエスト約 15000 文字」を前提に 200 件ずつへ分割しており、画像はその前提を壊すためです。
  何件目が画像を持つかを添えて送信前に落とし、単発の `create` / `update` へ誘導します。

### Link

- Read は **Contact の ID（`number`）／ `UserRef` ／ `DepartmentRef` の union** です。
  PORTERS は種別の判別子を返さないため、**届いた XML の形**で判別します（宣言では種別を選ばせません
  — ライブラリはテナントの項目設定を検証できず、宣言が間違っていても誰も気づけないため）。
- Write は **ID のみ**です。

`Image` / `Link` はどちらも `condition` / `order` の対象外です（Image は reference が明記、
Link は記載が無いため安全側に倒しています）。

[adr64]: https://github.com/Joymerrevent/porters-connect/blob/develop/docs/adr/0064-link-image-types.md
[adr60]: https://github.com/Joymerrevent/porters-connect/blob/develop/docs/adr/0060-full-resource-coverage-direction.md
