import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { estimateCostUsd, priceFor } from "./ai-pricing";

afterEach(() => {
  delete process.env.AI_PRICES;
});

describe("priceFor", () => {
  it("gpt-6-luna memakai tarif sendiri", () => {
    assert.deepEqual(priceFor("gpt-6-luna"), { input: 0.011, output: 0.055 });
  });

  it("gpt-4o-mini tidak tertukar dengan gpt-4o", () => {
    assert.equal(priceFor("gpt-4o-mini").input, 0.15);
    assert.equal(priceFor("gpt-4o").input, 2.5);
  });

  it("model tak dikenal jatuh ke harga bawaan", () => {
    assert.deepEqual(priceFor("model-baru-x"), { input: 0.1, output: 0.4 });
  });

  it("AI_PRICES menimpa tabel untuk nama model yang persis sama", () => {
    process.env.AI_PRICES = JSON.stringify({ "gpt-6-luna": { input: 1, output: 2 } });
    assert.deepEqual(priceFor("gpt-6-luna"), { input: 1, output: 2 });
  });

  it("AI_PRICES rusak diabaikan, bukan melempar galat", () => {
    process.env.AI_PRICES = "{bukan json";
    assert.deepEqual(priceFor("gpt-6-luna"), { input: 0.011, output: 0.055 });
  });
});

describe("estimateCostUsd", () => {
  it("menghitung per juta token untuk masuk dan keluar", () => {
    const cost = estimateCostUsd("gpt-6-luna", { promptTokens: 1_000_000, completionTokens: 1_000_000, totalTokens: 2_000_000 });
    assert.ok(Math.abs(cost - 0.066) < 1e-9);
  });

  it("tanpa token biayanya nol", () => {
    assert.equal(estimateCostUsd("gpt-6-luna", { promptTokens: 0, completionTokens: 0, totalTokens: 0 }), 0);
  });
});
