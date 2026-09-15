[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PhaseSearchQuery

# Type Alias: PhaseSearchQuery

> **PhaseSearchQuery** = [`SearchQuery`](SearchQuery.md)\<*typeof* `FIELDS`\>

Defined in: [src/resources/phase.ts:95](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L95)

Phase's Read query. Same shape as the other 12 data resources — Phase rides the generic factory
(ADR-0061 案1a), so `SearchQuery` comes with it whole.

VERIFY(live): that whole includes `keywords` and `itemstate`, which **Phase - Read does not
list** among its Input Variables (it lists partition / resource / resourceId / id / field /
condition / order / count / start). Passing either sends it; whether PORTERS ignores it or
rejects the call is unknown — see LV-25 in docs/live-verification.md. If it is rejected, the fix
is to drop the two from this type.
