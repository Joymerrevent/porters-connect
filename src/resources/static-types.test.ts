import { describe, expectTypeOf, it } from "vitest";

import type { UserRef } from "../xml/decode";
import type {
  Candidate,
  CandidateCreateInput,
  CandidateSearchQuery,
  CandidateUpdateInput,
} from "./candidate";
import type { ProcessCreateInput } from "./process";

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

  it("create required set follows the reference per resource (Process = relations, LV-5)", () => {
    // Process requires P_Owner + the five relation fields (docs/reference resources/process.md)
    expectTypeOf<ProcessCreateInput>()
      .toHaveProperty("P_Owner")
      .toEqualTypeOf<number>();
    expectTypeOf<ProcessCreateInput>()
      .toHaveProperty("P_Job")
      .toEqualTypeOf<number>();
    expectTypeOf<ProcessCreateInput>()
      .toHaveProperty("P_Candidate")
      .toEqualTypeOf<number>();
    // a non-required field stays optional
    expectTypeOf<ProcessCreateInput>()
      .toHaveProperty("P_PhaseMemo")
      .toEqualTypeOf<string | null | undefined>();
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

// PORTERS はこの項目を「Read の field でのみ指定可・Condition/Order 不可・Write 不可」と定める。
// カタログに `null`（＝ Data Type が無い）と書くだけで、その 3 つが導出型に現れることを固定する。
// 追加のガード実装は無いので、ここが壊れたら制約そのものが消えている（ADR-0056）。
describe("型を持たない項目（P_Deleted）の制約 — ADR-0056", () => {
  it('Read には出る。値は生の文字列（"0" / "1"）', () => {
    expectTypeOf<Candidate>()
      .toHaveProperty("P_Deleted")
      .toEqualTypeOf<string | null | undefined>();
  });

  it("condition には出せない（ConditionFor が never に落ちる）", () => {
    expectTypeOf<
      NonNullable<CandidateSearchQuery["condition"]>
    >().toHaveProperty("P_Deleted");
    expectTypeOf<
      NonNullable<CandidateSearchQuery["condition"]>["P_Deleted"]
    >().toEqualTypeOf<undefined>();
  });

  it("order には出せない（OrderableKeys から外れる）", () => {
    expectTypeOf<
      NonNullable<CandidateSearchQuery["order"]>[number]
    >().not.toHaveProperty("P_Deleted");
  });

  it("create / update の入力に出ない（WritableKeys から外れる）", () => {
    expectTypeOf<CandidateCreateInput>().not.toHaveProperty("P_Deleted");
    expectTypeOf<CandidateUpdateInput>().not.toHaveProperty("P_Deleted");
  });
});
