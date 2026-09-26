[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / RecruiterSearchQuery

# Type Alias: RecruiterSearchQuery\<C\>

> **RecruiterSearchQuery**\<`C`\> = [`SearchQuery`](SearchQuery.md)\<*typeof* `FIELDS` & `C`, *typeof* `REFERENCES`\>

Defined in: [src/resources/recruiter.ts:102](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/recruiter.ts#L102)

The Recruiter Read query. `C` is the declared custom-field catalog merged on, so a condition or an
order can name a custom field too.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`
