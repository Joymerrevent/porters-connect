[**@joymerrevent/porters-connect**](../index.md)

***

[@joymerrevent/porters-connect](../index.md) / decodeTimeOfDay

# Function: decodeTimeOfDay()

> **decodeTimeOfDay**(`iso`): `string`

Defined in: [src/util/time-of-day.ts:54](https://github.com/Joymerrevent/porters-connect/blob/main/src/util/time-of-day.ts#L54)

Read a **time-of-day** (時分型) field's value as a clock time.

PORTERS stores a time-of-day field as a DateTime anchored to 1970/01/01 (`24:00`–`47:59` land on
1970/01/02) and Field Read cannot tell it from a date-time field (ADR-0086). Read the field as
usual — it decodes to ISO — and pass that ISO string here to get the clock time back:
`"1970-01-01T09:00:00Z"` → `"09:00"`, `"1970-01-02T02:00:00Z"` → `"26:00"`.

Seconds are kept when they are not `00` (`"09:00:30"`) — PORTERS' UI takes hours and minutes
only, but the wire format carries seconds, and dropping them would lose data silently.

## Parameters

### iso

`string`

## Returns

`string`

## Throws

PortersConfigError (`category: "validation"`) when the value is not an ISO date-time on
  1970-01-01 / 1970-01-02 — which usually means the field is a date-time, not a time-of-day — or
  its clock part is out of range (hours 00–23 on either anchor day, minutes / seconds 00–59).

## Example

```ts
// doccheck: fields
const job = await t.job.get(1);
const start = job?.U_startTime == null ? null : decodeTimeOfDay(job.U_startTime); // "09:00"
```
