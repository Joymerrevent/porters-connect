[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / CandidateSearchQuery

# Type Alias: CandidateSearchQuery\<C\>

> **CandidateSearchQuery**\<`C`\> = [`SearchQuery`](SearchQuery.md)\<*typeof* `FIELDS` & `C`\>

Defined in: [src/resources/candidate.ts:87](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/candidate.ts#L87)

The Candidate Read query. `C` is the declared custom-field catalog merged on, so a condition or an
order can name a custom field too.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`
