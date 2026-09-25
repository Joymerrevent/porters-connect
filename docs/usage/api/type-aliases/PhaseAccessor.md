[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PhaseAccessor

# Type Alias: PhaseAccessor

> **PhaseAccessor** = `object`

Defined in: [src/resources/phase.ts:247](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L247)

Phase is reached through the resource whose history you want:

```ts
const phases = t.phase.of("client");
await phases.search({ condition: { ResourceId: { eq: 20001 } } });
```

The name is the accessor's own spelling ([ResourceName](ResourceName.md)) — `of(5)` and `of("clinet")`
are compile errors.

## Methods

### of()

> **of**(`resource`): [`PhaseResource`](PhaseResource.md)

Defined in: [src/resources/phase.ts:248](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L248)

#### Parameters

##### resource

`"candidate"` \| `"job"` \| `"client"` \| `"process"` \| `"recruiter"` \| `"sales"` \| `"contract"` \| `"resume"` \| `"activity"` \| `"opportunity"` \| `"contact"`

#### Returns

[`PhaseResource`](PhaseResource.md)
