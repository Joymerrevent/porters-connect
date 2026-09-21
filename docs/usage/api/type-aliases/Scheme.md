[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / Scheme

# Type Alias: Scheme

> **Scheme** = `"https"` \| `"http"`

Defined in: [src/types/common.ts:13](https://github.com/Joymerrevent/porters-connect/blob/main/src/types/common.ts#L13)

URL scheme of the API access point. `https` is the default; `http` is opt-in,
meant for a local fake server or a trusted tunnel, and always warns (see
`PortersClientOptions.scheme`).
