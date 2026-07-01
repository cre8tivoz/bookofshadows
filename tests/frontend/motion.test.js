import { afterEach, describe, expect, test, vi } from "vitest";

import { prefersReducedMotion } from "../../static/src/utils/motion.js";

describe("prefersReducedMotion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("reflects a matching prefers-reduced-motion media query", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true });

    expect(prefersReducedMotion()).toBe(true);
  });

  test("reflects a non-matching prefers-reduced-motion media query", () => {
    const matchMedia = vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false });

    expect(prefersReducedMotion()).toBe(false);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });
});
