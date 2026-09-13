[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ThrottleOptions

# Type Alias: ThrottleOptions

> **ThrottleOptions** = `object`

Defined in: [src/http/throttle.ts:17](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/throttle.ts#L17)

## Properties

### now?

> `optional` **now?**: () => `number`

Defined in: [src/http/throttle.ts:22](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/throttle.ts#L22)

#### Returns

`number`

***

### readPerMin?

> `optional` **readPerMin?**: `number`

Defined in: [src/http/throttle.ts:18](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/throttle.ts#L18)

***

### safety?

> `optional` **safety?**: `number`

Defined in: [src/http/throttle.ts:21](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/throttle.ts#L21)

Fraction of the limit to actually use (headroom). Default 0.9.

***

### writePerMin?

> `optional` **writePerMin?**: `number`

Defined in: [src/http/throttle.ts:19](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/throttle.ts#L19)
