[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / resourceValueOf

# Function: resourceValueOf()

> **resourceValueOf**(`name`): `number`

Defined in: [src/resources/resource-list.ts:63](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/resource-list.ts#L63)

The number PORTERS knows a resource by (ADR-0079). The library takes **names** where PORTERS
takes a `resource=` parameter, but a *field value* stays the number its Data Type declares —
`Activity.P_Resource`, `Attachment.Resource`, and a `condition` on either.

Write the name and let this do the lookup; the numbers are non-contiguous
(1/3/5/7/9/11/13/17/19/25/27), so a literal is easy to get wrong and impossible to spot.

## Parameters

### name

`"candidate"` \| `"client"` \| `"recruiter"` \| `"job"` \| `"contact"` \| `"opportunity"` \| `"activity"` \| `"contract"` \| `"resume"` \| `"sales"` \| `"process"`

## Returns

`number`

## Example

```ts
await t.activity.create({
  P_Owner: 5,
  P_Title: "面談",
  P_Resource: resourceValueOf("candidate"), // 1
  P_ResourceId: 10001,
});
```
