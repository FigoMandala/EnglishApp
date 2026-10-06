import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeUsername, validatePassword, validateUsername } from "./validation";

describe("validateUsername", () => {
  it("accepts letters, digits, and underscores", () => {
    assert.equal(validateUsername("budi_123"), null);
    assert.equal(validateUsername("A"), "Username minimal 3 karakter.");
    assert.equal(validateUsername("abc"), null);
  });

  it("rejects empty and too short", () => {
    assert.equal(validateUsername(""), "Username wajib diisi.");
    assert.equal(validateUsername("   "), "Username wajib diisi.");
    assert.equal(validateUsername("ab"), "Username minimal 3 karakter.");
  });

  it("rejects too long", () => {
    assert.equal(validateUsername("a".repeat(25)), "Username maksimal 24 karakter.");
    assert.equal(validateUsername("a".repeat(24)), null);
  });

  it("rejects characters outside letters, digits, and underscore", () => {
    assert.equal(validateUsername("ab!"), "Username hanya boleh huruf, angka, dan garis bawah.");
    assert.equal(validateUsername("bu di"), "Username hanya boleh huruf, angka, dan garis bawah.");
    assert.equal(validateUsername("budi@mail"), "Username hanya boleh huruf, angka, dan garis bawah.");
  });

  it("ignores surrounding whitespace before checking", () => {
    assert.equal(validateUsername("  budi  "), null);
    assert.equal(validateUsername("  ab  "), "Username minimal 3 karakter.");
  });
});

describe("validatePassword", () => {
  it("requires at least 8 characters", () => {
    assert.equal(validatePassword(""), "Password wajib diisi.");
    assert.equal(validatePassword("1234567"), "Password minimal 8 karakter.");
    assert.equal(validatePassword("12345678"), null);
  });

  it("rejects absurdly long input", () => {
    assert.equal(validatePassword("a".repeat(129)), "Password maksimal 128 karakter.");
    assert.equal(validatePassword("a".repeat(128)), null);
  });
});

describe("normalizeUsername", () => {
  it("trims surrounding whitespace only", () => {
    assert.equal(normalizeUsername("  Budi  "), "Budi");
    assert.equal(normalizeUsername("budi"), "budi");
  });
});
