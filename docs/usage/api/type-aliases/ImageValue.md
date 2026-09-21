[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ImageValue

# Type Alias: ImageValue

> **ImageValue** = \{ \[K in ImageSubField\]?: string \| null \}

Defined in: [src/xml/decode.ts:65](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/decode.ts#L65)

A decoded Image value: the sub-tags PORTERS actually returned, each empty ->
null. Every key is **optional for the same reason a read record's fields are** — a sub-tag that
was not requested is simply absent. A plain read asks for the bare alias, which PORTERS answers
with `FileName` alone; `image` selects more and narrows this to exactly what it selected.
