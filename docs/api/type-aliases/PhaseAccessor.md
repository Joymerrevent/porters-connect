[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PhaseAccessor

# Type Alias: PhaseAccessor

> **PhaseAccessor** = `object`

Defined in: [src/resources/phase.ts:112](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L112)

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

Defined in: [src/resources/phase.ts:113](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L113)

#### Parameters

##### resource

`"candidate"` \| `"client"` \| `"recruiter"` \| `"job"` \| `"contact"` \| `"opportunity"` \| `"activity"` \| `"contract"` \| `"resume"` \| `"sales"` \| `"process"`

#### Returns

[`PhaseResource`](PhaseResource.md)
