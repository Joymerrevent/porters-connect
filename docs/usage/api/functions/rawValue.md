[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / rawValue

# Function: rawValue()

> **rawValue**(`record`, `alias`): `string` \| `null` \| `undefined`

Defined in: [src/resources/core/read.ts:87](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/core/read.ts#L87)

Read a field the catalog does not know — the named escape hatch for a value that
arrived without a declaration: through a cast in `field`, inside an expanded reference record,
or because PORTERS returned a field that was not asked for.

Returns what the record actually holds, unconverted:

- `undefined` — the alias is not on the record (it was never returned)
- `null` — it is there but not a scalar (PORTERS sends a nested node for Option / User / Image)
- `string` — the raw text, exactly as PORTERS sent it

**No conversion happens.** A date comes back in PORTERS' own format (`2026/09/10 12:00:00`), not
ISO 8601, and a number comes back as text. Declare the field with `defineFields` to get the
converted, typed value instead — this is the escape hatch, not the normal path.

## Parameters

### record

`unknown`

### alias

`string`

## Returns

`string` \| `null` \| `undefined`

## Example

```ts
const page = await t.candidate.search({ field: ["P_Name"] });
const memo = rawValue(page.items[0], "U_memo"); // string | null | undefined
```
