[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ContactResource

# Type Alias: ContactResource\<C, CR\>

> **ContactResource**\<`C`, `CR`\> = `object`

Defined in: [src/resources/contact.ts:130](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/contact.ts#L130)

The Contact accessor. `C` is the declared custom-field catalog merged on; `CR` names the
custom fields that are required on `create`.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`

## Methods

### create()

> **create**(`input`): `Promise`\<`number`\>

Defined in: [src/resources/contact.ts:202](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/contact.ts#L202)

Create one Contact record; resolves to the newly assigned id.

#### Parameters

##### input

[`ContactCreateInput`](ContactCreateInput.md)\<`C`, `CR`\>

#### Returns

`Promise`\<`number`\>

***

### createMany()

> **createMany**(`inputs`): `Promise`\<[`BulkWriteResult`](BulkWriteResult.md)\>

Defined in: [src/resources/contact.ts:213](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/contact.ts#L213)

Create many Contact records in one call. Auto-batched to ≤200 records and under the request
size cap. **Not atomic** — inspect the `BulkWriteResult`: per-record failures are returned
(`failed` / `hasFailures`), not thrown. Only a whole-request failure throws (with the
already-written count). Batching is non-idempotent: a full retry after a mid-run failure may
duplicate creates. Empty input sends no request.

#### Parameters

##### inputs

[`ContactCreateInput`](ContactCreateInput.md)\<`C`, `CR`\>[]

#### Returns

`Promise`\<[`BulkWriteResult`](BulkWriteResult.md)\>

***

### get()

> **get**\<`E`, `I`, `FL`\>(`id`, `options?`): `Promise`\<`GetRecord`\<`Fields`\<`C`\>, \{ `P_Client`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Memo`: `"MultilineText"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Client"`; `path`: `"client"`; `prefix`: `"Client"`; \}; \}, `E`, `I`, `FL`\> \| `undefined`\>

Defined in: [src/resources/contact.ts:170](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/contact.ts#L170)

Read one Contact record by id; `undefined` when there is none. `field` picks the fields to
read, the same way it does for `search` (omit it to read every known field); the record's id
is always read, even when `field` leaves it out. `expand` reads referenced records too;
`image` picks an Image field's sub-fields — `get` is where asking for a `Content` belongs,
since it fetches one record rather than a page.

#### Type Parameters

##### E

`E` *extends* [`Expand`](Expand.md)\<\{ `P_Client`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Memo`: `"MultilineText"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Client"`; `path`: `"client"`; `prefix`: `"Client"`; \}; \}\> = `EmptyReferences`

##### I

`I` *extends* [`ImageOption`](ImageOption.md)\<`Fields`\<`C`\>\> = `EmptyImages`

##### FL

`FL` *extends* readonly [`ReadFieldAlias`](ReadFieldAlias.md)\<`Fields`\<`C`\>\>[] \| `undefined` = `undefined`

#### Parameters

##### id

`number`

##### options?

`GetOptions`\<`Fields`\<`C`\>, `FL`, `E`, `I`\>

#### Returns

`Promise`\<`GetRecord`\<`Fields`\<`C`\>, \{ `P_Client`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Memo`: `"MultilineText"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Client"`; `path`: `"client"`; `prefix`: `"Client"`; \}; \}, `E`, `I`, `FL`\> \| `undefined`\>

***

### getMany()

> **getMany**\<`E`, `I`, `FL`\>(`ids`, `options?`): `Promise`\<(`GetRecord`\<`Fields`\<`C`\>, \{ `P_Client`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Memo`: `"MultilineText"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Client"`; `path`: `"client"`; `prefix`: `"Client"`; \}; \}, `E`, `I`, `FL`\> \| `undefined`)[]\>

Defined in: [src/resources/contact.ts:192](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/contact.ts#L192)

Read many Contact records by id. Resolves to an array in the order of `ids`, holding
`undefined` where no record has that id — the same answer `get` gives for one id. A repeated
id gets the same record at each of its positions; an empty `ids` sends no request.

The ids are sent together (up to 200 per request, and as many as fit under the request size
limit), so this makes far fewer requests than calling `get` for each id. Takes the same
options as `get`; narrowing `field` shortens each request, so more ids fit in one.

Every record that comes back is checked against the ids that were asked for. If PORTERS
returns one that was not requested, the call rejects instead of returning it.

#### Type Parameters

##### E

`E` *extends* [`Expand`](Expand.md)\<\{ `P_Client`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Memo`: `"MultilineText"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Client"`; `path`: `"client"`; `prefix`: `"Client"`; \}; \}\> = `EmptyReferences`

##### I

`I` *extends* [`ImageOption`](ImageOption.md)\<`Fields`\<`C`\>\> = `EmptyImages`

##### FL

`FL` *extends* readonly [`ReadFieldAlias`](ReadFieldAlias.md)\<`Fields`\<`C`\>\>[] \| `undefined` = `undefined`

#### Parameters

##### ids

readonly `number`[]

##### options?

`GetOptions`\<`Fields`\<`C`\>, `FL`, `E`, `I`\>

#### Returns

`Promise`\<(`GetRecord`\<`Fields`\<`C`\>, \{ `P_Client`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Memo`: `"MultilineText"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Client"`; `path`: `"client"`; `prefix`: `"Client"`; \}; \}, `E`, `I`, `FL`\> \| `undefined`)[]\>

***

### search()

> **search**\<`E`, `I`, `FL`\>(`query?`): `Promise`\<[`ResourcePageOf`](ResourcePageOf.md)\<`SearchRecord`\<`Fields`\<`C`\>, \{ `P_Client`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Memo`: `"MultilineText"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Client"`; `path`: `"client"`; `prefix`: `"Client"`; \}; \}, `E`, `I`, `FL`\>\>\>

Defined in: [src/resources/contact.ts:141](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/contact.ts#L141)

Search Contact records: resolves to one page of the records matching `query`. `field` picks
the fields to read (omit it to read every known field), `expand` reads referenced records
too, `image` picks an Image field's sub-fields, and `count` / `start` choose the page.

#### Type Parameters

##### E

`E` *extends* [`Expand`](Expand.md)\<\{ `P_Client`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Memo`: `"MultilineText"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Client"`; `path`: `"client"`; `prefix`: `"Client"`; \}; \}\> = `EmptyReferences`

##### I

`I` *extends* [`ImageOption`](ImageOption.md)\<`Fields`\<`C`\>\> = `EmptyImages`

##### FL

`FL` *extends* readonly [`ReadFieldAlias`](ReadFieldAlias.md)\<`Fields`\<`C`\>\>[] \| `undefined` = `undefined`

#### Parameters

##### query?

[`ContactSearchQuery`](ContactSearchQuery.md)\<`C`\> & [`Limit`](Limit.md) & `object` & `ReadSelection`\<`FL`, `E`, `I`\>

#### Returns

`Promise`\<[`ResourcePageOf`](ResourcePageOf.md)\<`SearchRecord`\<`Fields`\<`C`\>, \{ `P_Client`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Memo`: `"MultilineText"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Client"`; `path`: `"client"`; `prefix`: `"Client"`; \}; \}, `E`, `I`, `FL`\>\>\>

***

### searchAll()

> **searchAll**\<`E`, `I`, `FL`\>(`query?`): `AsyncIterable`\<`SearchRecord`\<`Fields`\<`C`\>, \{ `P_Client`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Memo`: `"MultilineText"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Client"`; `path`: `"client"`; `prefix`: `"Client"`; \}; \}, `E`, `I`, `FL`\>\>

Defined in: [src/resources/contact.ts:155](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/contact.ts#L155)

Search every Contact record matching `query`, page after page (200 records per request).
Takes the same `field` / `expand` / `image` as `search`.

#### Type Parameters

##### E

`E` *extends* [`Expand`](Expand.md)\<\{ `P_Client`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Memo`: `"MultilineText"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Client"`; `path`: `"client"`; `prefix`: `"Client"`; \}; \}\> = `EmptyReferences`

##### I

`I` *extends* [`ImageOption`](ImageOption.md)\<`Fields`\<`C`\>\> = `EmptyImages`

##### FL

`FL` *extends* readonly [`ReadFieldAlias`](ReadFieldAlias.md)\<`Fields`\<`C`\>\>[] \| `undefined` = `undefined`

#### Parameters

##### query?

[`ContactSearchQuery`](ContactSearchQuery.md)\<`C`\> & `ReadSelection`\<`FL`, `E`, `I`\>

#### Returns

`AsyncIterable`\<`SearchRecord`\<`Fields`\<`C`\>, \{ `P_Client`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Memo`: `"MultilineText"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Client"`; `path`: `"client"`; `prefix`: `"Client"`; \}; \}, `E`, `I`, `FL`\>\>

***

### update()

> **update**(`id`, `input`): `Promise`\<`number`\>

Defined in: [src/resources/contact.ts:204](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/contact.ts#L204)

Update one Contact record by id; resolves to that id.

#### Parameters

##### id

`number`

##### input

[`ContactUpdateInput`](ContactUpdateInput.md)\<`C`\>

#### Returns

`Promise`\<`number`\>

***

### updateMany()

> **updateMany**(`items`): `Promise`\<[`BulkWriteResult`](BulkWriteResult.md)\>

Defined in: [src/resources/contact.ts:218](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/contact.ts#L218)

Update many Contact records by id in one call. Auto-batched like `createMany`; per-record
failures are returned in the `BulkWriteResult`, not thrown.

#### Parameters

##### items

`object`[]

#### Returns

`Promise`\<[`BulkWriteResult`](BulkWriteResult.md)\>
