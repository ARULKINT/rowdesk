import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./encryption";

describe("encrypt/decrypt", () => {
  const prevKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "test-encryption-key-do-not-use-in-prod";
  });

  afterEach(() => {
    if (prevKey) process.env.ENCRYPTION_KEY = prevKey;
    else delete process.env.ENCRYPTION_KEY;
  });

  it("round-trips a plaintext string", () => {
    const plaintext = "ya29.a0AfH6SMC_example_access_token";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const a = encrypt("same-secret");
    const b = encrypt("same-secret");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same-secret");
    expect(decrypt(b)).toBe("same-secret");
  });

  it("fails to decrypt with a different key", () => {
    const encrypted = encrypt("top-secret-token");
    process.env.ENCRYPTION_KEY = "a-completely-different-key";
    expect(() => decrypt(encrypted)).toThrow();
  });

  it("throws a clear error when ENCRYPTION_KEY is unset", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("anything")).toThrow(/ENCRYPTION_KEY/);
  });
});
