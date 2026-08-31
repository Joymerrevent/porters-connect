// PORTERS' Resource List: the numeric id each resource is known by when another resource points
// at it (docs/reference resources-list.md — Candidate 1, Job 3, Client 5, …). Phase's Read takes
// one as its required `resource=` parameter, and Activity stores one in `P_Resource`.
//
// The library exposes **names**, not those numbers (ADR-0061 案5b): the values are non-contiguous
// (1/3/5/7/9/11/13/17/19/25/27), so a caller cannot remember them, and neither a gap (`6`) nor a
// mix-up (Recruiter 9 vs Sales 11) is catchable by a `number` type. A name is the same vocabulary
// as the accessor it belongs to (`t.client` -> `"client"`).
//
// Each key is written as the owning descriptor's `path`, so the two cannot drift: rename a path
// and this file stops compiling. PORTERS gives Phase and Attachment no value, so they are absent
// — which is why `of("phase")` is a compile error.

import { ACTIVITY_DESCRIPTOR } from "./activity";
import { CANDIDATE_DESCRIPTOR } from "./candidate";
import { CLIENT_DESCRIPTOR } from "./client";
import { CONTACT_DESCRIPTOR } from "./contact";
import { CONTRACT_DESCRIPTOR } from "./contract";
import { JOB_DESCRIPTOR } from "./job";
import { OPPORTUNITY_DESCRIPTOR } from "./opportunity";
import { PROCESS_DESCRIPTOR } from "./process";
import { RECRUITER_DESCRIPTOR } from "./recruiter";
import { RESUME_DESCRIPTOR } from "./resume";
import { SALES_DESCRIPTOR } from "./sales";

/** Resource name -> the numeric id PORTERS uses for it (docs/reference resources-list.md). */
export const RESOURCE_VALUES = {
  [CANDIDATE_DESCRIPTOR.path]: 1,
  [JOB_DESCRIPTOR.path]: 3,
  [CLIENT_DESCRIPTOR.path]: 5,
  [PROCESS_DESCRIPTOR.path]: 7,
  [RECRUITER_DESCRIPTOR.path]: 9,
  [SALES_DESCRIPTOR.path]: 11,
  [CONTRACT_DESCRIPTOR.path]: 13,
  [RESUME_DESCRIPTOR.path]: 17,
  [ACTIVITY_DESCRIPTOR.path]: 19,
  [OPPORTUNITY_DESCRIPTOR.path]: 25,
  [CONTACT_DESCRIPTOR.path]: 27,
} as const satisfies Record<string, number>;

/**
 * A resource PORTERS can point at by id — the vocabulary of `t.phase.of(...)`. Same spelling as
 * the accessor (`t.client` -> `"client"`), so a typo is a compile error rather than an HTTP 400.
 */
export type ResourceName = keyof typeof RESOURCE_VALUES;
