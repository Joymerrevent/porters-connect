[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FieldBuilder

# Type Alias: FieldBuilder

> **FieldBuilder** = `object`

Defined in: [src/fields/define-fields.ts:60](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L60)

Builder passed to each resource declaration: one method per declarable Data Type.

## Methods

### age()

> **age**\<`R`\>(`options?`): [`FieldDef`](FieldDef.md)\<`"Age"`, `NoInfer`\<`R`\>\>

Defined in: [src/fields/define-fields.ts:85](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L85)

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

Defined in: [src/fields/define-fields.ts:79](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L79)

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

Defined in: [src/fields/define-fields.ts:82](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L82)

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

Defined in: [src/fields/define-fields.ts:98](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L98)

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

Defined in: [src/fields/define-fields.ts:105](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L105)

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

Defined in: [src/fields/define-fields.ts:70](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L70)

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

Defined in: [src/fields/define-fields.ts:67](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L67)

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

Defined in: [src/fields/define-fields.ts:61](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L61)

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

Defined in: [src/fields/define-fields.ts:88](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L88)

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

Defined in: [src/fields/define-fields.ts:64](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L64)

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

Defined in: [src/fields/define-fields.ts:73](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L73)

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

Defined in: [src/fields/define-fields.ts:76](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L76)

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

Defined in: [src/fields/define-fields.ts:91](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L91)

#### Type Parameters

##### R

`R` *extends* `boolean` = `false`

#### Parameters

##### options?

[`FieldOptions`](FieldOptions.md)\<`R`\>

#### Returns

[`FieldDef`](FieldDef.md)\<`"User"`, `NoInfer`\<`R`\>\>
