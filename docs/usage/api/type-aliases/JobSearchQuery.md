[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / JobSearchQuery

# Type Alias: JobSearchQuery\<C\>

> **JobSearchQuery**\<`C`\> = [`SearchQuery`](SearchQuery.md)\<*typeof* `FIELDS` & `C`, *typeof* `REFERENCES`\>

Defined in: [src/resources/job.ts:112](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/job.ts#L112)

The Job Read query. `C` is the declared custom-field catalog merged on, so a condition or an
order can name a custom field too.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`
