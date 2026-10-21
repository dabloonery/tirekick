import test from "node:test";
import assert from "node:assert/strict";
import { runCases, score, report } from "../eval/pipeline.mjs";

// The accuracy eval (tests/eval): labeled listings through the free checks. The floors are what the rules
// do today; a change that lowers one fails here, and `deno task eval` says which listings moved.
const rows = runCases();
const s = score(rows);
const titles = (list) => list.map((r) => r.c.title).sort();

test("eval: every scam gets a warning before any scan, and none is missed", () => {
  assert.equal(s.missed.length, 0, report(rows));
  assert.ok(s.red >= 11, `Likely scam on ${s.red} of ${s.scams}\n${report(rows)}`);
});

test("eval: honest listings are rarely marked, and only the known ones", () => {
  assert.deepEqual(titles(s.falseRed), ["Pokemon Scarlet Nintendo Switch OLED Game Brand New Sealed"], report(rows));
  assert.ok(s.falseAmber.length <= 5, report(rows));
});

test("eval: price words and verdicts after a scan are as labeled", () => {
  assert.ok(s.priced - s.wrongWord.length >= 47, report(rows));
  assert.equal(s.wrongShown.length, 0, report(rows));
});
