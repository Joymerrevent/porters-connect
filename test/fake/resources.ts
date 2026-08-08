// Which resources the fake answers. Each entry is the resource module's *own* descriptor, so the
// fake and the library read the same Data-Type catalog (ADR-0043 D-fixture共有: no second copy to
// drift). Phase 2 adds Job / Client / Process / Resume / Attachment, phase 3 the master reads.

import { CANDIDATE_DESCRIPTOR } from "../../src/resources/candidate";
import type { ResourceDescriptor } from "../../src/resources/resource";

export const FAKE_RESOURCES: ReadonlyMap<string, ResourceDescriptor> = new Map([
  [CANDIDATE_DESCRIPTOR.path, CANDIDATE_DESCRIPTOR],
]);
