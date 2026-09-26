import { describe, expect, it } from "vitest";

import {
  createThrottleRegistry,
  resetSharedThrottles,
  sharedThrottleFor,
} from "./shared-throttle";

// ADR-0073: バケットは client ごとではなく**ホストごと**。テナント別に client を立てても
// 合計が上限に収まることが要件なので、「同じホストなら同じ実体」を直接 pin する。
describe("createThrottleRegistry (per-host buckets, ADR-0073)", () => {
  const counting = () => {
    let made = 0;
    const registry = createThrottleRegistry(() => {
      made += 1;
      return { take: () => Promise.resolve() };
    });
    return { registry, made: () => made };
  };

  it("同じホストには同じバケットを返す", () => {
    const { registry, made } = counting();
    const a = registry.forAuthority("xxxxx.example.com");
    const b = registry.forAuthority("xxxxx.example.com");
    expect(b).toBe(a);
    expect(made()).toBe(1);
  });

  it("違うホストには別のバケットを返す", () => {
    const { registry, made } = counting();
    const a = registry.forAuthority("xxxxx.example.com");
    const b = registry.forAuthority("127.0.0.1:4010");
    expect(b).not.toBe(a);
    expect(made()).toBe(2);
  });

  it("ホスト名の大小は無視する（ホストは case-insensitive）", () => {
    const { registry, made } = counting();
    const a = registry.forAuthority("XXXXX.Example.COM");
    const b = registry.forAuthority("xxxxx.example.com");
    expect(b).toBe(a);
    expect(made()).toBe(1);
  });

  it("ポートが違えば別のバケット（別の宛先だから）", () => {
    const { registry } = counting();
    expect(registry.forAuthority("localhost:4010")).not.toBe(
      registry.forAuthority("localhost:4011"),
    );
  });

  it("reset() で忘れる（テスト用の継ぎ目）", () => {
    const { registry, made } = counting();
    const before = registry.forAuthority("xxxxx.example.com");
    registry.reset();
    expect(registry.forAuthority("xxxxx.example.com")).not.toBe(before);
    expect(made()).toBe(2);
  });
});

describe("sharedThrottleFor (process-wide registry)", () => {
  it("プロセス全体で 1 ホスト 1 バケット", () => {
    resetSharedThrottles();
    expect(sharedThrottleFor("xxxxx.example.com")).toBe(
      sharedThrottleFor("xxxxx.example.com"),
    );
    expect(sharedThrottleFor("other.example.com")).not.toBe(
      sharedThrottleFor("xxxxx.example.com"),
    );
  });

  it("resetSharedThrottles は共有バケットを本当に捨てる（テストの隔離が依存する継ぎ目）", () => {
    const before = sharedThrottleFor("xxxxx.example.com");
    resetSharedThrottles();
    // 何もしない実装でも他のテストは緑のまま通る（前のバケットを使い回すだけ）ので、ここで pin する。
    expect(sharedThrottleFor("xxxxx.example.com")).not.toBe(before);
  });

  it("既定のバケットは本物のスロットル（take できる）", async () => {
    resetSharedThrottles();
    await expect(
      sharedThrottleFor("xxxxx.example.com").take(false),
    ).resolves.toBeUndefined();
  });
});
