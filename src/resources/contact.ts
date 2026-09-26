// Contact accessor (ADR-0004/0005/0011/0019): Read (search / searchAll / get) + Write
// (create / update) over the generic resource factory. Only the Data-Type catalog and
// names are Contact-specific; the static Contact / input types derive from the catalog
// (ADR-0019).
//
// Contact and Recruiter have the *same* field list (both are people at a Client company —
// PORTERS separates them by role, not by shape). They stay two modules rather than one
// shared factory: the catalogs are independent facts about the API and are checked against
// docs/usage/reference one by one, so a future divergence shows up as a diff, not as a surprise.

import { createDataResource, type catalogMark } from "./core/data-resource";
import type {
  EmptyImages,
  GetOptions,
  GetRecord,
  ReadSelection,
  SearchRecord,
} from "./core/read-record";
import type { CreateInput, UpdateInput } from "./core/write-record";
import type {
  EmptyCatalog,
  FieldCatalog,
  ReadFieldAlias,
  ReadRecord,
} from "./core/catalog";
import type { Paging } from "./core/paging";
import type { ResourceDeps } from "./core/deps";
import type { ResourcePage, ResourcePageOf } from "./core/read";
import type { EmptyReferences, Expand, ReferenceMap } from "./core/expand";
import type { ImageOption } from "./core/image";
import type { BulkWriteResult } from "./core/write-many";
import type { SearchQuery } from "./core/query";
import type { ResourceDescriptor } from "./core/descriptor";
import { CLIENT_DESCRIPTOR } from "./client";
import type { ResourceName } from "../porters/resource-list";

const FIELDS = {
  P_Id: "System[Id]",
  P_Owner: "User",
  P_Client: "System[Reference]",
  P_RegistrationDate: "System[DateTime]",
  P_RegisteredBy: "User",
  P_UpdateDate: "System[DateTime]",
  P_UpdatedBy: "User",
  P_Phase: "Option",
  P_PhaseDate: "DateTime",
  P_PhaseMemo: "MultilineText",
  P_Name: "SinglelineText",
  P_Reading: "SinglelineText",
  P_Division: "SinglelineText",
  P_Title: "SinglelineText",
  P_Memo: "MultilineText",
  P_Country: "SinglelineText",
  P_Prefecture: "SinglelineText",
  P_City: "SinglelineText",
  P_Street: "MultilineText",
  P_Zipcode: "SinglelineText",
  P_Telephone: "Telephone",
  P_Fax: "Telephone",
  P_Mail: "Mail",
  P_Mobile: "Telephone",
  // `Telephone`, as PORTERS publishes it — same as Recruiter, unlike Candidate's `Mail`.
  P_MobileMail: "Telephone",
  // 削除状態（"0" / "1"）。PORTERS が Data Type を与えていない項目＝`null`（ADR-0056。
  // 詳細は candidate.ts のコメント）。Read の field でのみ指定でき、型もそう振る舞う。
  P_Deleted: null,
} as const satisfies FieldCatalog;

// Required on create per docs/usage/reference (resources/contact.md「新規必須」列): P_Owner /
// P_Client（P_Id は System[Id]＝lib 供給のため除外）。
const REQUIRED_ON_CREATE = [
  "P_Owner",
  "P_Client",
] as const satisfies readonly (keyof typeof FIELDS)[];

// Expandable reference fields (ADR-0058). The Field List article says Read may reach the
// Client resource's fields through P_Client, which is exactly what `expand` requests.
const REFERENCES = {
  P_Client: CLIENT_DESCRIPTOR,
} as const satisfies ReferenceMap;

/**
 * Contact's names + standard catalog. Exported for in-repo dev tooling — the fake server
 * (ADR-0043) builds Contact wire shapes from this very catalog, so the two cannot drift.
 * Not re-exported from `src/index.ts`, so it stays out of the published API.
 */
export const CONTACT_DESCRIPTOR = {
  name: "Contact",
  path: "contact" satisfies ResourceName,
  prefix: "Contact",
  fields: FIELDS,
  references: REFERENCES,
} as const satisfies ResourceDescriptor;

/** A decoded Contact (a contact person at a client company): known `P_` fields, each `value | null`. */
export type Contact = ReadRecord<typeof FIELDS>;
export type ContactPage = ResourcePage<typeof FIELDS>;
/**
 * The Contact Read query. `C` is the declared custom-field catalog merged on, so a condition or an
 * order can name a custom field too.
 */
export type ContactSearchQuery<C extends FieldCatalog = EmptyCatalog> =
  SearchQuery<typeof FIELDS & C, typeof REFERENCES>;

/**
 * Fields for `create`: `P_Owner` / `P_Client` required; `P_Id` / system timestamps are not
 * settable. `C` is the declared custom-field catalog merged on; `CR` names the custom fields
 * that are required on `create`.
 */
export type ContactCreateInput<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = CreateInput<typeof FIELDS & C, (typeof REQUIRED_ON_CREATE)[number] | CR>;
/**
 * Fields for `update`: all optional (`null` omits, `""` clears a text field). `C` is the
 * declared custom-field catalog merged on.
 */
export type ContactUpdateInput<C extends FieldCatalog = EmptyCatalog> =
  UpdateInput<typeof FIELDS & C>;

// 公開の型の書き出しで繰り返す、利用者が宣言した項目を足した一覧。
type Fields<C extends FieldCatalog> = typeof FIELDS & C;

// メソッドはこのファイルで書き出す（ADR-0100）。データ系で揃っていることは
// data-resource-shapes.test.ts が確かめる。
/**
 * The Contact accessor. `C` is the declared custom-field catalog merged on; `CR` names the
 * custom fields that are required on `create`.
 */
export type ContactResource<
  C extends FieldCatalog = EmptyCatalog,
  CR extends keyof C = never,
> = {
  /** @internal Type-level mark of the field catalog; never present at runtime. */
  [catalogMark]?(field: ReadFieldAlias<Fields<C>>): void;
  /**
   * Search Contact records: resolves to one page of the records matching `query`. `field` picks
   * the fields to read (omit it to read every known field), `expand` reads referenced records
   * too, `image` picks an Image field's sub-fields, and `count` / `start` choose the page.
   */
  search<
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: ContactSearchQuery<C> & Paging & ReadSelection<FL, E, I>,
  ): Promise<
    ResourcePageOf<SearchRecord<Fields<C>, typeof REFERENCES, E, I, FL>>
  >;
  /**
   * Search every Contact record matching `query`, page after page (200 records per request).
   * Takes the same `field` / `expand` / `image` as `search`.
   */
  searchAll<
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    query?: ContactSearchQuery<C> & ReadSelection<FL, E, I>,
  ): AsyncIterable<SearchRecord<Fields<C>, typeof REFERENCES, E, I, FL>>;
  /**
   * Read one Contact record by id; `undefined` when there is none. `field` picks the fields to
   * read, the same way it does for `search` (omit it to read every known field); the record's id
   * is always read, even when `field` leaves it out. `expand` reads referenced records too;
   * `image` picks an Image field's sub-fields — `get` is where asking for a `Content` belongs,
   * since it fetches one record rather than a page.
   */
  get<
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    id: number,
    options?: GetOptions<Fields<C>, FL, E, I>,
  ): Promise<GetRecord<Fields<C>, typeof REFERENCES, E, I, FL> | undefined>;
  // 設計は ADR-0095（ID の突き合わせ・組分け・戻り値の形）。
  /**
   * Read many Contact records by id. Resolves to an array in the order of `ids`, holding
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
    const E extends Expand<typeof REFERENCES> = EmptyReferences,
    const I extends ImageOption<Fields<C>> = EmptyImages,
    const FL extends readonly ReadFieldAlias<Fields<C>>[] | undefined =
      undefined,
  >(
    ids: readonly number[],
    options?: GetOptions<Fields<C>, FL, E, I>,
  ): Promise<(GetRecord<Fields<C>, typeof REFERENCES, E, I, FL> | undefined)[]>;
  /** Create one Contact record; resolves to the newly assigned id. */
  create(input: ContactCreateInput<C, CR>): Promise<number>;
  /** Update one Contact record by id; resolves to that id. */
  update(id: number, input: ContactUpdateInput<C>): Promise<number>;
  // 一括書き込みの設計は ADR-0041 / F-4。
  /**
   * Create many Contact records in one call. Auto-batched to ≤200 records and under the request
   * size cap. **Not atomic** — inspect the `BulkWriteResult`: per-record failures are returned
   * (`failed` / `hasFailures`), not thrown. Only a whole-request failure throws (with the
   * already-written count). Batching is non-idempotent: a full retry after a mid-run failure may
   * duplicate creates. Empty input sends no request.
   */
  createMany(inputs: ContactCreateInput<C, CR>[]): Promise<BulkWriteResult>;
  /**
   * Update many Contact records by id in one call. Auto-batched like `createMany`; per-record
   * failures are returned in the `BulkWriteResult`, not thrown.
   */
  updateMany(
    items: { id: number; fields: ContactUpdateInput<C> }[],
  ): Promise<BulkWriteResult>;
};

export const createContactResource = <C extends FieldCatalog = EmptyCatalog>(
  deps: ResourceDeps,
  custom?: C,
): ContactResource<C> => {
  // Custom U_/A_ aliases never collide with P_, so the merge is exactly `typeof FIELDS & C`;
  // the cast just names that intersection (defineFields already validated aliases — ADR-0023 D7).
  const fields = { ...FIELDS, ...custom } as typeof FIELDS & C;
  // `C` が型引数のままだと、共通の実装の型（DataResource）とこのファイルで書き出した型が同じだと
  // コンパイラが示しきれないので、ここで名前を付け替える（ADR-0100）。同じであることは
  // data-resource-shapes.test.ts が具体的な `C` で確かめる。
  return createDataResource(
    { ...CONTACT_DESCRIPTOR, fields, requiredOnCreate: REQUIRED_ON_CREATE },
    deps,
  ) as ContactResource<C>;
};
