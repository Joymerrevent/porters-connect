// The whole Read query -> the parameters every page of that query shares: `partition`, `field`
// (via `fieldParam`) and the typed query (via `appendReadQuery`).

import type { AccessPoint } from "../http/access-point";
import type { ReferenceMap } from "./expand";
import { fieldParam, type FieldParamContext } from "./field-param";
import { pageUrl } from "./page-url";
import type { FieldCatalog } from "./catalog";
import type { Paging } from "./paging";
import type { SearchQuery } from "./query";

// The keyword cap and the fields a deleted read may condition on are PORTERS values (porters/read-rules.ts).
import { appendReadQuery } from "./append-read-query";

/**
 * What a data resource's Read needs to turn a query into parameters: the `field` assembly's
 * context ({@link FieldParamContext}) plus any parameter the resource always sends.
 */
export type ReadParamsContext = FieldParamContext & {
  /**
   * Fixed query parameters this resource always sends. **Phase requires `resource=`** — the
   * upper resource whose history is being read — and it is a parameter of its own, not a
   * `condition` (ADR-0061 / Phase Read). Set once by the accessor, never by the caller.
   */
  params?: Readonly<Record<string, string>>;
};

/**
 * Serialise the Read query — `partition` / `field` / `condition` / `order` / `keywords` /
 * `itemstate` — into the parameters every page of that query shares. **Paging is deliberately not
 * here**: `count` / `start` are the only parts that differ page to page, so `pageUrl` adds them
 * to a copy and `searchAll` can serialise the caller's query exactly once (RV-32).
 * `field` (with `expand` / `image` folded in) is {@link fieldParam}; the rest is
 * {@link appendReadQuery}. Attachment is bespoke (no prefix / no catalog) and builds its own loose
 * URL — see attachment.ts.
 */
export const buildReadParams = <F extends FieldCatalog, R extends ReferenceMap>(
  partition: number,
  q: SearchQuery<F, R>,
  ctx: ReadParamsContext,
): URLSearchParams => {
  const p = new URLSearchParams();
  p.set("partition", String(partition));
  for (const [key, value] of Object.entries(ctx.params ?? {}))
    p.set(key, value);
  const field = fieldParam(ctx, q);
  if (field !== undefined) p.set("field", field);
  appendReadQuery(p, q, ctx);
  return p;
};

/**
 * Build a Read URL: `/v1/{path}?partition=…&field=…&condition=…&order=…&keywords=…&itemstate=…&count=…&start=…`
 * at the configured access point (ADR-0047) — the single-page form of {@link buildReadParams}.
 */
export const buildReadUrl = <F extends FieldCatalog, R extends ReferenceMap>(
  accessPoint: AccessPoint,
  partition: number,
  path: string,
  q: SearchQuery<F, R> & Paging,
  ctx: ReadParamsContext,
): string =>
  pageUrl(
    accessPoint,
    path,
    buildReadParams(partition, q, ctx),
    q.count,
    q.start,
  );
