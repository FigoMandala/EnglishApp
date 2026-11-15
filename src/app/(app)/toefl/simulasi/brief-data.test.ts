import assert from "node:assert/strict";
import test from "node:test";

import { buildBrief } from "./brief-data";

test("angka petunjuk section cocok dengan susunan TOEFL ITP", () => {
  const listening = buildBrief("listening");
  assert.equal(listening.total, 50);
  assert.deepEqual(
    listening.groups.map((group) => [group.name, group.count]),
    [
      ["Short Dialogue", 30],
      ["Long Dialogue", 10],
      ["Lecture", 10],
    ],
  );
  assert.equal(buildBrief("structure").total, 40);
  assert.equal(buildBrief("structure").groups.length, 2);
  const reading = buildBrief("reading");
  assert.equal(reading.groups.length, 5);
  assert.equal(reading.minutes, 55);
  assert.match(buildBrief("structure").rules[1], /16 sampai 40/);
});
