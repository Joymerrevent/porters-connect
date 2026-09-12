[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ImageReadRecord

# Type Alias: ImageReadRecord\<Rec, I\>

> **ImageReadRecord**\<`Rec`, `I`\> = `Omit`\<`Rec`, keyof `I`\> & \{ \[K in keyof I & keyof Rec\]?: ImageSelectedValue\<I\[K\]\> \| null \}

Defined in: [src/resources/image.ts:74](https://github.com/Joymerrevent/porters-connect/blob/main/src/resources/image.ts#L74)

A read record whose selected Image fields carry exactly the sub-tags they asked for. Applied on
top of the (possibly expanded) record, so `image` and `expand` compose without either knowing
about the other. With nothing selected `keyof I` is `never`, so this is the record itself.

Deliberately **not** written as `[keyof I] extends [never] ? Rec : …`. That short-circuit reads
like a cheap identity, but a conditional type in a method's return position makes
`ReturnType<typeof resource.search>` resolve to `any` — which would quietly switch off every
type-level assertion built on it (`static-types.test.ts`) instead of failing. `Omit<Rec, never>`
costs a little type display and keeps the assertions real.

## Type Parameters

### Rec

`Rec`

### I

`I`
