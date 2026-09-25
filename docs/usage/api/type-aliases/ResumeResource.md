[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ResumeResource

# Type Alias: ResumeResource\<C, CR\>

> **ResumeResource**\<`C`, `CR`\> = `object`

Defined in: [src/resources/resume.ts:131](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/resume.ts#L131)

The Resume accessor. `C` is the declared custom-field catalog merged on; `CR` names the
custom fields that are required on `create`.

## Type Parameters

### C

`C` *extends* `FieldCatalog` = `EmptyCatalog`

### CR

`CR` *extends* keyof `C` = `never`

## Methods

### create()

> **create**(`input`): `Promise`\<`number`\>

Defined in: [src/resources/resume.ts:203](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/resume.ts#L203)

Create one Resume record; resolves to the newly assigned id.

#### Parameters

##### input

`CreateInput`\<`Fields`\<`C`\>, `RequiredOnCreate`\<`C`, `CR`\>\>

#### Returns

`Promise`\<`number`\>

***

### createMany()

> **createMany**(`inputs`): `Promise`\<[`BulkWriteResult`](BulkWriteResult.md)\>

Defined in: [src/resources/resume.ts:216](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/resume.ts#L216)

Create many Resume records in one call. Auto-batched to ≤200 records and under the request
size cap. **Not atomic** — inspect the `BulkWriteResult`: per-record failures are returned
(`failed` / `hasFailures`), not thrown. Only a whole-request failure throws (with the
already-written count). Batching is non-idempotent: a full retry after a mid-run failure may
duplicate creates. Empty input sends no request.

#### Parameters

##### inputs

`CreateInput`\<`Fields`\<`C`\>, `RequiredOnCreate`\<`C`, `CR`\>\>[]

#### Returns

`Promise`\<[`BulkWriteResult`](BulkWriteResult.md)\>

***

### get()

> **get**\<`E`, `I`, `FL`\>(`id`, `options?`): `Promise`\<`GetRecord`\<`Fields`\<`C`\>, \{ `P_Candidate`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Mail`: `"Mail"`; `P_Memo`: `"MultilineText"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_Reading`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Candidate"`; `path`: `"candidate"`; `prefix`: `"Person"`; \}; \}, `E`, `I`, `FL`\> \| `undefined`\>

Defined in: [src/resources/resume.ts:171](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/resume.ts#L171)

Read one Resume record by id; `undefined` when there is none. `field` picks the fields to
read, the same way it does for `search` (omit it to read every known field); the record's id
is always read, even when `field` leaves it out. `expand` reads referenced records too;
`image` picks an Image field's sub-fields — `get` is where asking for a `Content` belongs,
since it fetches one record rather than a page.

#### Type Parameters

##### E

`E` *extends* [`Expand`](Expand.md)\<\{ `P_Candidate`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Mail`: `"Mail"`; `P_Memo`: `"MultilineText"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_Reading`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Candidate"`; `path`: `"candidate"`; `prefix`: `"Person"`; \}; \}\> = `EmptyReferences`

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

`Promise`\<`GetRecord`\<`Fields`\<`C`\>, \{ `P_Candidate`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Mail`: `"Mail"`; `P_Memo`: `"MultilineText"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_Reading`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Candidate"`; `path`: `"candidate"`; `prefix`: `"Person"`; \}; \}, `E`, `I`, `FL`\> \| `undefined`\>

***

### getMany()

> **getMany**\<`E`, `I`, `FL`\>(`ids`, `options?`): `Promise`\<(`GetRecord`\<`Fields`\<`C`\>, \{ `P_Candidate`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Mail`: `"Mail"`; `P_Memo`: `"MultilineText"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_Reading`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Candidate"`; `path`: `"candidate"`; `prefix`: `"Person"`; \}; \}, `E`, `I`, `FL`\> \| `undefined`)[]\>

Defined in: [src/resources/resume.ts:193](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/resume.ts#L193)

Read many Resume records by id. Resolves to an array in the order of `ids`, holding
`undefined` where no record has that id — the same answer `get` gives for one id. A repeated
id gets the same record at each of its positions; an empty `ids` sends no request.

The ids are sent together (up to 200 per request, and as many as fit under the request size
limit), so this makes far fewer requests than calling `get` for each id. Takes the same
options as `get`; narrowing `field` shortens each request, so more ids fit in one.

Every record that comes back is checked against the ids that were asked for. If PORTERS
returns one that was not requested, the call rejects instead of returning it.

#### Type Parameters

##### E

`E` *extends* [`Expand`](Expand.md)\<\{ `P_Candidate`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Mail`: `"Mail"`; `P_Memo`: `"MultilineText"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_Reading`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Candidate"`; `path`: `"candidate"`; `prefix`: `"Person"`; \}; \}\> = `EmptyReferences`

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

`Promise`\<(`GetRecord`\<`Fields`\<`C`\>, \{ `P_Candidate`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Mail`: `"Mail"`; `P_Memo`: `"MultilineText"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_Reading`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Candidate"`; `path`: `"candidate"`; `prefix`: `"Person"`; \}; \}, `E`, `I`, `FL`\> \| `undefined`)[]\>

***

### search()

> **search**\<`E`, `I`, `FL`\>(`query?`): `Promise`\<[`ResourcePageOf`](ResourcePageOf.md)\<`SearchRecord`\<`Fields`\<`C`\>, \{ `P_Candidate`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Mail`: `"Mail"`; `P_Memo`: `"MultilineText"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_Reading`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Candidate"`; `path`: `"candidate"`; `prefix`: `"Person"`; \}; \}, `E`, `I`, `FL`\>\>\>

Defined in: [src/resources/resume.ts:142](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/resume.ts#L142)

Search Resume records: resolves to one page of the records matching `query`. `field` picks
the fields to read (omit it to read every known field), `expand` reads referenced records
too, `image` picks an Image field's sub-fields, and `count` / `start` choose the page.

#### Type Parameters

##### E

`E` *extends* [`Expand`](Expand.md)\<\{ `P_Candidate`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Mail`: `"Mail"`; `P_Memo`: `"MultilineText"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_Reading`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Candidate"`; `path`: `"candidate"`; `prefix`: `"Person"`; \}; \}\> = `EmptyReferences`

##### I

`I` *extends* [`ImageOption`](ImageOption.md)\<`Fields`\<`C`\>\> = `EmptyImages`

##### FL

`FL` *extends* readonly [`ReadFieldAlias`](ReadFieldAlias.md)\<`Fields`\<`C`\>\>[] \| `undefined` = `undefined`

#### Parameters

##### query?

[`ResumeSearchQuery`](ResumeSearchQuery.md)\<`C`\> & [`Limit`](Limit.md) & `object` & `ReadSelection`\<`FL`, `E`, `I`\>

#### Returns

`Promise`\<[`ResourcePageOf`](ResourcePageOf.md)\<`SearchRecord`\<`Fields`\<`C`\>, \{ `P_Candidate`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Mail`: `"Mail"`; `P_Memo`: `"MultilineText"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_Reading`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Candidate"`; `path`: `"candidate"`; `prefix`: `"Person"`; \}; \}, `E`, `I`, `FL`\>\>\>

***

### searchAll()

> **searchAll**\<`E`, `I`, `FL`\>(`query?`): `AsyncIterable`\<`SearchRecord`\<`Fields`\<`C`\>, \{ `P_Candidate`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Mail`: `"Mail"`; `P_Memo`: `"MultilineText"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_Reading`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Candidate"`; `path`: `"candidate"`; `prefix`: `"Person"`; \}; \}, `E`, `I`, `FL`\>\>

Defined in: [src/resources/resume.ts:156](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/resume.ts#L156)

Search every Resume record matching `query`, page after page (200 records per request).
Takes the same `field` / `expand` / `image` as `search`.

#### Type Parameters

##### E

`E` *extends* [`Expand`](Expand.md)\<\{ `P_Candidate`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Mail`: `"Mail"`; `P_Memo`: `"MultilineText"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_Reading`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Candidate"`; `path`: `"candidate"`; `prefix`: `"Person"`; \}; \}\> = `EmptyReferences`

##### I

`I` *extends* [`ImageOption`](ImageOption.md)\<`Fields`\<`C`\>\> = `EmptyImages`

##### FL

`FL` *extends* readonly [`ReadFieldAlias`](ReadFieldAlias.md)\<`Fields`\<`C`\>\>[] \| `undefined` = `undefined`

#### Parameters

##### query?

[`ResumeSearchQuery`](ResumeSearchQuery.md)\<`C`\> & `ReadSelection`\<`FL`, `E`, `I`\>

#### Returns

`AsyncIterable`\<`SearchRecord`\<`Fields`\<`C`\>, \{ `P_Candidate`: \{ `fields`: \{ `P_City`: `"SinglelineText"`; `P_Country`: `"SinglelineText"`; `P_Deleted`: `null`; `P_Fax`: `"Telephone"`; `P_Id`: `"System[Id]"`; `P_Mail`: `"Mail"`; `P_Memo`: `"MultilineText"`; `P_Mobile`: `"Telephone"`; `P_MobileMail`: `"Mail"`; `P_Name`: `"SinglelineText"`; `P_Owner`: `"User"`; `P_Phase`: `"Option"`; `P_PhaseDate`: `"DateTime"`; `P_PhaseMemo`: `"MultilineText"`; `P_Prefecture`: `"SinglelineText"`; `P_Reading`: `"SinglelineText"`; `P_RegisteredBy`: `"User"`; `P_RegistrationDate`: `"System[DateTime]"`; `P_Street`: `"MultilineText"`; `P_Telephone`: `"Telephone"`; `P_UpdateDate`: `"System[DateTime]"`; `P_UpdatedBy`: `"User"`; `P_Zipcode`: `"SinglelineText"`; \}; `name`: `"Candidate"`; `path`: `"candidate"`; `prefix`: `"Person"`; \}; \}, `E`, `I`, `FL`\>\>

***

### update()

> **update**(`id`, `input`): `Promise`\<`number`\>

Defined in: [src/resources/resume.ts:207](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/resume.ts#L207)

Update one Resume record by id; resolves to that id.

#### Parameters

##### id

`number`

##### input

`UpdateInput`\<`Fields`\<`C`\>\>

#### Returns

`Promise`\<`number`\>

***

### updateMany()

> **updateMany**(`items`): `Promise`\<[`BulkWriteResult`](BulkWriteResult.md)\>

Defined in: [src/resources/resume.ts:223](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/resume.ts#L223)

Update many Resume records by id in one call. Auto-batched like `createMany`; per-record
failures are returned in the `BulkWriteResult`, not thrown.

#### Parameters

##### items

`object`[]

#### Returns

`Promise`\<[`BulkWriteResult`](BulkWriteResult.md)\>
