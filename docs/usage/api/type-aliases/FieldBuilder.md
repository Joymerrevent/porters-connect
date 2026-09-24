[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FieldBuilder

# Type Alias: FieldBuilder

> **FieldBuilder** = `object`

Defined in: [src/fields/define-fields.ts:59](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L59)

Builder passed to each resource declaration: one method per declarable Data Type.

## Methods

### age()

> **age**\<`R`\>(`options?`): [`FieldDef`](FieldDef.md)\<`"Age"`, `NoInfer`\<`R`\>\>

Defined in: [src/fields/define-fields.ts:84](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L84)

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

Defined in: [src/fields/define-fields.ts:78](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L78)

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

Defined in: [src/fields/define-fields.ts:81](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L81)

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

Defined in: [src/fields/define-fields.ts:97](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L97)

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

Defined in: [src/fields/define-fields.ts:104](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L104)

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

Defined in: [src/fields/define-fields.ts:69](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L69)

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

Defined in: [src/fields/define-fields.ts:66](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L66)

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

Defined in: [src/fields/define-fields.ts:60](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L60)

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

Defined in: [src/fields/define-fields.ts:87](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L87)

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

Defined in: [src/fields/define-fields.ts:63](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L63)

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

Defined in: [src/fields/define-fields.ts:72](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L72)

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

Defined in: [src/fields/define-fields.ts:75](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L75)

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

Defined in: [src/fields/define-fields.ts:90](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L90)

#### Type Parameters

##### R

`R` *extends* `boolean` = `false`

#### Parameters

##### options?

[`FieldOptions`](FieldOptions.md)\<`R`\>

#### Returns

[`FieldDef`](FieldDef.md)\<`"User"`, `NoInfer`\<`R`\>\>
