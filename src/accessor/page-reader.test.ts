import { describe, expect, it } from "vitest";

import type { Requester } from "../http/requester";
import { createPageReader } from "./page-reader";
import { createDecoder } from "./decoder";
import type { FieldCatalog } from "./catalog";

const FIELDS = {
  P_Id: "System[Id]",
  P_Name: "SinglelineText",
  // カタログにあるが PORTERS が Data Type を与えていない項目（ADR-0056）。
  P_Deleted: null,
} as const satisfies FieldCatalog;

describe("accessor/read — createPageReader（1 ページ読む）", () => {
  it("sends the parameters plus paging to the resource's path and decodes with the given decoder", async () => {
    const urls: string[] = [];
    const requester: Requester = {
      request: (req, parse) => {
        urls.push(req.url);
        return Promise.resolve(
          parse(
            `<Thing Total="3" Count="1" Start="2"><Code>0</Code><Item><T.P_Id>7</T.P_Id></Item></Thing>`,
          ),
        );
      },
    };
    const read = createPageReader({
      requester,
      accessPoint: { hostname: "h.test" },
      name: "Thing",
      path: "thing",
    });
    const page = await read(
      new URLSearchParams({ partition: "12" }),
      createDecoder(FIELDS),
      1,
      2,
    );
    expect(urls).toEqual([
      "https://h.test/v1/thing?partition=12&count=1&start=2",
    ]);
    expect(page).toEqual({
      items: [{ P_Id: 7 }],
      total: 3,
      count: 1,
      start: 2,
    });
  });
});
