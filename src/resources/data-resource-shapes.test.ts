import { describe, expectTypeOf, it } from "vitest";

import type { DataResource } from "./core/data-resource";
import type { Without } from "./core/data-write";
import type { EmptyReferences, ReferenceMap } from "./core/expand";
import type { EmptyCatalog, FieldCatalog } from "./core/read";
import {
  ACTIVITY_DESCRIPTOR,
  type ActivityCreateInput,
  type ActivityResource,
} from "./activity";
import {
  CANDIDATE_DESCRIPTOR,
  type CandidateCreateInput,
  type CandidateResource,
} from "./candidate";
import {
  CLIENT_DESCRIPTOR,
  type ClientCreateInput,
  type ClientResource,
} from "./client";
import {
  CONTACT_DESCRIPTOR,
  type ContactCreateInput,
  type ContactResource,
} from "./contact";
import {
  CONTRACT_DESCRIPTOR,
  type ContractCreateInput,
  type ContractResource,
} from "./contract";
import { JOB_DESCRIPTOR, type JobCreateInput, type JobResource } from "./job";
import {
  OPPORTUNITY_DESCRIPTOR,
  type OpportunityCreateInput,
  type OpportunityResource,
} from "./opportunity";
import {
  PHASE_DESCRIPTOR,
  type PhaseCreateInput,
  type PhaseResource,
  type PhaseUpdateInput,
} from "./phase";
import {
  PROCESS_DESCRIPTOR,
  type ProcessCreateInput,
  type ProcessResource,
} from "./process";
import {
  RECRUITER_DESCRIPTOR,
  type RecruiterCreateInput,
  type RecruiterResource,
} from "./recruiter";
import {
  RESUME_DESCRIPTOR,
  type ResumeCreateInput,
  type ResumeResource,
} from "./resume";
import {
  SALES_DESCRIPTOR,
  type SalesCreateInput,
  type SalesResource,
} from "./sales";

// データ系の公開の型は各リソースのファイルでメソッドを書き出している（ADR-0100）。同じ形が 12 か所に
// 並ぶので、共通の約束（DataResource＝factory が返す実装の形）と揃っていることをここで固定する。
// 共通の約束を変えて 1 か所直し忘れると、そのリソースの行が落ちる。
// 実行時には何もしない（`tsc --noEmit` の型チェックが検査する）。

// 新規で必須の項目を create の入力の型から取り出す（REQUIRED_ON_CREATE は各ファイルの外へ出していない）。
type RequiredKeys<T> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? never : K;
}[keyof T];

// 各リソースの記述子から、共通の約束に渡す項目の一覧と参照先を取り出す。
type FieldsOf<D> = D extends { fields: infer F extends FieldCatalog }
  ? F
  : never;
type ReferencesOf<D> = D extends { references: infer R extends ReferenceMap }
  ? R
  : EmptyReferences;

// 記述子と create の入力から組み立てた、そのリソースの共通の約束。`C` / `CR` は宣言した項目と必須の項目。
type ExpectedShape<
  D,
  CreateIn,
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = DataResource<
  FieldsOf<D> & C,
  Extract<RequiredKeys<CreateIn>, keyof FieldsOf<D>> | CR,
  ReferencesOf<D>
>;

// 宣言した項目を足したときも揃っていることを確かめるための、宣言の例。
type Declared = { U_score: "Number"; U_memo: "MultilineText" };

describe("the data resources' public types match the shared shape", () => {
  it("each resource spells out the same methods, with the same signatures", () => {
    expectTypeOf<ActivityResource>().toEqualTypeOf<
      ExpectedShape<typeof ACTIVITY_DESCRIPTOR, ActivityCreateInput>
    >();
    expectTypeOf<CandidateResource>().toEqualTypeOf<
      ExpectedShape<typeof CANDIDATE_DESCRIPTOR, CandidateCreateInput>
    >();
    expectTypeOf<ClientResource>().toEqualTypeOf<
      ExpectedShape<typeof CLIENT_DESCRIPTOR, ClientCreateInput>
    >();
    expectTypeOf<ContactResource>().toEqualTypeOf<
      ExpectedShape<typeof CONTACT_DESCRIPTOR, ContactCreateInput>
    >();
    expectTypeOf<ContractResource>().toEqualTypeOf<
      ExpectedShape<typeof CONTRACT_DESCRIPTOR, ContractCreateInput>
    >();
    expectTypeOf<JobResource>().toEqualTypeOf<
      ExpectedShape<typeof JOB_DESCRIPTOR, JobCreateInput>
    >();
    expectTypeOf<OpportunityResource>().toEqualTypeOf<
      ExpectedShape<typeof OPPORTUNITY_DESCRIPTOR, OpportunityCreateInput>
    >();
    expectTypeOf<ProcessResource>().toEqualTypeOf<
      ExpectedShape<typeof PROCESS_DESCRIPTOR, ProcessCreateInput>
    >();
    expectTypeOf<RecruiterResource>().toEqualTypeOf<
      ExpectedShape<typeof RECRUITER_DESCRIPTOR, RecruiterCreateInput>
    >();
    expectTypeOf<ResumeResource>().toEqualTypeOf<
      ExpectedShape<typeof RESUME_DESCRIPTOR, ResumeCreateInput>
    >();
    expectTypeOf<SalesResource>().toEqualTypeOf<
      ExpectedShape<typeof SALES_DESCRIPTOR, SalesCreateInput>
    >();
  });

  it("stays the same shape with declared custom fields and required ones", () => {
    expectTypeOf<ActivityResource<Declared, "U_score">>().toEqualTypeOf<
      ExpectedShape<
        typeof ACTIVITY_DESCRIPTOR,
        ActivityCreateInput,
        Declared,
        "U_score"
      >
    >();
    expectTypeOf<CandidateResource<Declared, "U_score">>().toEqualTypeOf<
      ExpectedShape<
        typeof CANDIDATE_DESCRIPTOR,
        CandidateCreateInput,
        Declared,
        "U_score"
      >
    >();
    expectTypeOf<ClientResource<Declared, "U_score">>().toEqualTypeOf<
      ExpectedShape<
        typeof CLIENT_DESCRIPTOR,
        ClientCreateInput,
        Declared,
        "U_score"
      >
    >();
    expectTypeOf<ContactResource<Declared, "U_score">>().toEqualTypeOf<
      ExpectedShape<
        typeof CONTACT_DESCRIPTOR,
        ContactCreateInput,
        Declared,
        "U_score"
      >
    >();
    expectTypeOf<ContractResource<Declared, "U_score">>().toEqualTypeOf<
      ExpectedShape<
        typeof CONTRACT_DESCRIPTOR,
        ContractCreateInput,
        Declared,
        "U_score"
      >
    >();
    expectTypeOf<JobResource<Declared, "U_score">>().toEqualTypeOf<
      ExpectedShape<typeof JOB_DESCRIPTOR, JobCreateInput, Declared, "U_score">
    >();
    expectTypeOf<OpportunityResource<Declared, "U_score">>().toEqualTypeOf<
      ExpectedShape<
        typeof OPPORTUNITY_DESCRIPTOR,
        OpportunityCreateInput,
        Declared,
        "U_score"
      >
    >();
    expectTypeOf<ProcessResource<Declared, "U_score">>().toEqualTypeOf<
      ExpectedShape<
        typeof PROCESS_DESCRIPTOR,
        ProcessCreateInput,
        Declared,
        "U_score"
      >
    >();
    expectTypeOf<RecruiterResource<Declared, "U_score">>().toEqualTypeOf<
      ExpectedShape<
        typeof RECRUITER_DESCRIPTOR,
        RecruiterCreateInput,
        Declared,
        "U_score"
      >
    >();
    expectTypeOf<ResumeResource<Declared, "U_score">>().toEqualTypeOf<
      ExpectedShape<
        typeof RESUME_DESCRIPTOR,
        ResumeCreateInput,
        Declared,
        "U_score"
      >
    >();
    expectTypeOf<SalesResource<Declared, "U_score">>().toEqualTypeOf<
      ExpectedShape<
        typeof SALES_DESCRIPTOR,
        SalesCreateInput,
        Declared,
        "U_score"
      >
    >();
  });

  // Phase だけは違いを持たせている（検索が keywords / itemstate を受けない・書き込みが Resource を受けない）。
  // 違いの無いメソッドは共通の約束と同じこと、違うメソッドは違いの分だけ違うことを確かめる。
  it("Phase differs only where it says so", () => {
    // Phase は宣言した項目を持たないので、項目の一覧に `C` を足さない。
    type Shared = DataResource<
      FieldsOf<typeof PHASE_DESCRIPTOR>,
      RequiredKeys<PhaseCreateInput>
    >;
    expectTypeOf<keyof PhaseResource>().toEqualTypeOf<keyof Shared>();
    expectTypeOf<PhaseResource["get"]>().toEqualTypeOf<Shared["get"]>();
    expectTypeOf<PhaseResource["getMany"]>().toEqualTypeOf<Shared["getMany"]>();
    // 検索のクエリは keywords / itemstate を受けない（`?: never` で塞いでいる）。
    type Query = NonNullable<Parameters<PhaseResource["search"]>[0]>;
    type AllQuery = NonNullable<Parameters<PhaseResource["searchAll"]>[0]>;
    expectTypeOf<Query["keywords"]>().toEqualTypeOf<undefined>();
    expectTypeOf<Query["itemstate"]>().toEqualTypeOf<undefined>();
    expectTypeOf<AllQuery["keywords"]>().toEqualTypeOf<undefined>();
    expectTypeOf<AllQuery["itemstate"]>().toEqualTypeOf<undefined>();
    // それ以外のクエリのキーは、ほかのデータ系と同じ。
    type SharedQuery = NonNullable<Parameters<Shared["search"]>[0]>;
    expectTypeOf<
      Exclude<keyof Query, "keywords" | "itemstate">
    >().toEqualTypeOf<Exclude<keyof SharedQuery, "keywords" | "itemstate">>();
    // 書き込みの入力は Resource を受けない。
    expectTypeOf<Parameters<PhaseResource["create"]>[0]>().toEqualTypeOf<
      Without<PhaseCreateInput, "Resource">
    >();
    expectTypeOf<Parameters<PhaseResource["update"]>[1]>().toEqualTypeOf<
      Without<PhaseUpdateInput, "Resource">
    >();
  });
});
