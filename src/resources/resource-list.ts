// PORTERS' Resource List: the numeric id each resource is known by when another resource points
// at it (docs/usage/reference resources-list.md — Candidate 1, Job 3, Client 5, …). Phase's Read takes
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

/** Resource name -> the numeric id PORTERS uses for it (docs/usage/reference/resource-api/resources-list.md). */
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

// 名前 <-> 番号の変換を公開する決定は ADR-0079。
/**
 * The number PORTERS knows a resource by. The library takes **names** where PORTERS
 * takes a `resource=` parameter, but a *field value* stays the number its Data Type declares —
 * `Activity.P_Resource`, `Attachment.Resource`, and a `condition` on either.
 *
 * Write the name and let this do the lookup; the numbers are non-contiguous
 * (1/3/5/7/9/11/13/17/19/25/27), so a literal is easy to get wrong and impossible to spot.
 *
 * @example
 * await t.activity.create({
 *   P_Owner: 5,
 *   P_Title: "面談",
 *   P_Resource: resourceValueOf("candidate"), // 1
 *   P_ResourceId: 10001,
 * });
 */
export const resourceValueOf = (name: ResourceName): number =>
  RESOURCE_VALUES[name];

// 未知の番号をそのまま返す（undefined にも例外にもしない）のは ADR-0079。
/**
 * The name for a resource number — the other direction of {@link resourceValueOf}.
 * Use it to read a value PORTERS returned: `Activity.P_Resource`, `Field.P_ResourceType`, or a
 * raw value from {@link rawValue}.
 *
 * **A number PORTERS added since this version comes back as the number**, not `undefined` and not
 * an error. The Resource List belongs to PORTERS and grows (Contact `27` arrived that way), so a
 * value this library does not know is data, not a fault.
 *
 * @example
 * const a = await t.activity.get(1);
 * resourceNameOf(a?.P_Resource ?? 0); // "candidate" | … | number
 */
export const resourceNameOf = (value: number): ResourceName | number => {
  // 表は 11 件なので、逆引きの索引を持たずその場で探す。module 読み込み時に組み立てた Map を
  // 持つと、初期化がテストから到達できない静的コードになり（ミューテーションが素通りする）、
  // 得られるのは 11 件の線形探索を省く時間だけだった。
  const found = Object.entries(RESOURCE_VALUES).find(
    ([, known]) => known === value,
  );
  return found === undefined ? value : (found[0] as ResourceName);
};
