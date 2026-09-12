[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ItemState

# Type Alias: ItemState

> **ItemState** = `"existing"` \| `"deleted"` \| `"all"`

Defined in: [src/resources/query.ts:149](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/query.ts#L149)

Which delete state to read. `existing` reads live data, `deleted`/`all` read deleted records —
the only way to read deleted data, since there is no delete API. When `deleted`/`all`, condition
is restricted to `P_Id` / `P_UpdateDate` / `P_UpdatedBy` and PORTERS auto-adds a "updated within
90 days" filter (`P_UpdateDate` = the delete time, `P_UpdatedBy` = the last editor).

**Omitting the field is not the same as passing `existing`** (ADR-0057). Omitting defers to the
API's own default (today: `existing`); passing `existing` states that you want live records only,
and is sent as such. Both read live data now, but only the explicit form keeps doing so if PORTERS
ever changes that default. Use `itemstate: "existing"` when live-only actually matters to you.
