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
  assert.ok(s.red >= 28, `Likely scam on ${s.red} of ${s.scams}\n${report(rows)}`);
});

test("eval: honest listings are rarely marked, and only the known ones", () => {
  assert.deepEqual(titles(s.falseRed), [], report(rows));
  assert.ok(s.falseAmber.length <= 2, report(rows));
});

test("eval: price words and verdicts after a scan are as labeled", () => {
  assert.ok(s.priced - s.wrongWord.length >= 80, report(rows));
  assert.equal(s.wrongShown.length, 0, report(rows));
  assert.deepEqual(titles(s.deepCleared), [], report(rows));
});

// Honest listings far under typical (tests/eval/cases.mjs CHEAP). The numbers are where the rules stand; each change
// that clears honest cheap listings lowers them, and the scam tests above say what it cost.
test("eval: honest cheap listings that say why", () => {
  assert.deepEqual(titles(s.clearRed), [], report(rows));
  assert.deepEqual(titles(s.clearStuck), [], report(rows));
});

test("eval: honest cheap listings that don't say why are Likely scam only beside a strong seller sign", () => {
  assert.ok(s.warnRed.length <= 3, report(rows));
});
