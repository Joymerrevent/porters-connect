import { describe, expect, it } from "vitest";

import { PortersConfigError, PortersResourceError } from "../../errors";
import type { Requester, RequestSpec } from "../../http/requester";
import type { TransportRequest } from "../../http/types";
import { createDataWriter } from "./data-write";
import type { FieldCatalog } from "./read";

// A synthetic resource exercises the factory in isolation (the concrete catalogs
// live in candidate/job tests). One field per Data Type is enough — per-type
// decoding is covered by decode.test.ts; here we test the wiring. No required-on-create
// fields, so Write input is all-optional.
const FIELDS = {
  P_Id: "System[Id]",
  P_Owner: "User",
  P_When: "DateTime",
  P_Phase: "Option",
  P_Name: "SinglelineText",
  // PORTERS が Data Type を与えていない項目（ADR-0056）。Read の field には出るが
  // condition / order / Write には出ない — 導出型がそれを自動で満たす。
  P_Deleted: null,
} as const satisfies FieldCatalog;

const CONFIG = {
  name: "Widget",
  path: "widget",
  prefix: "W",
  fields: FIELDS,
  requiredOnCreate: [],
} as const;

// A prefixed key (`W.P_Id`) exercises bareAlias; an unknown alias passes through.
const OK = `<?xml version="1.0"?><Widget Total="1" Count="1" Start="0"><Code>0</Code><Item><W.P_Id>7</W.P_Id><W.U_x>raw</W.U_x></Item></Widget>`;

const WRITE_OK = (id = 100) =>
  `<Widget><Item><Id>${id}</Id><Code>0</Code></Item></Widget>`;

type Call = { req: TransportRequest; spec?: RequestSpec };

const stub = (bodies: string[], calls: Call[]): Requester => ({
  request: (req, parse, spec) => {
    calls.push({ req, spec });
    return Promise.resolve(parse(bodies.shift() ?? ""));
  },
});

const res = (calls: Call[], ...bodies: string[]) =>
  createDataWriter(CONFIG, {
    requester: stub(bodies.length > 0 ? bodies : [OK], calls),
    accessPoint: { hostname: "h.test" },
    partition: 12,
  });

// A resource carrying a tenant Image field (declared with `defineFields` in real use — no standard
// field is Image-typed). `U_photo` is catalogued here so the factory sees its Data Type, which is
// what the `image` option keys off.
const ALBUM_CONFIG = {
  name: "Album",
  path: "album",
  prefix: "Al",
  fields: {
    P_Id: "System[Id]",
    P_Name: "SinglelineText",
    U_photo: "Image",
    U_link: "Link",
  },
  requiredOnCreate: [],
} as const;

const ALBUM_PAGE =
  `<Album Total="1" Count="1" Start="0"><Code>0</Code><Item>` +
  `<Al.P_Id>1</Al.P_Id>` +
  `<Al.U_photo><FileName>a.png</FileName><Content>QUJD</Content></Al.U_photo>` +
  `<Al.U_link>10001</Al.U_link>` +
  `</Item></Album>`;

const album = (calls: Call[], ...bodies: string[]) =>
  createDataWriter(ALBUM_CONFIG, {
    requester: stub(bodies.length > 0 ? bodies : [ALBUM_PAGE], calls),
    accessPoint: { hostname: "h.test" },
    partition: 12,
  });

describe("createDataWriter — image の write（ADR-0064 論点3）", () => {
  const photo = {
    FileName: "photo.png",
    ContentType: "image/png",
    Content: "QUJD",
  } as const;

  it("画像を含む write だけサイズガードを外す", async () => {
    const calls: Call[] = [];
    await album(calls, WRITE_OK()).create({ U_photo: photo });
    expect(calls[0].spec).toEqual({
      write: true,
      idempotent: false,
      unboundedBody: true,
    });
    expect(calls[0].req.body).toContain(
      "<Al.U_photo><FileName>photo.png</FileName>" +
        "<ContentType>image/png</ContentType><Content>QUJD</Content></Al.U_photo>",
    );
  });

  it("画像を含まない write の spec は従来のまま（穴を広げない）", async () => {
    const calls: Call[] = [];
    await album(calls, WRITE_OK()).create({ P_Name: "x" });
    expect(calls[0].spec).toEqual({ write: true, idempotent: false });
  });

  it("上限違反は送信前に落ちる＝リクエストは 1 本も出ない", async () => {
    const calls: Call[] = [];
    await expect(
      album(calls, WRITE_OK()).create({
        U_photo: { ...photo, ContentType: "image/webp" as never },
      }),
    ).rejects.toBeInstanceOf(PortersConfigError);
    expect(calls).toHaveLength(0);
  });

  it("画像を含む一括書き込みは弾く（単発へ誘導する）", async () => {
    const calls: Call[] = [];
    await expect(
      album(calls, WRITE_OK()).createMany([{ U_photo: photo }]),
    ).rejects.toThrow(/createMany cannot write an image/);
    await expect(
      album(calls, WRITE_OK()).updateMany([
        { id: 1, fields: { U_photo: photo } },
      ]),
    ).rejects.toThrow(/updateMany cannot write an image/);
    expect(calls).toHaveLength(0);
  });

  it("画像を含まない一括書き込みはこれまでどおり通る", async () => {
    const calls: Call[] = [];
    const result = await album(
      calls,
      `<Album><Item><Id>1</Id><Code>0</Code></Item></Album>`,
    ).createMany([{ P_Name: "a" }]);
    expect(result.hasFailures).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("Link は ID ひとつで書く", async () => {
    const calls: Call[] = [];
    await album(calls, WRITE_OK()).create({ U_link: 10001 });
    expect(calls[0].req.body).toContain("<Al.U_link>10001</Al.U_link>");
  });
});

describe("createDataWriter — Write", () => {
  it("create POSTs to {path}, forces P_Id=-1, is non-idempotent, returns the id", async () => {
    const calls: Call[] = [];
    const id = await res(calls, WRITE_OK()).create({ P_Name: "hi" });
    expect(id).toBe(100);
    const { req, spec } = calls[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://h.test/v1/widget?partition=12");
    expect(req.body).toBe(
      "<Widget><Item><W.P_Name>hi</W.P_Name><W.P_Id>-1</W.P_Id></Item></Widget>",
    );
    expect(spec).toEqual({ write: true, idempotent: false });
  });

  it("update forces the target id and is idempotent", async () => {
    const calls: Call[] = [];
    const id = await res(calls, WRITE_OK(7)).update(7, { P_Name: "x" });
    expect(id).toBe(7);
    expect(calls[0].req.body).toContain("<W.P_Id>7</W.P_Id>");
    expect(calls[0].spec).toEqual({ write: true, idempotent: true });
  });

  it("maps a non-zero per-Item Code to a PortersResourceError", async () => {
    const calls: Call[] = [];
    const body = `<Widget><Item><Id>0</Id><Code>403</Code></Item></Widget>`;
    let err: unknown;
    try {
      await res(calls, body).create({ P_Name: "x" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).code).toBe(403);
    expect((err as PortersResourceError).category).toBe("permission");
    expect((err as PortersResourceError).message).toBe(
      "widget write returned code 403",
    );
    expect((err as PortersResourceError).context?.resource).toBe("Widget");
  });

  it("throws when the Write response carries no result Item", async () => {
    const calls: Call[] = [];
    const body = `<Widget><Other>x</Other></Widget>`;
    let err: unknown;
    try {
      await res(calls, body).create({ P_Name: "x" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersResourceError);
    expect((err as PortersResourceError).category).toBe("unknown");
    expect((err as PortersResourceError).message).toBe(
      "write returned no result item",
    );
  });
});

// RV-47: `writeDefaults` はアクセサが埋める項目で、呼び出し側は上書きできない。
// Phase は 1 項目（`Resource`）だけだが、機構は複数を扱えるのでここで押さえる。
describe("createDataWriter — 束ねた書き込み項目（RV-47）", () => {
  const BOUND_CONFIG = {
    ...CONFIG,
    writeDefaults: { P_Name: "bound", P_Owner: 5 },
  } as const;

  const bound = (calls: Call[], ...bodies: string[]) =>
    createDataWriter(BOUND_CONFIG, {
      requester: stub(bodies.length > 0 ? bodies : [WRITE_OK()], calls),
      accessPoint: { hostname: "h.test" },
      partition: 12,
    });

  it("渡されなければ、束ねた値が全部乗る", async () => {
    const calls: Call[] = [];
    await bound(calls).create({});
    expect(calls[0]?.req.body).toContain("<W.P_Name>bound</W.P_Name>");
    expect(calls[0]?.req.body).toContain("<W.P_Owner>5</W.P_Owner>");
  });

  it("複数を渡したら、両方を名指しして落とす", async () => {
    const calls: Call[] = [];
    let err: unknown;
    try {
      await bound(calls).create({ P_Name: "mine", P_Owner: 9 });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PortersConfigError);
    // どれが問題かが全部出る（1 つ直したらもう 1 つで落ちる、を避ける）。
    expect((err as PortersConfigError).message).toContain("P_Name, P_Owner");
    expect((err as PortersConfigError).hint).toContain("P_Name, P_Owner");
    expect(calls).toHaveLength(0);
  });

  // RV-64: 束ねた alias の拒否は `write` に入る前（引数の評価中）に起きるので、`create` / `update` を
  // `async` にしないと同期 throw になり、`.catch()` で拾えない（ADR-0046 の契約違反）。
  it("create: 束ねた alias を渡しても同期 throw せず、reject で届く（ADR-0046）", async () => {
    let promise: Promise<unknown> | undefined;
    expect(() => {
      promise = bound([]).create({ P_Name: "mine" });
    }).not.toThrow();
    await expect(promise).rejects.toBeInstanceOf(PortersConfigError);
  });

  it("update: 束ねた alias を渡しても同期 throw せず、reject で届く（ADR-0046）", async () => {
    let promise: Promise<unknown> | undefined;
    expect(() => {
      promise = bound([]).update(7, { P_Owner: 9 });
    }).not.toThrow();
    await expect(promise).rejects.toBeInstanceOf(PortersConfigError);
  });
});
