[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PhaseResource

# Type Alias: PhaseResource

> **PhaseResource** = `object`

Defined in: [src/resources/phase.ts:142](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L142)

The Phase accessor for one bound resource — the same shape as every other resource, except that
`search` / `searchAll` do not take `keywords` / `itemstate` and the write inputs do
not take `Resource`: `of()` binds it, and supplying it again could only contradict the binding.

## Methods

### create()

> **create**(`input`): `Promise`\<`number`\>

Defined in: [src/resources/phase.ts:214](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L214)

Create one Phase entry for the bound resource; resolves to the newly assigned id. `Resource`
is filled from the binding and cannot be supplied.

#### Parameters

##### input

`Without`\<[`PhaseCreateInput`](PhaseCreateInput.md), `"Resource"`\>

#### Returns

`Promise`\<`number`\>

***

### createMany()

> **createMany**(`inputs`): `Promise`\<[`BulkWriteResult`](BulkWriteResult.md)\>

Defined in: [src/resources/phase.ts:228](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L228)

Create many Phase entries in one call. Auto-batched to ≤200 entries and under the request
size cap. **Not atomic** — inspect the `BulkWriteResult`: per-entry failures are returned
(`failed` / `hasFailures`), not thrown. Only a whole-request failure throws (with the
already-written count). Batching is non-idempotent: a full retry after a mid-run failure may
duplicate creates. Empty input sends no request.

#### Parameters

##### inputs

`Without`\<[`PhaseCreateInput`](PhaseCreateInput.md), `"Resource"`\>[]

#### Returns

`Promise`\<[`BulkWriteResult`](BulkWriteResult.md)\>

***

### get()

> **get**\<`E`, `I`, `FL`\>(`id`, `options?`): `Promise`\<`GetRecord`\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}, `EmptyReferences`, `E`, `I`, `FL`\> \| `undefined`\>

Defined in: [src/resources/phase.ts:177](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L177)

Read one Phase entry by id; `undefined` when there is none. `field` picks the fields to read,
the same way it does for `search` (omit it to read every known field); the entry's `Id` is
always read, even when `field` leaves it out.

#### Type Parameters

##### E

`E` *extends* [`Expand`](Expand.md)\<`EmptyReferences`\> = `EmptyReferences`

##### I

`I` *extends* [`ImageOption`](ImageOption.md)\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}\> = `EmptyImages`

##### FL

`FL` *extends* readonly [`ReadFieldAlias`](ReadFieldAlias.md)\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}\>[] \| `undefined` = `undefined`

#### Parameters

##### id

`number`

##### options?

`GetOptions`\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}, `FL`, `E`, `I`\>

#### Returns

`Promise`\<`GetRecord`\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}, `EmptyReferences`, `E`, `I`, `FL`\> \| `undefined`\>

***

### getMany()

> **getMany**\<`E`, `I`, `FL`\>(`ids`, `options?`): `Promise`\<(`GetRecord`\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}, `EmptyReferences`, `E`, `I`, `FL`\> \| `undefined`)[]\>

Defined in: [src/resources/phase.ts:199](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L199)

Read many Phase entries by id. Resolves to an array in the order of `ids`, holding
`undefined` where no entry has that id — the same answer `get` gives for one id. A repeated
id gets the same entry at each of its positions; an empty `ids` sends no request.

The ids are sent together (up to 200 per request, and as many as fit under the request size
limit), so this makes far fewer requests than calling `get` for each id. Takes the same
options as `get`; narrowing `field` shortens each request, so more ids fit in one.

Every entry that comes back is checked against the ids that were asked for. If PORTERS
returns one that was not requested, the call rejects instead of returning it.

#### Type Parameters

##### E

`E` *extends* [`Expand`](Expand.md)\<`EmptyReferences`\> = `EmptyReferences`

##### I

`I` *extends* [`ImageOption`](ImageOption.md)\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}\> = `EmptyImages`

##### FL

`FL` *extends* readonly [`ReadFieldAlias`](ReadFieldAlias.md)\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}\>[] \| `undefined` = `undefined`

#### Parameters

##### ids

readonly `number`[]

##### options?

`GetOptions`\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}, `FL`, `E`, `I`\>

#### Returns

`Promise`\<(`GetRecord`\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}, `EmptyReferences`, `E`, `I`, `FL`\> \| `undefined`)[]\>

***

### search()

> **search**\<`E`, `I`, `FL`\>(`query?`): `Promise`\<[`ResourcePageOf`](ResourcePageOf.md)\<`SearchRecord`\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}, `EmptyReferences`, `E`, `I`, `FL`\>\>\>

Defined in: [src/resources/phase.ts:150](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L150)

Search the Phase history of the bound resource: resolves to one page of the entries matching
`query`. `field` picks the fields to read (omit it to read every known field), and
`count` / `start` choose the page. `keywords` / `itemstate` are not taken.

#### Type Parameters

##### E

`E` *extends* [`Expand`](Expand.md)\<`EmptyReferences`\> = `EmptyReferences`

##### I

`I` *extends* [`ImageOption`](ImageOption.md)\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}\> = `EmptyImages`

##### FL

`FL` *extends* readonly [`ReadFieldAlias`](ReadFieldAlias.md)\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}\>[] \| `undefined` = `undefined`

#### Parameters

##### query?

`Omit`\<[`SearchQuery`](SearchQuery.md)\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}\>, `PhaseUnsupportedQuery`\> & `object` & [`Limit`](Limit.md) & `object` & `ReadSelection`\<`FL`, `E`, `I`\>

#### Returns

`Promise`\<[`ResourcePageOf`](ResourcePageOf.md)\<`SearchRecord`\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}, `EmptyReferences`, `E`, `I`, `FL`\>\>\>

***

### searchAll()

> **searchAll**\<`E`, `I`, `FL`\>(`query?`): `AsyncIterable`\<`SearchRecord`\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}, `EmptyReferences`, `E`, `I`, `FL`\>\>

Defined in: [src/resources/phase.ts:164](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L164)

Search every Phase entry of the bound resource matching `query`, page after page (200 entries
per request). Takes the same `field` as `search`.

#### Type Parameters

##### E

`E` *extends* [`Expand`](Expand.md)\<`EmptyReferences`\> = `EmptyReferences`

##### I

`I` *extends* [`ImageOption`](ImageOption.md)\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}\> = `EmptyImages`

##### FL

`FL` *extends* readonly [`ReadFieldAlias`](ReadFieldAlias.md)\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}\>[] \| `undefined` = `undefined`

#### Parameters

##### query?

`Omit`\<[`SearchQuery`](SearchQuery.md)\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}\>, `PhaseUnsupportedQuery`\> & `object` & `ReadSelection`\<`FL`, `E`, `I`\>

#### Returns

`AsyncIterable`\<`SearchRecord`\<\{ `Date`: `"DateTime"`; `Id`: `"System[Id]"`; `JobOwner`: `"User"`; `JobOwnerDepartment`: `"System[Department]"`; `Memo`: `"MultilineText"`; `Owner`: `"User"`; `OwnerDepartment`: `"System[Department]"`; `Phase`: `"Option"`; `Recent`: `"Number"`; `RegisteredBy`: `"User"`; `RegistrationDate`: `"System[DateTime]"`; `Resource`: `"Number"`; `ResourceId`: `"Number"`; `ResumeOwner`: `"User"`; `ResumeOwnerDepartment`: `"System[Department]"`; `UpdateDate`: `"System[DateTime]"`; `UpdatedBy`: `"User"`; \}, `EmptyReferences`, `E`, `I`, `FL`\>\>

***

### update()

> **update**(`id`, `input`): `Promise`\<`number`\>

Defined in: [src/resources/phase.ts:216](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L216)

Update one Phase entry by id; resolves to that id. `Resource` cannot be supplied.

#### Parameters

##### id

`number`

##### input

`Without`\<[`PhaseUpdateInput`](PhaseUpdateInput.md), `"Resource"`\>

#### Returns

`Promise`\<`number`\>

***

### updateMany()

> **updateMany**(`items`): `Promise`\<[`BulkWriteResult`](BulkWriteResult.md)\>

Defined in: [src/resources/phase.ts:235](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/phase.ts#L235)

Update many Phase entries by id in one call. Auto-batched like `createMany`; per-entry
failures are returned in the `BulkWriteResult`, not thrown.

#### Parameters

##### items

`object`[]

#### Returns

`Promise`\<[`BulkWriteResult`](BulkWriteResult.md)\>
