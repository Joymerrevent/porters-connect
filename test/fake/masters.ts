// The small masters a Read response has to expand: User (a `User`-typed field reads back nested)
// and Option (selected aliases read back with an id + display name). PORTERS resolves these from
// the tenant's own masters; the fake keeps just enough to make the round-trip lossless.
//
// Auto-registering on purpose: an id or alias a test never declared still reads back with a stable
// entry, so writing a value and reading it again never silently drops it (fail-safe). Declaring
// users up front (`users` option) is only needed when a test asserts on names/mails.

import type { FakeUser } from "./types";

/** A fully populated User master entry (every readable sub-field present). */
export type FakeUserEntry = {
  P_Id: string;
  P_Type: string;
  P_Name: string;
  P_Mail: string;
};

/** One choice of the Option master. */
export type FakeOptionEntry = { id: string; name: string };

export type FakeMasters = {
  user(id: string): FakeUserEntry;
  option(alias: string): FakeOptionEntry;
  /** Every known user, declared or auto-registered — what `/v1/user` reads. */
  userList(): FakeUserEntry[];
  /** Every option alias seen so far — the fallback content of `/v1/option`. */
  optionAliases(): string[];
  /** Forget everything auto-registered, keeping the declared users. */
  reset(): void;
};

export const createFakeMasters = (opts: {
  users?: FakeUser[];
}): FakeMasters => {
  const users = new Map<string, FakeUserEntry>();
  const options = new Map<string, FakeOptionEntry>();

  const register = (u: FakeUser): FakeUserEntry => {
    const id = String(u.P_Id);
    const entry: FakeUserEntry = {
      P_Id: id,
      P_Type: u.P_Type ?? "0",
      P_Name: u.P_Name ?? `User ${id}`,
      P_Mail: u.P_Mail ?? `user${id}@example.invalid`,
    };
    users.set(id, entry);
    return entry;
  };

  const seed = (): void => {
    users.clear();
    for (const u of opts.users ?? []) register(u);
  };
  seed();

  return {
    user: (id) => users.get(id) ?? register({ P_Id: Number(id) }),
    option: (alias) => {
      const known = options.get(alias);
      if (known) return known;
      const entry: FakeOptionEntry = {
        id: String(options.size + 1),
        // Display name = the alias' last segment (`Option.P_Tokyo` -> `P_Tokyo`). The fake has no
        // label master, and only the alias round-trips through the library (ADR-0017).
        name: alias.slice(alias.lastIndexOf(".") + 1),
      };
      options.set(alias, entry);
      return entry;
    },
    userList: () => [...users.values()],
    optionAliases: () => [...options.keys()],
    reset: () => {
      options.clear();
      seed();
    },
  };
};
