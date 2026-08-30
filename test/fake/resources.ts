// Which resources the fake answers, and the few facts about each that the protocol layer needs.
//
// Every catalog here is the resource module's *own* descriptor, so the fake and the library read
// the same Data Types (ADR-0043 D-fixture共有: no second copy to drift). Attachment is the one
// exception — it is bespoke in the library too (no alias prefix, no Data-Type catalog), so the fake
// types its fields itself; `attachment-fields.test.ts` guards that list against drift.
//
// Phase 3 adds the master reads (Partition / User / Field / Option).

import {
  ATTACHMENT_FIELD_NAMES,
  FIELD_DESCRIPTOR,
  OPTION_DESCRIPTOR,
  PARTITION_DESCRIPTOR,
  USER_DESCRIPTOR,
  CANDIDATE_DESCRIPTOR,
  CLIENT_DESCRIPTOR,
  JOB_DESCRIPTOR,
  PROCESS_DESCRIPTOR,
  CONTACT_DESCRIPTOR,
  ACTIVITY_DESCRIPTOR,
  OPPORTUNITY_DESCRIPTOR,
  RECRUITER_DESCRIPTOR,
  RESUME_DESCRIPTOR,
} from "../../src/resources/index";
import type { ResourceDescriptor } from "../../src/resources/resource";
import type { DataType } from "../../src/xml/decode";
import {
  readField,
  readOption,
  readPartition,
  readUser,
  type MasterReadHandler,
} from "./master-read";

/** What the fake needs to serve one resource. */
export type FakeResource = {
  descriptor: ResourceDescriptor;
  /** Primary-key alias — `P_Id` for every data resource, `Id` for the bespoke Attachment. */
  idAlias: string;
  /** Skip the ~15000-char request cap: file uploads have their own 10MB limit (ADR-0018). */
  unboundedWrite?: boolean;
  /**
   * Master resources are read-only and answer their own query vocabulary (ADR-0021/0022), so the
   * generic Read/Write path does not apply: this handler serves them instead.
   */
  master?: MasterReadHandler;
  /** Partition Read discovers partitions, so it is the one route that sends no `partition`. */
  partitionless?: boolean;
};

// Attachment's Data Types, for read encoding only. The library decodes Attachment by hand
// (`decodeAttachment`), so there is no catalog to borrow; the *names* still come from the library.
const ATTACHMENT_TYPES: Record<string, DataType> = {
  Id: "System[Id]",
  Resource: "Number",
  ResourceId: "Number",
  ContentType: "SinglelineText",
  FileName: "SinglelineText",
  Content: "MultilineText",
};

/** Attachment's descriptor: no alias prefix (`<FileName>`, not `<Attachment.FileName>`). */
export const ATTACHMENT_DESCRIPTOR: ResourceDescriptor = {
  name: "Attachment",
  path: "attachment",
  prefix: "",
  fields: Object.fromEntries(
    ATTACHMENT_FIELD_NAMES.map((name) => [name, ATTACHMENT_TYPES[name]]),
  ),
};

const dataResource = (
  descriptor: ResourceDescriptor,
): [string, FakeResource] => [descriptor.path, { descriptor, idAlias: "P_Id" }];

const masterResource = (
  descriptor: ResourceDescriptor,
  master: MasterReadHandler,
  partitionless = false,
): [string, FakeResource] => [
  descriptor.path,
  { descriptor, idAlias: "P_Id", master, partitionless },
];

export const FAKE_RESOURCES: ReadonlyMap<string, FakeResource> = new Map([
  dataResource(CANDIDATE_DESCRIPTOR),
  dataResource(JOB_DESCRIPTOR),
  dataResource(CLIENT_DESCRIPTOR),
  dataResource(RECRUITER_DESCRIPTOR),
  dataResource(CONTACT_DESCRIPTOR),
  dataResource(OPPORTUNITY_DESCRIPTOR),
  dataResource(ACTIVITY_DESCRIPTOR),
  dataResource(PROCESS_DESCRIPTOR),
  dataResource(RESUME_DESCRIPTOR),
  [
    ATTACHMENT_DESCRIPTOR.path,
    {
      descriptor: ATTACHMENT_DESCRIPTOR,
      idAlias: "Id",
      unboundedWrite: true,
    },
  ],
  // Master reads (ADR-0021/0022): read-only, bespoke queries, no `condition` / `get(id)`.
  masterResource(PARTITION_DESCRIPTOR, readPartition, true),
  masterResource(USER_DESCRIPTOR, readUser),
  masterResource(FIELD_DESCRIPTOR, readField),
  masterResource(OPTION_DESCRIPTOR, readOption),
]);

/** The data resources only — what Field Read introspects. */
export const FAKE_DATA_DESCRIPTORS: ReadonlyMap<string, ResourceDescriptor> =
  new Map(
    [...FAKE_RESOURCES.values()]
      .filter((r) => r.master === undefined)
      .map((r) => [r.descriptor.path, r.descriptor]),
  );
