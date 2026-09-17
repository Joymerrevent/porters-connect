// Attachment Read の語彙（ADR-0081）。ライブラリは必ず `requestType` / `resource` を送るので、
// ここで守るのは「送らなくなったら気づける」側 — フェイクが黙って全件返すと、実装の後退が
// 緑のまま通ってしまう。

import { describe, expect, it } from "vitest";

import { parseAttachmentReadQuery } from "./attachment-read";

const urlOf = (query: string): URL =>
  new URL(`https://fake.test/v1/attachment?${query}`);

const parse = (query: string) => parseAttachmentReadQuery(urlOf(query));

const aliases = (query: string): string[] => {
  const parsed = parse(query);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.query.selection.map((s) => s.alias);
};

describe("parseAttachmentReadQuery", () => {
  it("requestType=1 は本体を除いたメタデータだけを選ぶ", () => {
    expect(aliases("requestType=1&resource=17")).toEqual([
      "Id",
      "Resource",
      "ResourceId",
      "ContentType",
      "FileName",
    ]);
  });

  it("requestType=0 は本体まで選ぶ", () => {
    expect(aliases("requestType=0&resource=17")).toContain("Content");
  });

  it("resource / resourceId / id をそれぞれ等値条件に訳す", () => {
    const parsed = parse("requestType=0&resource=17&resourceId=10001&id=900");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.query.conditions).toEqual([
      { alias: "Resource", op: "eq", value: "17" },
      { alias: "ResourceId", op: "eq", value: "10001" },
      { alias: "Id", op: "eq", value: "900" },
    ]);
  });

  it("絞り込みのパラメータが無ければ条件も増やさない", () => {
    const parsed = parse("requestType=1&resource=17");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.query.conditions).toHaveLength(1); // resource だけ
  });

  it("partition / count / start を読む（count は 200 が上限）", () => {
    const parsed = parse(
      "partition=12&requestType=1&resource=17&count=999&start=40",
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.query.partition).toBe("12");
    expect(parsed.query.count).toBe(200);
    expect(parsed.query.start).toBe(40);
  });

  it("count / start が無ければ既定（200 / 0）", () => {
    const parsed = parse("requestType=1&resource=17");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.query.count).toBe(200);
    expect(parsed.query.start).toBe(0);
  });

  it("数値でない count / start は既定に倒す", () => {
    const parsed = parse("requestType=1&resource=17&count=abc&start=xyz");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.query.count).toBe(200);
    expect(parsed.query.start).toBe(0);
  });

  it.each([
    ["requestType", "resource=17"],
    ["resource", "requestType=1"],
  ])("必須の %s が無ければ Result Code 100", (name, query) => {
    const parsed = parse(query);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.code).toBe(100);
    expect(parsed.message).toContain(name);
  });

  it("requestType が 0 / 1 以外なら Result Code 100", () => {
    const parsed = parse("requestType=2&resource=17");
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.code).toBe(100);
    expect(parsed.message).toContain("2");
  });
});
