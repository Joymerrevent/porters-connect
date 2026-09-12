[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / FieldBuilder

# Type Alias: FieldBuilder

> **FieldBuilder** = `object`

Defined in: [src/fields/define-fields.ts:38](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L38)

Builder passed to each resource declaration: one method per declarable Data Type.

## Methods

### age()

> **age**(): [`FieldDef`](FieldDef.md)\<`"Age"`\>

Defined in: [src/fields/define-fields.ts:47](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L47)

#### Returns

[`FieldDef`](FieldDef.md)\<`"Age"`\>

***

### date()

> **date**(): [`FieldDef`](FieldDef.md)\<`"Date"`\>

Defined in: [src/fields/define-fields.ts:45](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L45)

#### Returns

[`FieldDef`](FieldDef.md)\<`"Date"`\>

***

### dateTime()

> **dateTime**(): [`FieldDef`](FieldDef.md)\<`"DateTime"`\>

Defined in: [src/fields/define-fields.ts:46](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L46)

#### Returns

[`FieldDef`](FieldDef.md)\<`"DateTime"`\>

***

### image()

> **image**(): [`FieldDef`](FieldDef.md)\<`"Image"`\>

Defined in: [src/fields/define-fields.ts:54](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L54)

An Image field (FT-18). Reads back `FileName` alone unless the query's `image` option asks
for `ContentType` / `Content`; writes the three sub-elements, checked before send.

#### Returns

[`FieldDef`](FieldDef.md)\<`"Image"`\>

***

### link()

> **link**(): [`FieldDef`](FieldDef.md)\<`"Link"`\>

Defined in: [src/fields/define-fields.ts:59](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L59)

A Link field (FT-20). Reads back a Contact id, a `UserRef`, or a `DepartmentRef` — whichever
the tenant configured, told apart by shape; writes the referenced id.

#### Returns

[`FieldDef`](FieldDef.md)\<`"Link"`\>

***

### mail()

> **mail**(): [`FieldDef`](FieldDef.md)\<`"Mail"`\>

Defined in: [src/fields/define-fields.ts:42](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L42)

#### Returns

[`FieldDef`](FieldDef.md)\<`"Mail"`\>

***

### multilineText()

> **multilineText**(): [`FieldDef`](FieldDef.md)\<`"MultilineText"`\>

Defined in: [src/fields/define-fields.ts:41](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L41)

#### Returns

[`FieldDef`](FieldDef.md)\<`"MultilineText"`\>

***

### number()

> **number**(): [`FieldDef`](FieldDef.md)\<`"Number"`\>

Defined in: [src/fields/define-fields.ts:39](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L39)

#### Returns

[`FieldDef`](FieldDef.md)\<`"Number"`\>

***

### option()

> **option**(): [`FieldDef`](FieldDef.md)\<`"Option"`\>

Defined in: [src/fields/define-fields.ts:48](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L48)

#### Returns

[`FieldDef`](FieldDef.md)\<`"Option"`\>

***

### singlelineText()

> **singlelineText**(): [`FieldDef`](FieldDef.md)\<`"SinglelineText"`\>

Defined in: [src/fields/define-fields.ts:40](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L40)

#### Returns

[`FieldDef`](FieldDef.md)\<`"SinglelineText"`\>

***

### telephone()

> **telephone**(): [`FieldDef`](FieldDef.md)\<`"Telephone"`\>

Defined in: [src/fields/define-fields.ts:43](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L43)

#### Returns

[`FieldDef`](FieldDef.md)\<`"Telephone"`\>

***

### url()

> **url**(): [`FieldDef`](FieldDef.md)\<`"URL"`\>

Defined in: [src/fields/define-fields.ts:44](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L44)

#### Returns

[`FieldDef`](FieldDef.md)\<`"URL"`\>

***

### user()

> **user**(): [`FieldDef`](FieldDef.md)\<`"User"`\>

Defined in: [src/fields/define-fields.ts:49](https://github.com/Joymerrevent/porters-connect/blob/main/src/fields/define-fields.ts#L49)

#### Returns

[`FieldDef`](FieldDef.md)\<`"User"`\>
