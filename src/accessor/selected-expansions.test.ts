import { describe, expect, it } from "vitest";

import type { ReferenceTarget } from "./expand";
import { selectedExpansions } from "./selected-expansions";

const CLIENT: ReferenceTarget = {
  name: "Client",
  path: "client",
  prefix: "Client",
  fields: { P_Id: "System[Id]", P_Name: "SinglelineText" },
};

describe("selectedExpansions", () => {
  it("keeps a known reference with something selected, in the order written", () => {
    expect(
      selectedExpansions({ P_Client: ["P_Name"] }, { P_Client: CLIENT }),
    ).toEqual([["P_Client", CLIENT, ["P_Name"]]]);
  });

  it("drops an unknown reference, an empty selection and an undefined one", () => {
    expect(
      selectedExpansions(
        { P_Other: ["P_Id"], P_Client: [], P_Client2: undefined },
        { P_Client: CLIENT, P_Client2: CLIENT },
      ),
    ).toEqual([]);
    expect(selectedExpansions(undefined, { P_Client: CLIENT })).toEqual([]);
  });
});
