// Allowing http must never be the same act as silencing the warning about it (ADR-0047).
// These cases hold that line: the warning fires for every http access point (loopback included),
// once per warner, and only the dedicated env var — set to something affirmative — stops it.

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createInsecureSchemeWarner,
  resetInsecureSchemeWarning,
  warnIfInsecureScheme,
  SUPPRESS_INSECURE_HTTP_WARNING_ENV,
} from "./insecure-http-warning";

const spyWarn = () =>
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("createInsecureSchemeWarner (ADR-0047)", () => {
  it("warns for http, naming the host, the risk and the way to silence it", () => {
    const warn = spyWarn();

    createInsecureSchemeWarner().warn("http", "localhost:4010");

    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain("localhost:4010");
    expect(message).toContain("cleartext");
    expect(message).toContain(SUPPRESS_INSECURE_HTTP_WARNING_ENV);
  });

  it("warns once per warner, not once per call", () => {
    const warn = spyWarn();
    const warner = createInsecureSchemeWarner();

    warner.warn("http", "localhost:4010");
    warner.warn("http", "other.internal");

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("stays silent for https and for the default (no scheme)", () => {
    const warn = spyWarn();
    const warner = createInsecureSchemeWarner();

    warner.warn("https", "example.test");
    warner.warn(undefined, "example.test");

    expect(warn).not.toHaveBeenCalled();
  });

  it("is silenced only by the dedicated env var", () => {
    const warn = spyWarn();
    const warner = createInsecureSchemeWarner();

    vi.stubEnv(SUPPRESS_INSECURE_HTTP_WARNING_ENV, "1");
    warner.warn("http", "localhost:4010");
    expect(warn).not.toHaveBeenCalled();

    // Silencing does not consume the latch: drop the env var and the next client still gets told
    // (fail-safe — a suppressed warning is not a delivered one).
    vi.stubEnv(SUPPRESS_INSECURE_HTTP_WARNING_ENV, undefined);
    warner.warn("http", "localhost:4010");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each(["", " ", "0", "false", "FALSE"])(
    "keeps warning when the env var says %o (only an affirmative silences)",
    (value) => {
      const warn = spyWarn();

      vi.stubEnv(SUPPRESS_INSECURE_HTTP_WARNING_ENV, value);
      createInsecureSchemeWarner().warn("http", "localhost:4010");

      expect(warn).toHaveBeenCalledTimes(1);
    },
  );
});

describe("the process-wide warner", () => {
  it("latches across clients, and the test seam clears it", () => {
    const warn = spyWarn();
    resetInsecureSchemeWarning();

    warnIfInsecureScheme("http", "localhost:4010");
    warnIfInsecureScheme("http", "localhost:4010");
    expect(warn).toHaveBeenCalledTimes(1);

    resetInsecureSchemeWarning();
    warnIfInsecureScheme("http", "localhost:4010");
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
