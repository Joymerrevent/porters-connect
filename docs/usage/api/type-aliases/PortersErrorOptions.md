[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / PortersErrorOptions

# Type Alias: PortersErrorOptions

> **PortersErrorOptions** = `object`

Defined in: [src/errors/porters-error.ts:29](https://github.com/Joymerrevent/porters-connect/blob/main/src/errors/porters-error.ts#L29)

Construction options for [PortersError](../classes/PortersError.md).

## Properties

### category

> **category**: [`ErrorCategory`](ErrorCategory.md)

Defined in: [src/errors/porters-error.ts:30](https://github.com/Joymerrevent/porters-connect/blob/main/src/errors/porters-error.ts#L30)

***

### cause?

> `optional` **cause?**: `unknown`

Defined in: [src/errors/porters-error.ts:43](https://github.com/Joymerrevent/porters-connect/blob/main/src/errors/porters-error.ts#L43)

***

### code?

> `optional` **code?**: `number` \| `null`

Defined in: [src/errors/porters-error.ts:32](https://github.com/Joymerrevent/porters-connect/blob/main/src/errors/porters-error.ts#L32)

PORTERS raw code; `null` for network/transport failures.

***

### context?

> `optional` **context?**: [`PortersErrorContext`](PortersErrorContext.md)

Defined in: [src/errors/porters-error.ts:42](https://github.com/Joymerrevent/porters-connect/blob/main/src/errors/porters-error.ts#L42)

***

### hint?

> `optional` **hint?**: `string`

Defined in: [src/errors/porters-error.ts:35](https://github.com/Joymerrevent/porters-connect/blob/main/src/errors/porters-error.ts#L35)

Actionable hint (English by default).

***

### httpStatus?

> `optional` **httpStatus?**: `number`

Defined in: [src/errors/porters-error.ts:41](https://github.com/Joymerrevent/porters-connect/blob/main/src/errors/porters-error.ts#L41)

HTTP status of the response this error came from (ADR-0044). Set for every error raised while
reading a response — including one carrying a PORTERS `<Code>` — and `undefined` for failures
with no response at all (send-time guards, connection errors).

***

### retryable?

> `optional` **retryable?**: `boolean`

Defined in: [src/errors/porters-error.ts:33](https://github.com/Joymerrevent/porters-connect/blob/main/src/errors/porters-error.ts#L33)
