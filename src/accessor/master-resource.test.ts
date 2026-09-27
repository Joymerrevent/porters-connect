import { describe, expect, it } from "vitest";

import type { Requester } from "../http/requester";
import type { TransportRequest } from "../http/types";
import { createMasterResource } from "./master-resource";
import type { FieldCatalog } from "./catalog";

// 読み込み（master-reader.ts）の中身は master-reader.test.ts で確かめる。ここでは、アクセサが読み込みを
// そのまま出していること（同じ設定と接続で送ること）を確かめる。
const FIELDS = {
  P_Id: "System[Id]",
  P_Name: "SinglelineText",
} as const satisfies FieldCatalog;

const PAGE = `<Thing Total="1" Count="1" Start="0"><Code>0</Code><Item><T.P_Id>7</T.P_Id></Item></Thing>`;

const setup = () => {
  const urls: string[] = [];
  const requester: Requester = {
    request: (req: TransportRequest, parse) => {
      urls.push(req.url);
      return Promise.resolve(parse(PAGE));
    },
  };
  const methods = createMasterResource(
    {
      name: "Thing",
      path: "thing",
      prefix: "T",
      fields: FIELDS,
      params: (q: { tag?: string }) =>
        new URLSearchParams({ tag: q.tag ?? "-" }),
    },
    { requester, accessPoint: { hostname: "h.test" } },
  );
  return { methods, urls };
};

describe("createMasterResource — 読み込みをアクセサにする", () => {
  it("search と searchAll だけを持つ（マスタには書き込みが無い）", () => {
    expect(Object.keys(setup().methods).sort()).toEqual([
      "search",
      "searchAll",
    ]);
  });

  it("同じ設定と接続で、search も searchAll も同じリソースに送る", async () => {
    const { methods, urls } = setup();
    const page = await methods.search({ tag: "a" });
    for await (const _ of methods.searchAll({ tag: "b" }));
    expect(page.items[0]?.P_Id).toBe(7);
    expect(urls[0]).toContain("https://h.test/v1/thing?tag=a");
    expect(urls[1]).toContain("https://h.test/v1/thing?tag=b");
  });
});
