[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / resourceNameOf

# Function: resourceNameOf()

> **resourceNameOf**(`value`): `number` \| `"candidate"` \| `"job"` \| `"client"` \| `"process"` \| `"recruiter"` \| `"sales"` \| `"contract"` \| `"resume"` \| `"activity"` \| `"opportunity"` \| `"contact"`

Defined in: [src/porters/resource-list.ts:71](https://github.com/Joymerrevent/porters-connect/blob/main/src/porters/resource-list.ts#L71)

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

`number` \| `"candidate"` \| `"job"` \| `"client"` \| `"process"` \| `"recruiter"` \| `"sales"` \| `"contract"` \| `"resume"` \| `"activity"` \| `"opportunity"` \| `"contact"`

## Example

```ts
const a = await t.activity.get(1);
resourceNameOf(a?.P_Resource ?? 0); // "candidate" | … | number
```
