[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / ThrottleOptions

# Type Alias: ThrottleOptions

> **ThrottleOptions** = `object`

Defined in: [src/http/throttle.ts:18](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/throttle.ts#L18)

## Properties

### now?

> `optional` **now?**: () => `number`

Defined in: [src/http/throttle.ts:37](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/throttle.ts#L37)

#### Returns

`number`

***

### readPerMin?

> `optional` **readPerMin?**: `number`

Defined in: [src/http/throttle.ts:24](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/throttle.ts#L24)

Reads allowed per minute before headroom. Default 2000 (PORTERS' own cap). A positive
integer, and **`readPerMin * safety` must still leave at least one token** — see
[ThrottleOptions.safety](#safety).

***

### safety?

> `optional` **safety?**: `number`

Defined in: [src/http/throttle.ts:36](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/throttle.ts#L36)

Fraction of the limit to actually use (headroom). Default 0.9. Greater than 0, at most 1.

The bucket holds `floor(limit * safety)` tokens, so a small limit and a small `safety`
multiply into **zero capacity** — `{ readPerMin: 1 }` at the default 0.9 already does.
A bucket that can never hold a token would make every call wait forever, so the
combination is rejected at construction rather than hanging.

***

### writePerMin?

> `optional` **writePerMin?**: `number`

Defined in: [src/http/throttle.ts:26](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/throttle.ts#L26)

Writes allowed per minute before headroom. Default 500. Same rules as `readPerMin`.
