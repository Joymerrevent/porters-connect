[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PhaseAccessor

# Type Alias: PhaseAccessor

> **PhaseAccessor** = `object`

Defined in: [src/resources/phase.ts:137](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L137)

Phase is reached through the resource whose history you want (ADR-0061 案2a):

```ts
const phases = t.phase.of("client");
await phases.search({ condition: { ResourceId: { eq: 20001 } } });
```

The name is the accessor's own spelling ([ResourceName](ResourceName.md)) — `of(5)` and `of("clinet")`
are compile errors (案5b).

## Methods

### of()

> **of**(`resource`): [`PhaseResource`](PhaseResource.md)

Defined in: [src/resources/phase.ts:138](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L138)

#### Parameters

##### resource

`"candidate"` \| `"client"` \| `"recruiter"` \| `"job"` \| `"contact"` \| `"opportunity"` \| `"activity"` \| `"contract"` \| `"resume"` \| `"sales"` \| `"process"`

#### Returns

[`PhaseResource`](PhaseResource.md)
