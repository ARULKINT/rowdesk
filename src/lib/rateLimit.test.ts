import { describe, expect, it } from "vitest";
import { rateLimit } from "./rateLimit";

describe("rateLimit", () => {
  it("allows requests up to the limit", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
    }
  });

  it("blocks once the limit is exceeded within the window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      rateLimit(key, { limit: 5, windowMs: 60_000 });
    }
    const result = rateLimit(key, { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    for (let i = 0; i < 5; i++) rateLimit(keyA, { limit: 5, windowMs: 60_000 });

    expect(rateLimit(keyA, { limit: 5, windowMs: 60_000 }).allowed).toBe(false);
    expect(rateLimit(keyB, { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
  });
});
