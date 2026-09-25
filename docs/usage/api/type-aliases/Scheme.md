[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / Scheme

# Type Alias: Scheme

> **Scheme** = `"https"` \| `"http"`

Defined in: [src/http/access-point.ts:16](https://github.com/Joymerrevent/porters-connect/blob/main/src/http/access-point.ts#L16)

URL scheme of the API access point. `https` is the default; `http` is opt-in,
meant for a local fake server or a trusted tunnel, and always warns (see
`PortersClientOptions.scheme`).
