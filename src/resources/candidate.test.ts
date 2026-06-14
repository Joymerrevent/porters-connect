import { describe, expect, it } from "vitest";

import type { Requester } from "../http/requester";
import type { TransportRequest } from "../http/types";
import { createCandidateResource } from "./candidate";

const OK_PAGE = `<?xml version="1.0"?><Candidate Total="1" Count="1" Start="0"><Code>0</Code><Item><Person.P_Id>7</Person.P_Id><Person.U_score>42</Person.U_score></Item></Candidate>`;

const stubRequester = (
  body: string,
  captured: TransportRequest[],
): Requester => ({
  request: (req, parse) => {
    captured.push(req);
    return Promise.resolve(parse(body));
  },
});

const resource = (sent: TransportRequest[], body = OK_PAGE) =>
  createCandidateResource({
    requester: stubRequester(body, sent),
    host: "h.test",
    partition: 12,
  });

describe("createCandidateResource", () => {
  it("builds the read URL with partition / field / count / start", async () => {
    const sent: TransportRequest[] = [];
    await resource(sent).search({
      field: ["P_Id", "P_Name"],
      count: 50,
      start: 100,
    });
    const url = sent[0]?.url ?? "";
    expect(url).toContain("https://h.test/v1/candidate?");
    expect(url).toContain("partition=12");
    expect(url).toContain("field=P_Id%2CP_Name");
    expect(url).toContain("count=50");
    expect(url).toContain("start=100");
  });

  it("decodes known P_ fields and passes unknown aliases through (not dropped)", async () => {
    const sent: TransportRequest[] = [];
    const page = await resource(sent).search();
    expect(page.items[0]?.P_Id).toBe(7); // Id -> number
    expect(page.items[0]?.U_score).toBe("42"); // unknown alias -> raw string
  });

  it("get(id) sends a Person.P_Id condition", async () => {
    const sent: TransportRequest[] = [];
    await resource(sent).get(7);
    expect(decodeURIComponent(sent[0]?.url ?? "")).toContain(
      "Person.P_Id:eq=7",
    );
  });
});
