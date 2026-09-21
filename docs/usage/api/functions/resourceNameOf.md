[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / resourceNameOf

# Function: resourceNameOf()

> **resourceNameOf**(`value`): `number` \| `"candidate"` \| `"client"` \| `"recruiter"` \| `"job"` \| `"contact"` \| `"opportunity"` \| `"activity"` \| `"contract"` \| `"resume"` \| `"sales"` \| `"process"`

Defined in: [src/resources/resource-list.ts:81](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/resource-list.ts#L81)

The name for a resource number — the other direction of [resourceValueOf](resourceValueOf.md).
Use it to read a value PORTERS returned: `Activity.P_Resource`, `Field.P_ResourceType`, or a
raw value from [rawValue](rawValue.md).

**A number PORTERS added since this version comes back as the number**, not `undefined` and not
an error. The Resource List belongs to PORTERS and grows (Contact `27` arrived that way), so a
value this library does not know is data, not a fault.

## Parameters

### value

`number`

## Returns

`number` \| `"candidate"` \| `"client"` \| `"recruiter"` \| `"job"` \| `"contact"` \| `"opportunity"` \| `"activity"` \| `"contract"` \| `"resume"` \| `"sales"` \| `"process"`

## Example

```ts
const a = await t.activity.get(1);
resourceNameOf(a?.P_Resource ?? 0); // "candidate" | … | number
```
