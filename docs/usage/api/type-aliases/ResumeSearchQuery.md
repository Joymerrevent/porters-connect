[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ResumeSearchQuery

# Type Alias: ResumeSearchQuery\<C\>

> **ResumeSearchQuery**\<`C`\> = [`SearchQuery`](SearchQuery.md)\<*typeof* `FIELDS` & `C`, *typeof* `REFERENCES`\>

Defined in: [src/resources/resume.ts:109](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/resume.ts#L109)

The Resume Read query. `C` is the declared custom-field catalog merged on, so a condition or an
order can name a custom field too.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`
