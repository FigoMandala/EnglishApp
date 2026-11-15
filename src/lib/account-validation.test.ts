import assert from "node:assert/strict";
import test from "node:test";

import { validateDisplayName, validatePasswordChange } from "./account-validation";

test("nama tampilan: trim, rapikan spasi, batas 1-40", () => {
  assert.deepEqual(validateDisplayName("  Budi   Santoso "), { value: "Budi Santoso", error: null });
  assert.ok(validateDisplayName("   ").error);
  assert.equal(validateDisplayName("a".repeat(40)).error, null);
  assert.ok(validateDisplayName("a".repeat(41)).error);
});

test("kata sandi: wajib isi, minimal 8, harus beda dari lama", () => {
  assert.deepEqual(validatePasswordChange("lama12345", "baru12345"), {});
  assert.ok(validatePasswordChange("", "baru12345").current);
  assert.match(validatePasswordChange("lama12345", "pendek").next ?? "", /minimal 8/);
  assert.ok(validatePasswordChange("sama12345", "sama12345").next);
});
