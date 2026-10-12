import test from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load.mjs";

const { R } = await loadScripts();

test("hasWord matches whole words only, any case, and a/b means either", () => {
  assert.equal(R.hasWord("Game Boy REPRO cart", "repro"), true);
  assert.equal(R.hasWord("reproduced from original", "repro"), false);
  assert.equal(R.hasWord("with charger", "charger/adapter"), true);
  assert.equal(R.hasWord("with adapter", "charger/adapter"), true);
  assert.equal(R.hasWord("with cable", "charger/adapter"), false);
  assert.equal(R.hasWord("box only, no console", "box only"), true);
  assert.equal(R.hasWord("c++ book", "c++"), true, "regex characters are not special");
});

test("quickTerms reads words like an eBay search", () => {
  assert.deepEqual(R.quickTerms('dmg -case -"box only" "must go" - '), [
    { not: false, w: "dmg" }, { not: true, w: "case" }, { not: true, w: "box only" }, { not: false, w: "must go" },
  ]);
  assert.deepEqual(R.quickTerms(""), []);
  assert.deepEqual(R.quickTerms(undefined), []);
});

test("termsReason says which word a listing fails", () => {
  assert.equal(R.termsReason("Nintendo DMG Game Boy", "dmg -case -game"), "“game”");
  assert.equal(R.termsReason("Nintendo DMG console", "dmg -case -game"), "");
  assert.equal(R.termsReason("Nintendo console", "dmg"), "no “dmg”");
  assert.equal(R.termsReason("anything", ""), "");
});

test("quickReason: words on title and card text, price with shipping, seen before, broken", () => {
  const f = { title: "Game Boy SP", text: "from China", total: 50, price: 42, known: true, project: "" };
  const q = (over) => ({ words: "", min: 0, max: 0, fresh: false, broken: "", ...over });
  assert.equal(R.quickReason(f, q({ words: "-china" })), "“china”", "card text counts, like eBay's own search");
  assert.equal(R.quickReason(f, q({ min: 60 })), "under $60", "total, not price");
  assert.equal(R.quickReason(f, q({ max: 45 })), "over $45");
  assert.equal(R.quickReason(f, q({ min: 30, max: 60 })), "");
  assert.equal(R.quickReason(f, q({ fresh: true })), "seen before");
  assert.equal(R.quickReason(f, q({ broken: "only" })), "not broken");
  assert.equal(R.quickReason({ ...f, project: "for parts" }, q({ broken: "hide" })), "“for parts”");
  assert.equal(R.quickReason({ ...f, project: "for parts" }, q({ broken: "only" })), "");
  assert.equal(R.quickReason({ title: "x", total: null, price: null }, q({ min: 10, max: 20 })), "", "no price, no price filter");
});

test("likelyScam and isDeal", () => {
  assert.equal(R.likelyScam({ campaign: ["K7731"] }), true);
  assert.equal(R.likelyScam({ titleCode: "M2465" }), true);
  assert.equal(R.likelyScam({ titleCode: "K1000", codeOk: true }), false, "a code the model says is the real model number");
  assert.equal(R.likelyScam({ offSite: { sure: true, why: ["x"] } }), true);
  assert.equal(R.likelyScam({ offSite: { sure: false, why: ["phone"] } }), false, "a plain phone number is only a hint");
  assert.equal(R.likelyScam(undefined), false);
  assert.equal(R.isDeal({ total: 55 }, 60), true);
  assert.equal(R.isDeal({ total: 65 }, 60), false);
  assert.equal(R.isDeal({ total: 55 }, 0), false, "no price set");
  assert.equal(R.isDeal({ total: 5, titleCode: "M2465" }, 60), false, "never a deal when it looks like a scam");
});

test("sellerWarning follows your limits", () => {
  const lim = { minSellerRatings: 10, minSellerPct: 97 };
  assert.equal(R.sellerWarning({ sellerCount: 0 }, lim), "New seller");
  assert.equal(R.sellerWarning({ sellerCount: 4 }, lim), "Seller: 4 ratings");
  assert.equal(R.sellerWarning({ sellerCount: 400, sellerPct: 94.1 }, lim), "Seller 94.1% positive");
  assert.equal(R.sellerWarning({ sellerCount: 400, sellerPct: 99 }, lim), "");
  assert.equal(R.sellerWarning({}, lim), "");
});

test("PROJECT words find fix-up listings, and only those", () => {
  for (const t of ["Wii FOR PARTS", "console not working", "PS3 yellow light of death", "Game Boy untested as-is", "Xbox 360 red ring", "needs repair", "cracked screen phone", "disc read error"]) {
    assert.ok(R.clueOf(R.PROJECT, t), t);
  }
  for (const t of ["Wii working great", "tested and working", "in original box"]) assert.equal(R.clueOf(R.PROJECT, t), "", t);
  assert.equal(R.clueOf(R.MOTIVATED, "Moving sale, must go"), "moving sale");
  assert.equal(R.clueOf(R.MOTIVATED, "Nice console"), "");
});

test("a photo check can pull a verdict down, never up", () => {
  const photos = (matchesTitle = "yes") => [{ matchesTitle }];
  assert.equal(R.adjustedVerdict("great", 92, photos()), "great");
  assert.equal(R.adjustedVerdict("great", 70, photos()), "good", "a lower score caps the verdict");
  assert.equal(R.adjustedVerdict("great", 50, photos()), "fair");
  assert.equal(R.adjustedVerdict("good", 30, photos()), "pass");
  assert.equal(R.adjustedVerdict("fair", 95, photos()), "fair", "a high score does not talk it up");
  assert.equal(R.adjustedVerdict("great", 90, photos("no")), "suspicious", "a photo that doesn't match is suspicious");
  assert.equal(R.adjustedVerdict("suspicious", 95, photos()), "suspicious");
});

test("small formatters", () => {
  assert.equal(R.dollars(52), "$52");
  assert.equal(R.dollars(52.5), "$52.50");
  assert.equal(R.signed(5), "+5");
  assert.equal(R.signed(-12), "−12");
  assert.equal(R.signed(0), "±0");
  assert.equal(R.clamp100(140), 100);
  assert.equal(R.clamp100(-3), 0);
  assert.equal(R.normTitle("Game-Boy  Advance, SP!"), "game boy advance sp");
  assert.equal(R.hash("abc"), R.hash("abc"));
  assert.notEqual(R.hash("abc"), R.hash("abd"));
});
