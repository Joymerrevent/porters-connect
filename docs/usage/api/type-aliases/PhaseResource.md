[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PhaseResource

# Type Alias: PhaseResource

> **PhaseResource** = `Resource`\<*typeof* `FIELDS`, *typeof* `REQUIRED_ON_CREATE`\[`number`\], `EmptyReferences`, `PhaseUnsupportedQuery`, `"Resource"`\>

Defined in: [src/resources/phase.ts:122](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L122)

The Phase accessor for one bound resource — the same shape as every other resource, except that
`search` / `searchAll` do not take `keywords` / `itemstate` and the write inputs do
not take `Resource`: `of()` binds it, and supplying it again could only contradict the binding.
