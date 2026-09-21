[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / encodeTimeOfDay

# Function: encodeTimeOfDay()

> **encodeTimeOfDay**(`time`): `string`

Defined in: [src/util/time-of-day.ts:120](https://github.com/Joymerrevent/porters-connect/blob/main/src/util/time-of-day.ts#L120)

Write (or search on) a **time-of-day** (時分型) field from a clock time.

Turns `"HH:mm"` / `"HH:mm:ss"` (`00:00`–`47:59`, PORTERS' own range) into the anchored ISO
date-time the field takes — `"09:00"` → `"1970-01-01T09:00:00Z"`, `"26:00"` →
`"1970-01-02T02:00:00Z"` — so the value goes through `update` / `create` / `condition` like any
DateTime (ADR-0086). PORTERS answers any other date with Code 103 on write and Code 100 on
condition (the search is not run), so an out-of-range or malformed clock time is refused here,
before anything is sent.

## Parameters

### time

`string`

## Returns

`string`

## Throws

PortersConfigError (`category: "validation"`) unless the value is `HH:mm` or `HH:mm:ss`
  with hours 00–47 and minutes / seconds 00–59.

## Example

```ts
// doccheck: fields
await t.job.update(1, { U_startTime: encodeTimeOfDay("26:00") });
await t.job.search({ condition: { U_startTime: { ge: encodeTimeOfDay("15:00") } } });
```
