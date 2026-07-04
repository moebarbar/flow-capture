import { describe, it, expect } from "vitest";
import { regionToPixelRect } from "../server/lib/redactionGeometry";

describe("regionToPixelRect", () => {
  it("maps a centered region to pixels", () => {
    expect(regionToPixelRect({ x: 25, y: 50, width: 50, height: 10 }, 800, 600)).toEqual({
      left: 200,
      top: 300,
      width: 400,
      height: 60,
    });
  });

  it("clamps a region that overflows the right/bottom edges", () => {
    const r = regionToPixelRect({ x: 90, y: 90, width: 50, height: 50 }, 800, 600);
    expect(r.left).toBe(720);
    expect(r.top).toBe(540);
    expect(r.left + r.width).toBeLessThanOrEqual(800);
    expect(r.top + r.height).toBeLessThanOrEqual(600);
  });

  it("never produces a zero-size rect", () => {
    const r = regionToPixelRect({ x: 0, y: 0, width: 0, height: 0 }, 800, 600);
    expect(r.width).toBeGreaterThanOrEqual(1);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });

  it("keeps the origin within bounds for a 100%-offset region", () => {
    const r = regionToPixelRect({ x: 100, y: 100, width: 10, height: 10 }, 800, 600);
    expect(r.left).toBeLessThanOrEqual(799);
    expect(r.top).toBeLessThanOrEqual(599);
    expect(r.left + r.width).toBeLessThanOrEqual(800);
    expect(r.top + r.height).toBeLessThanOrEqual(600);
  });
});
