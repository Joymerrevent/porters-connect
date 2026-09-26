import { describe, expect, it } from "vitest";

import { parseXml, toCode, toInt } from "./parse-xml";

import {
  PortersAuthError,
  PortersError,
  PortersResourceError,
} from "../errors/index";
import { parseAuthentication } from "./parse-authentication";
import { parseResourcePage } from "./parse-resource-page";
import { parseWriteResult } from "./parse-write-result";

// RV-54。fast-xml-parser は `prototype` / `constructor` / `__proto__` をタグ名として拒否する
// （プロトタイプ汚染対策）。これらは**妥当な XML Name** なので ADR-0085 の検証を通り、
// 書き込みは成功する。つまり「書けるのに読めない」が成立し、しかもその例外が
// PortersError の外に出ていた＝ガイドが案内する分岐に引っかからなかった。
describe("パーサが拒否するタグ名（RV-54）", () => {
  const RESERVED = ["prototype", "constructor", "__proto__"];

  // 拒否されるのは**入れ子の裸のタグ名**。接頭辞が付くと `.` を含むので予約名と一致しない。
  const readBody = (alias: string): string =>
    `<Candidate Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
    `<Person.P_Phase><OptionRoot><${alias}/></OptionRoot></Person.P_Phase>` +
    `</Item></Candidate>`;

  it.each(RESERVED)(
    "Read: %s を PortersResourceError(unknown) に包む",
    (alias) => {
      try {
        parseResourcePage(readBody(alias), "Candidate");
        expect.unreachable("should have thrown");
      } catch (e) {
        // 要点は「系統の外に出ない」こと（ADR-0006）。利用者は PortersError で分岐する。
        expect(e).toBeInstanceOf(PortersError);
        expect(e).toBeInstanceOf(PortersResourceError);
        const err = e as PortersResourceError;
        expect(err.category).toBe("unknown");
        expect(err.message).toBe("unparseable resource response");
        // パーサ自身の説明は cause に残す（消すと原因に辿り着けない）。
        expect((err.cause as Error).message).toContain(alias);
      }
    },
  );

  it("Write も同じ扱い", () => {
    try {
      parseWriteResult(
        "<Candidate><Result><Item><prototype/><Code>0</Code><Id>1</Id></Item></Result></Candidate>",
        "Candidate",
      );
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PortersResourceError);
      expect((e as PortersResourceError).message).toBe(
        "unparseable write response",
      );
      expect((e as PortersResourceError).cause).toBeDefined();
    }
  });

  it("認証は PortersAuthError に包む（系統が違う）", () => {
    try {
      parseAuthentication(
        "<Authentication><prototype/><Error>0</Error></Authentication>",
      );
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PortersAuthError);
      expect((e as PortersAuthError).message).toBe(
        "unparseable authentication response",
      );
      expect((e as PortersAuthError).cause).toBeDefined();
    }
  });

  it("接頭辞が付けば読める（締めすぎていない確認）", () => {
    // `Person.prototype` は `.` を含むので予約名と一致しない。ここが落ちると、
    // 予約語を含む**ふつうの項目名**が読めなくなる。
    const page = parseResourcePage(
      '<Candidate Total="1" Count="1" Start="0"><Code>0</Code>' +
        "<Item><Person.prototype>x</Person.prototype></Item></Candidate>",
      "Candidate",
    );
    expect(page.items[0]).toEqual({ "Person.prototype": "x" });
  });

  it("予約名でない似た名前は従来どおり読める", () => {
    const page = parseResourcePage(readBody("toString"), "Candidate");
    expect(page.items).toHaveLength(1);
  });

  it("壊れた XML も同じ経路で包まれる（cause 付き）", () => {
    // 拒否されるタグ名と、単に壊れた XML は、利用者から見れば同じ「読めない」。
    try {
      parseResourcePage("<Candidate><Item>", "Candidate");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PortersResourceError);
      expect((e as PortersResourceError).category).toBe("unknown");
    }
  });
});

describe("parseXml / toInt", () => {
  it("parses into raw strings (no type coercion) and keeps a single <Item> as an array", () => {
    const doc = parseXml("<R><Item><A>007</A></Item></R>", () => {
      throw new Error("unreachable");
    }) as { R: { Item: { A: string }[] } };
    expect(doc.R.Item).toEqual([{ A: "007" }]);
  });

  it("routes a parser failure through the caller's own error, keeping the original as the cause", () => {
    const made: unknown[] = [];
    const sentinel = new Error("mine");
    expect(() =>
      parseXml("<R><Item><__proto__/></Item></R>", (cause) => {
        made.push(cause);
        return sentinel as never;
      }),
    ).toThrow(sentinel);
    expect(made[0]).toBeInstanceOf(Error);
  });

  it("toInt: a string node as a number, a missing node as 0", () => {
    expect(toInt("12")).toBe(12);
    expect(toInt(undefined)).toBe(0);
    expect(toInt({ nested: true })).toBe(0);
  });
});

// RV-70。Result の Code / Error は、無い・空なら 0、数字ならその数。それ以外は PORTERS の応答ではない。
describe("toCode", () => {
  const unparseable = (): PortersResourceError =>
    new PortersResourceError("unparseable", { category: "unknown" });

  it.each([
    [undefined, 0],
    ["", 0],
    ["0", 0],
    ["103", 103],
    [" 9 ", 9],
  ])("reads %j as %i", (v, code) => {
    expect(toCode(v, unparseable)).toBe(code);
  });

  it.each([
    ["103x"],
    ["x103"],
    ["-1"],
    ["1.5"],
    ["abc"],
    [{ "#text": "103", "@_type": "e" }],
    [{ Value: "103" }],
    [["0", "103"]],
  ])("refuses %j", (v) => {
    expect(() => toCode(v, unparseable)).toThrow("unparseable");
  });
});
