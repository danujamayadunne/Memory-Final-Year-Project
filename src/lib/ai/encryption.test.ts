import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { decrypt, encrypt } from "./encryption";

describe("encryption", () => {
  const originalSecret = process.env.ENCRYPTION_SECRET;

  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = "test-encryption-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ENCRYPTION_SECRET;
    } else {
      process.env.ENCRYPTION_SECRET = originalSecret;
    }
  });

  it("round-trips plaintext through encrypt and decrypt", () => {
    const plaintext = "provider-api-key-123";

    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("rejects ciphertext with an invalid format", () => {
    expect(() => decrypt("not-valid-ciphertext")).toThrow(
      "Invalid encrypted data format",
    );
  });
});
