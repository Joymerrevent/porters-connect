import { describe, expect, it } from "vitest";

import { PortersAuthError } from "../errors/index";
import type { Transport, TransportRequest } from "../http/index";
import { createDefaultTokenProvider } from "./token-provider";

const CODE_DIRECT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Authentication><Code>CODE123</Code><Error>0</Error><Message>Success</Message></Authentication>`;

const tokenXml = (access: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<Authentication><AccessToken>${access}</AccessToken><AccessTokenExpiresIn>1800000</AccessTokenExpiresIn><RefreshToken>REF1</RefreshToken><RefreshTokenExpiresIn>7200000</RefreshTokenExpiresIn><Error>0</Error><Message>Success</Message></Authentication>`;

type MockTransport = { transport: Transport; calls: TransportRequest[] };

const makeTransport = (): MockTransport => {
  const calls: TransportRequest[] = [];
  const transport: Transport = {
    send: (req) => {
      calls.push(req);
      if (req.url.includes("/v1/oauth")) {
        return Promise.resolve({ status: 200, body: CODE_DIRECT_XML });
      }
      const refreshing =
        req.body?.includes("grant_type=refresh_token") ?? false;
      return Promise.resolve({
        status: 200,
        body: tokenXml(refreshing ? "ACCESS2" : "ACCESS1"),
      });
    },
  };
  return { transport, calls };
};

const opts = (transport: Transport, now: () => number) => ({
  host: "example.test",
  appId: "app",
  appSecret: "secret",
  transport,
  now,
});

describe("createDefaultTokenProvider (ADR-0007 / ADR-0012)", () => {
  it("acquires via code_direct -> token on first call", async () => {
    const { transport, calls } = makeTransport();
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    expect(await auth.getAccessToken()).toBe("ACCESS1");
    expect(calls.map((c) => c.url)).toEqual([
      "https://example.test/v1/oauth?app_id=app&response_type=code_direct",
      "https://example.test/v1/token",
    ]);
  });

  it("caches: a second call makes no new requests", async () => {
    const { transport, calls } = makeTransport();
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    await auth.getAccessToken();
    await auth.getAccessToken();
    expect(calls).toHaveLength(2); // only the initial acquire (oauth + token)
  });

  it("single-flights concurrent first calls", async () => {
    const { transport, calls } = makeTransport();
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    const [a, b] = await Promise.all([
      auth.getAccessToken(),
      auth.getAccessToken(),
    ]);
    expect([a, b]).toEqual(["ACCESS1", "ACCESS1"]);
    expect(calls.filter((c) => c.url.includes("/v1/oauth"))).toHaveLength(1);
  });

  it("forceRefresh uses the refresh_token grant", async () => {
    const { transport, calls } = makeTransport();
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    await auth.getAccessToken();
    expect(await auth.getAccessToken({ forceRefresh: true })).toBe("ACCESS2");
    const grants = calls
      .filter((c) => c.url.includes("/v1/token"))
      .map((c) => c.body ?? "");
    expect(grants[0]).toContain("grant_type=oauth_code");
    expect(grants[1]).toContain("grant_type=refresh_token");
  });

  it("proactively refreshes when within the expiry margin", async () => {
    const { transport, calls } = makeTransport();
    let t = 1000;
    const auth = createDefaultTokenProvider({
      host: "example.test",
      appId: "app",
      appSecret: "secret",
      transport,
      now: () => t,
    });
    await auth.getAccessToken(); // access valid until 1000 + 1_800_000
    t = 1000 + 1_800_000 - 30_000; // within the 60s margin
    expect(await auth.getAccessToken()).toBe("ACCESS2");
    expect(calls.filter((c) => c.url.includes("/v1/token"))).toHaveLength(2);
  });

  it("throws PortersAuthError when code_direct returns no code", async () => {
    const transport: Transport = {
      send: () =>
        Promise.resolve({
          status: 200,
          body: "<Authentication><Error>0</Error></Authentication>",
        }),
    };
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(
      PortersAuthError,
    );
  });

  it("throws PortersAuthError when the token response lacks tokens", async () => {
    const transport: Transport = {
      send: (req) =>
        Promise.resolve({
          status: 200,
          body: req.url.includes("/v1/oauth")
            ? CODE_DIRECT_XML
            : "<Authentication><Error>0</Error></Authentication>",
        }),
    };
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(
      PortersAuthError,
    );
  });

  it("uses the default clock when `now` is not provided", async () => {
    const { transport } = makeTransport();
    const auth = createDefaultTokenProvider({
      host: "example.test",
      appId: "app",
      appSecret: "secret",
      transport,
    });
    expect(await auth.getAccessToken()).toBe("ACCESS1");
  });

  it("treats a missing ExpiresIn as 0", async () => {
    const transport: Transport = {
      send: (req) =>
        Promise.resolve({
          status: 200,
          body: req.url.includes("/v1/oauth")
            ? CODE_DIRECT_XML
            : "<Authentication><AccessToken>A</AccessToken><RefreshToken>R</RefreshToken><Error>0</Error></Authentication>",
        }),
    };
    const auth = createDefaultTokenProvider(opts(transport, () => 1000));
    expect(await auth.getAccessToken()).toBe("A");
  });
});
