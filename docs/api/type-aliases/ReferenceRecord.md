[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ReferenceRecord

# Type Alias: ReferenceRecord

> **ReferenceRecord** = `object`

Defined in: [src/xml/decode.ts:78](https://github.com/Joymerrevent/porters-connect/blob/main/src/xml/decode.ts#L78)

An **expanded** `System[Reference]` value: the referenced record's requested fields, decoded by
the referenced resource's own catalog (ADR-0058). Only a read that asked for the expansion
(`expand`) produces one — without it a reference decodes to the referenced id (`number`).

## Index Signature

\[`alias`: `string`\]: [`FieldValue`](FieldValue.md)
