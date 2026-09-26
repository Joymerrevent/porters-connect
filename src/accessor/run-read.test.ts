import { describe, expect, it } from "vitest";

import type { Requester } from "../http/requester";
import { runRead } from "./run-read";

const PAGE = `<Widget Total="2" Count="1" Start="0"><Code>0</Code><Item><W.P_Id>7</W.P_Id></Item></Widget>`;

describe("runRead", () => {
  it("GETs the URL, reads the envelope and decodes each item", async () => {
    const seen: string[] = [];
    const requester: Requester = {
      request: (req, parse) => {
        seen.push(`${req.method} ${req.url}`);
        return Promise.resolve(parse(PAGE));
      },
    };
    const page = await runRead(
      requester,
      "Widget",
      "https://h.test/v1/widget",
      (item) => Object.keys(item).join(","),
    );
    expect(seen).toEqual(["GET https://h.test/v1/widget"]);
    expect(page).toEqual({ items: ["W.P_Id"], total: 2, count: 1, start: 0 });
  });
});
