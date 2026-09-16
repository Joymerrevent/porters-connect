[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FieldAccessor

# Type Alias: FieldAccessor

> **FieldAccessor** = `object`

Defined in: [src/resources/field.ts:95](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/field.ts#L95)

Field Read is reached through the resource whose catalog you want (ADR-0080):

```ts
const fields = t.field.of("candidate");
for await (const f of fields.searchAll({ active: 1 })) console.log(f.P_Alias);
```

The name is the accessor's own spelling ([ResourceName](ResourceName.md)) — `of(1)` and `of("candidat")`
are compile errors. PORTERS requires the `resource=` parameter on every Field Read, so binding
it once means it cannot be forgotten or contradicted.

## Methods

### of()

> **of**(`resource`): [`FieldResource`](FieldResource.md)

Defined in: [src/resources/field.ts:96](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/field.ts#L96)

#### Parameters

##### resource

`"candidate"` \| `"client"` \| `"recruiter"` \| `"job"` \| `"contact"` \| `"opportunity"` \| `"activity"` \| `"contract"` \| `"resume"` \| `"sales"` \| `"process"`

#### Returns

[`FieldResource`](FieldResource.md)
