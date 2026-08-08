// Barrel of the in-repo fake PORTERS server (ADR-0043). Dev-only: never imported from `src/`.
//
// Which one do I want?
//   `createMockTransport` (src, public)  — stateless stub, one canned answer per request (N1).
//     Reach for it in a unit test that asserts on a single call, or in a user-facing sample.
//   `createFakeTransport` (here, dev)    — stateful server: OAuth, a record store, PORTERS'
//     constraints and fault injection (N2 / L1 integration). Reach for it when a *flow* matters
//     (create -> search -> update), or when the failure you want is the API's, not the stub's.

export * from "./fake-transport";
export * from "./masters";
export * from "./records";
export * from "./resources";
export * from "./store";
export * from "./types";
