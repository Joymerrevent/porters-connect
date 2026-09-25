// Activity accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and
// names are Activity-specific; the static Activity / input types derive from the catalog
// (ADR-0019).
//
// Activity attaches to *any* upper resource: `P_Resource` is the resource's numeric id
// (Resource List — Candidate 1, Job 3, Client 5, …) and `P_ResourceId` is the record's id
// in that resource. That makes `P_ResourceId` a **polymorphic** System[Reference]: which
// catalog decodes it is a runtime value, not a static fact, so it is deliberately left out
// of `REFERENCES` and reads as the referenced id — the same as any un-expanded reference
// (ADR-0058). Expanding it would require choosing a descriptor we cannot know at compile
// time; callers read `P_Resource` and fetch through the matching accessor themselves.

import { createDataResource, type catalogMark } from "./core/data-resource";
import type {
  EmptyImages,
  GetOptions,
  GetRecord,
  ReadSelection,
  SearchRecord,
} from "./core/data-read";
import type { CreateInput, UpdateInput } from "./core/data-write";
import type {
  EmptyCatalog,
  FieldCatalog,
  Paging,
  ReadFieldAlias,
  ReadRecord,
  ResourceDeps,
  ResourcePage,
  ResourcePageOf,
} from "./core/read";
import type { EmptyReferences, Expand } from "./core/expand";
import type { ImageOption } from "./core/image";
import type { BulkWriteResult } from "./core/bulk-write";
import type { SearchQuery } from "./core/query";
import type { ResourceDescriptor } from "./core/descriptor";
import type { ResourceName } from "../porters/resource-list";

const FIELDS = {
  P_Id: "System[Id]",
  P_Owner: "User",
  P_Title: "SinglelineText",
  P_RegistrationDate: "System[DateTime]",
  P_RegisteredBy: "User",
  P_UpdateDate: "System[DateTime]",
  P_UpdatedBy: "User",
  P_Phase: "Option",
  P_PhaseDate: "DateTime",
  P_PhaseMemo: "MultilineText",
  // Which upper resource this activity hangs off (Resource List's numeric id) …
  P_Resource: "Number",
  // … and the record id within it. Polymorphic reference — see the module comment.
  P_ResourceId: "System[Reference]",
  P_FromDate: "DateTime",
  P_ToDate: "DateTime",
  P_Memo: "MultilineText",
  // VERIFY(live): participants is a `User` field that can hold several people. Whether the
  // Read response repeats the nested <User> element (and how) is unconfirmed; the decoder
  // takes the first, like every other User field — so a second participant would be dropped
  // silently. docs/live-verification.md (LV-27).
  P_EventParticipants: "User",
  P_EventResources: "Option",
  // 削除状態（"0" / "1"）。PORTERS が Data Type を与えていない項目＝`null`（ADR-0056。
  // 詳細は candidate.ts のコメント）。Read の field でのみ指定でき、型もそう振る舞う。
  P_Deleted: null,
} as const satisfies FieldCatalog;

// Required on create per docs/usage/reference (resources/activity.md「新規必須」列): P_Owner /
// P_Title（P_Id は System[Id]＝lib 供給のため除外）。P_Resource / P_ResourceId は必須では
// ないと公表されている＝どこにも紐づかない Activity も登録できる。手前で厳しくしない。
const REQUIRED_ON_CREATE = [
  "P_Owner",
  "P_Title",
] as const satisfies readonly (keyof typeof FIELDS)[];

/**
 * Activity's names + standard catalog. Exported for in-repo dev tooling — the fake server
 * (ADR-0043) builds Activity wire shapes from this very catalog, so the two cannot drift.
 * Not re-exported from `src/index.ts`, so it stays out of the published API.
 */
export const ACTIVITY_DESCRIPTOR = {
  name: "Activity",
  path: "activity" satisfies ResourceName,
  prefix: "Activity",
  fields: FIELDS,
} as const satisfies ResourceDescriptor;

/** A decoded Activity (an action logged against another record): known `P_` fields, each `value | null`. */
export type Activity = ReadRecord<typeof FIELDS>;
export type ActivityPage = ResourcePage<typeof FIELDS>;
/**
 * The Activity Read query. `C` is the declared custom-field catalog merged on, so a condition or an
 * order can name a custom field too.
 */
export type ActivitySearchQuery<C extends FieldCatalog = EmptyCatalog> =
  SearchQuery<typeof FIELDS & C>;

/**
 * Fields for `create`: `P_Owner` / `P_Title` required; `P_Id` / timestamps are not settable. `C`
 * is the declared custom-field catalog merged on; `CR` names the custom fields that are required
 * on `create`.
 */
export type ActivityCreateInput<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = CreateInput<typeof FIELDS & C, (typeof REQUIRED_ON_CREATE)[number] | CR>;
/**
 * Fields for `update`: all optional (`null` omits, `""` clears a text field). `C` is the
 * declared custom-field catalog merged on.
 */
export type ActivityUpdateInput<C extends FieldCatalog = EmptyCatalog> =
  UpdateInput<typeof FIELDS & C>;

// 公開の型の書き出しで繰り返す、利用者が宣言した項目を足した一覧。
type Fields<C extends FieldCatalog> = typeof FIELDS & C;

// メソッドはこのファイルで書き出す（ADR-0100）。データ系で揃っていることは
// data-resource-shapes.test.ts が確かめる。
/**
 * The Activity accessor. `C` is the declared custom-field catalog merged on; `CR` names the
 * custom fields that are required on `create`.
 */
export type ActivityResource<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = {
  /** @internal Type-level mark of the field catalog; never present at runtime. */
  [catalogMark]?(field: ReadFieldAlias<Fields<C>>): void;
  /**
   * Search Activity records: resolves to one page of the records matching `query`. `field` picks
   * the fields to read (omit it to read every known field), `expand` reads referenced records
   * too, `image` picks an Image field's sub-fields, and `count` / `start` choose the page.
   */
  search<
    const E extends Expand<EmptyReferences> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: ActivitySearchQuery<C> & Paging & ReadSelection<FL, E, I>,
  ): Promise<
    ResourcePageOf<SearchRecord<Fields<C>, EmptyReferences, E, I, FL>>
  >;
  /**
   * Search every Activity record matching `query`, page after page (200 records per request).
   * Takes the same `field` / `expand` / `image` as `search`.
   */
  searchAll<
    const E extends Expand<EmptyReferences> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: ActivitySearchQuery<C> & ReadSelection<FL, E, I>,
  ): AsyncIterable<SearchRecord<Fields<C>, EmptyReferences, E, I, FL>>;
  /**
   * Read one Activity record by id; `undefined` when there is none. `field` picks the fields to
   * read, the same way it does for `search` (omit it to read every known field); the record's id
   * is always read, even when `field` leaves it out. `expand` reads referenced records too;
   * `image` picks an Image field's sub-fields — `get` is where asking for a `Content` belongs,
   * since it fetches one record rather than a page.
   */
  get<
    const E extends Expand<EmptyReferences> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    id: number,
    options?: GetOptions<Fields<C>, FL, E, I>,
  ): Promise<GetRecord<Fields<C>, EmptyReferences, E, I, FL> | undefined>;
  // 設計は ADR-0095（ID の突き合わせ・組分け・戻り値の形）。
  /**
   * Read many Activity records by id. Resolves to an array in the order of `ids`, holding
   * `undefined` where no record has that id — the same answer `get` gives for one id. A repeated
   * id gets the same record at each of its positions; an empty `ids` sends no request.
   *
   * The ids are sent together (up to 200 per request, and as many as fit under the request size
   * limit), so this makes far fewer requests than calling `get` for each id. Takes the same
   * options as `get`; narrowing `field` shortens each request, so more ids fit in one.
   *
   * Every record that comes back is checked against the ids that were asked for. If PORTERS
   * returns one that was not requested, the call rejects instead of returning it.
   */
  getMany<
    const E extends Expand<EmptyReferences> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    ids: readonly number[],
    options?: GetOptions<Fields<C>, FL, E, I>,
  ): Promise<(GetRecord<Fields<C>, EmptyReferences, E, I, FL> | undefined)[]>;
  /** Create one Activity record; resolves to the newly assigned id. */
  create(input: ActivityCreateInput<C, CR>): Promise<number>;
  /** Update one Activity record by id; resolves to that id. */
  update(id: number, input: ActivityUpdateInput<C>): Promise<number>;
  // 一括書き込みの設計は ADR-0041 / F-4。
  /**
   * Create many Activity records in one call. Auto-batched to ≤200 records and under the request
   * size cap. **Not atomic** — inspect the `BulkWriteResult`: per-record failures are returned
   * (`failed` / `hasFailures`), not thrown. Only a whole-request failure throws (with the
   * already-written count). Batching is non-idempotent: a full retry after a mid-run failure may
   * duplicate creates. Empty input sends no request.
   */
  createMany(inputs: ActivityCreateInput<C, CR>[]): Promise<BulkWriteResult>;
  /**
   * Update many Activity records by id in one call. Auto-batched like `createMany`; per-record
   * failures are returned in the `BulkWriteResult`, not thrown.
   */
  updateMany(
    items: { id: number; fields: ActivityUpdateInput<C> }[],
  ): Promise<BulkWriteResult>;
};

export const createActivityResource = <C extends FieldCatalog = EmptyCatalog>(
  deps: ResourceDeps,
  custom?: C,
): ActivityResource<C> => {
  // Custom U_/A_ aliases never collide with P_, so the merge is exactly `typeof FIELDS & C`;
  // the cast just names that intersection (defineFields already validated aliases — ADR-0023 D7).
  const fields = { ...FIELDS, ...custom } as typeof FIELDS & C;
  // `C` が型引数のままだと、共通の実装の型（DataResource）とこのファイルで書き出した型が同じだと
  // コンパイラが示しきれないので、ここで名前を付け替える（ADR-0100）。同じであることは
  // data-resource-shapes.test.ts が具体的な `C` で確かめる。
  return createDataResource(
    { ...ACTIVITY_DESCRIPTOR, fields, requiredOnCreate: REQUIRED_ON_CREATE },
    deps,
  ) as ActivityResource<C>;
};
