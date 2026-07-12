import { describe, expect, it } from "vitest";
import { foodModifiers } from "./foods.js";

describe("food tuning", () => {
  it("reaches the accepted three-stack Spinach target", () => {
    expect(
      foodModifiers(["spinach", "spinach", "spinach"]).throwMultiplier,
    ).toBe(3);
  });
  it("adds one heart and meaningful mass per Potato", () => {
    const value = foodModifiers(["potato", "potato"]);
    expect(value.maxHeartsBonus).toBe(2);
    expect(value.mass).toBeGreaterThan(1.5);
    expect(value.speedMultiplier).toBeLessThan(1);
  });
  it("keeps mixed effects active in parallel", () => {
    const value = foodModifiers(["spinach", "potato", "banana"]);
    expect(value.throwMultiplier).toBeGreaterThan(1);
    expect(value.maxHeartsBonus).toBe(1);
    expect(value.accelerationMultiplier).toBeGreaterThan(1);
  });
});
