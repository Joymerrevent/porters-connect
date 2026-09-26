// Reading the id out of a single-Item Write response.

import { PortersResourceError, resourceError } from "../errors";
import { parseWriteResult } from "../xml/parse-write-result";

/**
 * A single-Item Write response -> the assigned/updated id. A non-zero per-item Code is a
 * resource error (mapped, not swallowed); a missing result Item is unparseable. Shared by
 * the data resources' Write (data-writer.ts) and the bespoke Attachment accessor. `path` names the error code
 * message, `name` the error context resource.
 */
export const firstWriteResultId = (
  body: string,
  path: string,
  name: string,
): number => {
  const items = parseWriteResult(body, name);
  // 1 件だけ書いたので、結果もちょうど 1 件のはず。0 件も 2 件以上も、どれが自分の結果か分からない（RV-70）。
  if (items.length !== 1) {
    throw new PortersResourceError(
      `write returned ${items.length} result items for one record`,
      { category: "unknown", context: { resource: name } },
    );
  }
  const first = items[0];
  if (first.code !== 0) {
    throw resourceError(
      first.code,
      `${path} write returned code ${first.code}`,
      {
        resource: name,
      },
    );
  }
  return first.id;
};
