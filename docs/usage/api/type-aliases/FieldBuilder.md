[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FieldBuilder

# Type Alias: FieldBuilder

> **FieldBuilder** = `object`

Defined in: [src/fields/declared-catalogs.ts:33](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L33)

Builder passed to each resource declaration: one method per declarable Data Type.

## Methods

### age()

> **age**\<`R`\>(`options?`): [`FieldDef`](FieldDef.md)\<`"Age"`, `NoInfer`\<`R`\>\>

Defined in: [src/fields/declared-catalogs.ts:58](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L58)

#### Type Parameters

##### R

`R` *extends* `boolean` = `false`

#### Parameters

##### options?

[`FieldOptions`](FieldOptions.md)\<`R`\>

#### Returns

[`FieldDef`](FieldDef.md)\<`"Age"`, `NoInfer`\<`R`\>\>

***

### date()

> **date**\<`R`\>(`options?`): [`FieldDef`](FieldDef.md)\<`"Date"`, `NoInfer`\<`R`\>\>

Defined in: [src/fields/declared-catalogs.ts:52](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L52)

#### Type Parameters

##### R

`R` *extends* `boolean` = `false`

#### Parameters

##### options?

[`FieldOptions`](FieldOptions.md)\<`R`\>

#### Returns

[`FieldDef`](FieldDef.md)\<`"Date"`, `NoInfer`\<`R`\>\>

***

### dateTime()

> **dateTime**\<`R`\>(`options?`): [`FieldDef`](FieldDef.md)\<`"DateTime"`, `NoInfer`\<`R`\>\>

Defined in: [src/fields/declared-catalogs.ts:55](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L55)

#### Type Parameters

##### R

`R` *extends* `boolean` = `false`

#### Parameters

##### options?

[`FieldOptions`](FieldOptions.md)\<`R`\>

#### Returns

[`FieldDef`](FieldDef.md)\<`"DateTime"`, `NoInfer`\<`R`\>\>

***

### image()

> **image**\<`R`\>(`options?`): [`FieldDef`](FieldDef.md)\<`"Image"`, `NoInfer`\<`R`\>\>

Defined in: [src/fields/declared-catalogs.ts:71](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L71)

An Image field (FT-18). Reads back `FileName` alone unless the query's `image` option asks
for `ContentType` / `Content`; writes the three sub-elements, checked before send.

#### Type Parameters

##### R

`R` *extends* `boolean` = `false`

#### Parameters

##### options?

[`FieldOptions`](FieldOptions.md)\<`R`\>

#### Returns

[`FieldDef`](FieldDef.md)\<`"Image"`, `NoInfer`\<`R`\>\>

***

### link()

> **link**\<`R`\>(`options?`): [`FieldDef`](FieldDef.md)\<`"Link"`, `NoInfer`\<`R`\>\>

Defined in: [src/fields/declared-catalogs.ts:78](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L78)

A Link field (FT-20). Reads back a Contact id, a `UserRef`, or a `DepartmentRef` — whichever
the tenant configured, told apart by shape; writes the referenced id.

#### Type Parameters

##### R

`R` *extends* `boolean` = `false`

#### Parameters

##### options?

[`FieldOptions`](FieldOptions.md)\<`R`\>

#### Returns

[`FieldDef`](FieldDef.md)\<`"Link"`, `NoInfer`\<`R`\>\>

***

### mail()

> **mail**\<`R`\>(`options?`): [`FieldDef`](FieldDef.md)\<`"Mail"`, `NoInfer`\<`R`\>\>

Defined in: [src/fields/declared-catalogs.ts:43](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L43)

#### Type Parameters

##### R

`R` *extends* `boolean` = `false`

#### Parameters

##### options?

[`FieldOptions`](FieldOptions.md)\<`R`\>

#### Returns

[`FieldDef`](FieldDef.md)\<`"Mail"`, `NoInfer`\<`R`\>\>

***

### multilineText()

> **multilineText**\<`R`\>(`options?`): [`FieldDef`](FieldDef.md)\<`"MultilineText"`, `NoInfer`\<`R`\>\>

Defined in: [src/fields/declared-catalogs.ts:40](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L40)

#### Type Parameters

##### R

`R` *extends* `boolean` = `false`

#### Parameters

##### options?

[`FieldOptions`](FieldOptions.md)\<`R`\>

#### Returns

[`FieldDef`](FieldDef.md)\<`"MultilineText"`, `NoInfer`\<`R`\>\>

***

### number()

> **number**\<`R`\>(`options?`): [`FieldDef`](FieldDef.md)\<`"Number"`, `NoInfer`\<`R`\>\>

Defined in: [src/fields/declared-catalogs.ts:34](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L34)

#### Type Parameters

##### R

`R` *extends* `boolean` = `false`

#### Parameters

##### options?

[`FieldOptions`](FieldOptions.md)\<`R`\>

#### Returns

[`FieldDef`](FieldDef.md)\<`"Number"`, `NoInfer`\<`R`\>\>

***

### option()

> **option**\<`R`\>(`options?`): [`FieldDef`](FieldDef.md)\<`"Option"`, `NoInfer`\<`R`\>\>

Defined in: [src/fields/declared-catalogs.ts:61](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L61)

#### Type Parameters

##### R

`R` *extends* `boolean` = `false`

#### Parameters

##### options?

[`FieldOptions`](FieldOptions.md)\<`R`\>

#### Returns

[`FieldDef`](FieldDef.md)\<`"Option"`, `NoInfer`\<`R`\>\>

***

### singlelineText()

> **singlelineText**\<`R`\>(`options?`): [`FieldDef`](FieldDef.md)\<`"SinglelineText"`, `NoInfer`\<`R`\>\>

Defined in: [src/fields/declared-catalogs.ts:37](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L37)

#### Type Parameters

##### R

`R` *extends* `boolean` = `false`

#### Parameters

##### options?

[`FieldOptions`](FieldOptions.md)\<`R`\>

#### Returns

[`FieldDef`](FieldDef.md)\<`"SinglelineText"`, `NoInfer`\<`R`\>\>

***

### telephone()

> **telephone**\<`R`\>(`options?`): [`FieldDef`](FieldDef.md)\<`"Telephone"`, `NoInfer`\<`R`\>\>

Defined in: [src/fields/declared-catalogs.ts:46](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L46)

#### Type Parameters

##### R

`R` *extends* `boolean` = `false`

#### Parameters

##### options?

[`FieldOptions`](FieldOptions.md)\<`R`\>

#### Returns

[`FieldDef`](FieldDef.md)\<`"Telephone"`, `NoInfer`\<`R`\>\>

***

### url()

> **url**\<`R`\>(`options?`): [`FieldDef`](FieldDef.md)\<`"URL"`, `NoInfer`\<`R`\>\>

Defined in: [src/fields/declared-catalogs.ts:49](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L49)

#### Type Parameters

##### R

`R` *extends* `boolean` = `false`

#### Parameters

##### options?

[`FieldOptions`](FieldOptions.md)\<`R`\>

#### Returns

[`FieldDef`](FieldDef.md)\<`"URL"`, `NoInfer`\<`R`\>\>

***

### user()

> **user**\<`R`\>(`options?`): [`FieldDef`](FieldDef.md)\<`"User"`, `NoInfer`\<`R`\>\>

Defined in: [src/fields/declared-catalogs.ts:64](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/declared-catalogs.ts#L64)

#### Type Parameters

##### R

`R` *extends* `boolean` = `false`

#### Parameters

##### options?

[`FieldOptions`](FieldOptions.md)\<`R`\>

#### Returns

[`FieldDef`](FieldDef.md)\<`"User"`, `NoInfer`\<`R`\>\>
