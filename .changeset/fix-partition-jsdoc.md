---
"@joymerrevent/porters-connect": patch
---

fix(client): correct the misleading `partition` JSDoc (RV-10)

`PortersClientOptions.partition` was documented as "overridable per call", but per-call
override is not implemented — the partition is fixed at construction. The JSDoc now states
this accurately (per-call override is planned; see ADR-0033). No runtime change.
