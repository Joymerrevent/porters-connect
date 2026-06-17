import { describe, expectTypeOf, it } from "vitest";

import type { UserRef } from "../xml/decode";
import type {
  Candidate,
  CandidateCreateInput,
  CandidateUpdateInput,
} from "./candidate";

// Type-level tests for the catalog-derived static types (ADR-0019). These are no-ops at
// runtime; `tsc --noEmit` (the typecheck gate) checks the assertions.
describe("SD-3 static resource types (ADR-0019)", () => {
  it("Read maps each Data Type to its value — every field optional + nullable", () => {
    expectTypeOf<Candidate>()
      .toHaveProperty("P_Id")
      .toEqualTypeOf<number | null | undefined>(); // System[Id] -> number
    expectTypeOf<Candidate>()
      .toHaveProperty("P_Name")
      .toEqualTypeOf<string | null | undefined>(); // SinglelineText -> string
    expectTypeOf<Candidate>()
      .toHaveProperty("P_Phase")
      .toEqualTypeOf<string[] | null | undefined>(); // Option -> string[]
    expectTypeOf<Candidate>()
      .toHaveProperty("P_Owner")
      .toEqualTypeOf<UserRef | null | undefined>(); // User -> UserRef
    expectTypeOf<Candidate>()
      .toHaveProperty("P_UpdateDate")
      .toEqualTypeOf<string | null | undefined>(); // System[DateTime] -> string
  });

  it("create requires P_Owner (W2) and excludes System[Id] / System[DateTime]", () => {
    // required-on-create: the property is non-optional (`number`, not `number | undefined`)
    expectTypeOf<CandidateCreateInput>()
      .toHaveProperty("P_Owner")
      .toEqualTypeOf<number>();
    // a writable, non-required field is optional + nullable
    expectTypeOf<CandidateCreateInput>()
      .toHaveProperty("P_Name")
      .toEqualTypeOf<string | null | undefined>();
    // library-supplied id and Write-restricted timestamps are not create fields
    expectTypeOf<CandidateCreateInput>().not.toHaveProperty("P_Id");
    expectTypeOf<CandidateCreateInput>().not.toHaveProperty(
      "P_RegistrationDate",
    );
    expectTypeOf<CandidateCreateInput>().not.toHaveProperty("P_UpdateDate");
  });

  it("update makes every writable field optional; same exclusions", () => {
    expectTypeOf<CandidateUpdateInput>()
      .toHaveProperty("P_Owner")
      .toEqualTypeOf<number | null | undefined>(); // optional on update
    expectTypeOf<CandidateUpdateInput>().not.toHaveProperty("P_Id");
    expectTypeOf<CandidateUpdateInput>().not.toHaveProperty(
      "P_RegistrationDate",
    );
  });
});
