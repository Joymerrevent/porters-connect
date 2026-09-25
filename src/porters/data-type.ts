// PORTERS' Data Types (docs/usage/reference/resource-api/field-data-types.md) — the vocabulary every
// Read decode, Write encode and field catalog speaks. A PORTERS-defined list, so it lives with the
// other PORTERS rules (ADR-0098).
//
// Granularity = PORTERS Data Type (ADR-0016). Labels are the literal Data Type
// strings, incl. the System family (`System[Id]` / `System[DateTime]` / `System[Reference]`).
// Currency collapses to Number and the three Option subtypes to Option (PORTERS' own
// Data Type does the same); the string Data Types stay distinct (room for future
// validation / normalisation). Image (FT-18) and Link (FT-20) complete the set (ADR-0064);
// neither appears in any standard catalog — they reach the library only as tenant custom
// fields declared with `defineFields`. The `System[…]` qualifier marks system-managed values
// (auto-assigned, often Write-restricted); that lifecycle is enforced via input types,
// not here — decoding is by value shape.
export type DataType =
  | "System[Id]"
  | "Number"
  | "DateTime"
  | "System[DateTime]"
  | "Date"
  | "Age"
  | "SinglelineText"
  | "MultilineText"
  | "Mail"
  | "Telephone"
  | "URL"
  | "User"
  | "Option"
  | "System[Reference]"
  | "System[Department]"
  | "Image"
  | "Link";
