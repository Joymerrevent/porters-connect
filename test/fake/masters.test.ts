import { describe, expect, it } from "vitest";

import { createFakeMasters } from "./masters";

describe("fake masters", () => {
  it("returns a declared user verbatim", () => {
    const masters = createFakeMasters({
      users: [{ P_Id: 5, P_Name: "採用 花子", P_Mail: "hanako@example.com" }],
    });

    expect(masters.user("5")).toEqual({
      P_Id: "5",
      P_Type: "0",
      P_Name: "採用 花子",
      P_Mail: "hanako@example.com",
    });
  });

  it("auto-registers an unknown user so a write never reads back empty", () => {
    const masters = createFakeMasters({});

    const first = masters.user("42");
    expect(first.P_Id).toBe("42");
    expect(first.P_Name).toBe("User 42");
    // Stable across calls — a test can assert on it.
    expect(masters.user("42")).toEqual(first);
  });

  it("gives each option alias a stable id and a name from its last segment", () => {
    const masters = createFakeMasters({});

    expect(masters.option("Option.P_Applied")).toEqual({
      id: "1",
      name: "P_Applied",
    });
    expect(masters.option("Option.P_Screening").id).toBe("2");
    expect(masters.option("Option.P_Applied").id).toBe("1");
  });

  it("reset() forgets the auto-registered entries but keeps declared users", () => {
    const masters = createFakeMasters({ users: [{ P_Id: 5, P_Name: "花子" }] });
    masters.option("Option.P_Applied");

    masters.reset();

    expect(masters.user("5").P_Name).toBe("花子");
    expect(masters.option("Option.P_Screening").id).toBe("1");
  });
});
