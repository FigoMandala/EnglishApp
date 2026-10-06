import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashPassword, verifyPassword } from "./password";

describe("hashPassword", () => {
  it("stores a salted scrypt hash, never the plaintext", async () => {
    const hash = await hashPassword("rahasia12345");
    assert.match(hash, /^scrypt\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    assert.ok(!hash.includes("rahasia12345"));
  });

  it("produces a different hash each time for the same password", async () => {
    assert.notEqual(await hashPassword("sama"), await hashPassword("sama"));
  });
});

describe("verifyPassword", () => {
  it("accepts the matching password", async () => {
    assert.equal(await verifyPassword("rahasia12345", await hashPassword("rahasia12345")), true);
  });

  it("rejects a wrong password", async () => {
    assert.equal(await verifyPassword("salah", await hashPassword("rahasia12345")), false);
  });

  it("is case sensitive", async () => {
    assert.equal(await verifyPassword("Rahasia12345", await hashPassword("rahasia12345")), false);
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    assert.equal(await verifyPassword("apa saja", "bukan-hash"), false);
    assert.equal(await verifyPassword("apa saja", ""), false);
    assert.equal(await verifyPassword("apa saja", "bcrypt$abc$def"), false);
  });
});
