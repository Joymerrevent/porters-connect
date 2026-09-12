[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / Scheme

# Type Alias: Scheme

> **Scheme** = `"https"` \| `"http"`

Defined in: [src/types/common.ts:12](https://github.com/Joymerrevent/porters-connect/blob/main/src/types/common.ts#L12)

URL scheme of the API access point (ADR-0047). `https` is the default; `http` is opt-in,
meant for a local fake server or a trusted tunnel, and always warns (see
`PortersClientOptions.scheme`).
