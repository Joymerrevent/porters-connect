[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PhaseSearchQuery

# Type Alias: PhaseSearchQuery

> **PhaseSearchQuery** = `Omit`\<[`SearchQuery`](SearchQuery.md)\<*typeof* `FIELDS`\>, `PhaseUnsupportedQuery`\> & `{ [K in PhaseUnsupportedQuery]?: never }`

Defined in: [src/resources/phase.ts:105](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L105)

Phase's Read query: the common vocabulary **minus `keywords` / `itemstate`**, which
`Phase - Read` does not list.
