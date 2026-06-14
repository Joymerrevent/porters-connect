// PORTERS datetime <-> ISO 8601 (UTC) normalization (PRD R-10):
//   DateTime `yyyy/mm/dd HH:MM:SS` (UTC) <-> ISO `...Z`
//   Date     `yyyy/mm/dd`                <-> date-only (no `Z`)
// No business-timezone (e.g. JST) conversion — that is the caller's
// responsibility. Implementation lands in detailed design. Placeholder until
// then.
export {};
