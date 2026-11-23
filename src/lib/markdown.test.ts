import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseMarkdown } from "./markdown";

describe("parseMarkdown tabel", () => {
  it("membaca header, pemisah, dan baris data", () => {
    const [block] = parseMarkdown("| A | B |\n|---|---|\n| **1** | 2 |\n| 3 | 4 |");
    assert.equal(block.kind, "table");
    if (block.kind !== "table") return;
    assert.equal(block.header.length, 2);
    assert.equal(block.rows.length, 2);
    assert.equal(block.rows[0][0][0].tone, "bold");
  });

  it("baris berpipa tanpa pemisah tetap paragraf", () => {
    assert.equal(parseMarkdown("| bukan tabel |")[0].kind, "paragraph");
  });
});
