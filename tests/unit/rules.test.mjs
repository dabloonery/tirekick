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

test("readHealth: notices when the page reader stops keeping up with a site", () => {
  const lvl = (counts, opts) => R.readHealth(counts, opts).level;
  assert.equal(lvl({ links: 48, items: 48, priced: 48 }), "ok");
  assert.equal(lvl({ links: 52, items: 48, priced: 47 }), "ok", "a few links outside the cards are normal");
  assert.equal(lvl({ links: 3, items: 0, priced: 0 }), "few", "too few listings to judge");
  assert.equal(lvl({ links: 0, items: 0, priced: 0 }), "few", "an empty search is not a broken page");
  assert.equal(lvl({ links: 48, items: 0, priced: 0 }), "broken");
  assert.equal(lvl({ links: 48, items: 0, priced: 0 }, { partialOk: true }), "broken", "nothing read is broken anywhere");
  assert.equal(lvl({ links: 48, items: 10, priced: 10 }), "partial");
  assert.equal(lvl({ links: 48, items: 10, priced: 10 }, { partialOk: true }), "ok", "a category page's carousels don't count against it");
  assert.equal(lvl({ links: 48, items: 48, priced: 5 }), "prices");
  assert.equal(lvl({ links: 48, items: 48, priced: 24 }), "ok", "half priced is enough (Free and auctions without a bid exist)");
});

test("healthNote says what changed, and nothing when all is well", () => {
  assert.equal(R.healthNote({ level: "ok" }, "eBay"), "");
  assert.equal(R.healthNote({ level: "few" }, "eBay"), "");
  assert.match(R.healthNote({ level: "broken", links: 48, items: 0 }, "eBay"), /^eBay changed this page.*48 on the page, none read/);
  assert.match(R.healthNote({ level: "partial", links: 48, items: 10 }, "Marketplace"), /read 10 of the 48 listings/);
  assert.match(R.healthNote({ level: "prices", items: 48, priced: 5 }, "eBay"), /price on only 5/);
});

test("sighting: seen before, new to you, price drops and their history", () => {
  const first = R.sighting(undefined, 100, { now: 1, pageHadKnown: false });
  assert.deepEqual(first, { out: { isNew: false, known: false }, rec: { p: 100, pa: 1, f: 1, a: 1 } }, "a first visit to a search marks nothing new");
  assert.equal(R.sighting(undefined, 100, { now: 1, pageHadKnown: true }).out.isNew, true, "a search you've seen before marks what's new");
  const same = R.sighting(first.rec, 100, { now: 5 });
  assert.deepEqual(same, { out: { isNew: false, known: true }, rec: { p: 100, pa: 1, f: 1, a: 5 } });
  const small = R.sighting(first.rec, 99.5, { now: 6 });
  assert.equal(small.out.drop, undefined, "under a dollar and 3% isn't a drop");
  const drop = R.sighting(first.rec, 80, { now: 7 });
  assert.deepEqual(drop.out.drop, { from: 100, since: 1 });
  assert.deepEqual(drop.rec, { p: 80, pa: 7, f: 1, a: 7, h: [[100, 1]] });
  const bid = R.sighting(drop.rec, 20, { now: 8, auction: true });
  assert.equal(bid.out.drop, undefined, "a bid says nothing about drops");
  assert.equal(bid.rec.p, 80, "…and the last fixed price is kept");
  let r = first.rec;
  for (let i = 0; i < 8; i++) r = R.sighting(r, 100 - i * 5, { now: 10 + i }).rec;
  assert.equal(r.h.length, 5, "history keeps the last five changes");
  assert.equal(R.sighting({ p: 50, pa: 1, f: 1, a: 1, o: 3 }, 50, { now: 9 }).rec.o, 3, "when you first opened it is kept");
  assert.doesNotThrow(() => R.sighting("junk", 5), "a damaged record is treated as new");
  assert.equal(R.sighting({ p: "x", pa: 1 }, 5, { now: 2 }).rec.p, 5);
});

test("duplicates: same title or same photo on one page", () => {
  const a = { title: "Pentax K1000 35mm film camera", imageUrl: "https://i.ebayimg.com/1.jpg" };
  const b = { title: "PENTAX K1000 35mm film camera!", imageUrl: "https://i.ebayimg.com/2.jpg" };
  const c = { title: "Nikon F3", imageUrl: "https://i.ebayimg.com/2.jpg" };
  const d = { title: "Nikon F3", imageUrl: "data:image/gif;base64,x" };
  const e = { title: "Nikon F3", imageUrl: "data:image/gif;base64,x" };
  const dup = R.duplicates([a, b, c, d, e], (u) => u.startsWith("data:"));
  assert.equal(dup.get(a), 2);
  assert.equal(dup.get(b), 2, "same title, and a photo shared with c");
  assert.equal(dup.get(c), 2);
  assert.equal(dup.has(d), false, "short titles and placeholder photos don't count");
});

test("otherCodes: the same scam title under other codes", () => {
  const stem = { c: { M2465: "fb:1", K7731: "fb:2", Z9999: "fb:1" } };
  assert.deepEqual(R.otherCodes(stem, "fb:1", "M2465"), ["K7731"], "codes on the same listing don't count");
  assert.deepEqual(R.otherCodes(undefined, "fb:1", "M2465"), []);
});

test("words: accents don't matter, and other alphabets have word edges", () => {
  assert.equal(R.hasWord("Pokémon Red cartridge", "pokemon"), true);
  assert.equal(R.hasWord("Pokemon Red cartridge", "pokémon"), true);
  assert.equal(R.hasWord("Cámara Canon AE-1", "mara"), false, "not a word inside an accented word");
  assert.equal(R.hasWord("Cámara Canon AE-1", "camara"), true);
  assert.equal(R.hasWord("ファミコン カセット", "カセット"), true);
  assert.equal(R.hasWord("Game Boy", 5), false, "a word that isn't text matches nothing, without throwing");
  assert.equal(R.normTitle("Pokémon  RED!!"), "pokemon red");
  assert.equal(R.termsReason("Pokémon Red", "-pokemon"), "“pokemon”");
});

test("quickTerms: a quote left open, and words that aren't text", () => {
  assert.deepEqual(R.quickTerms('"must go'), [{ not: false, w: "must" }, { not: false, w: "go" }]);
  assert.deepEqual(R.quickTerms('-"box'), [{ not: true, w: "box" }]);
  assert.deepEqual(R.quickTerms(12), []);
  assert.equal(R.termsReason("Nintendo DMG", '"dmg'), "", "a stray quote doesn't filter everything out");
});

test("sellerWarning flags an account made this year", () => {
  const prefs = { minSellerRatings: 5, minSellerPct: 97 };
  const now = Date.parse("2026-10-14");
  assert.equal(R.sellerWarning({ sellerJoined: 2026 }, prefs, now), "Account made in 2026");
  assert.equal(R.sellerWarning({ sellerJoined: 2015 }, prefs, now), "");
  assert.equal(R.sellerWarning({}, prefs, now), "");
  assert.equal(R.sellerWarning({ sellerCount: 0, sellerJoined: 2026 }, prefs, now), "New seller", "ratings come first");
});

test("tooCheap: far under a trusted sold median, not for auctions, lots, broken ones or a rough reference", () => {
  const m = { median: 200, p25: 170, p75: 230, n: 20, confidence: "good" };
  assert.deepEqual(R.tooCheap({ total: 60 }, m), { level: "far", pct: 30 });
  assert.deepEqual(R.tooCheap({ total: 100 }, m), { level: "low", pct: 50 });
  assert.equal(R.tooCheap({ total: 120 }, m), null);
  assert.equal(R.tooCheap({ total: 60, project: "for parts" }, m), null);
  assert.equal(R.tooCheap({ total: 60, auction: true }, m), null);
  assert.equal(R.tooCheap({ total: 60, lot: 3 }, m), null);
  assert.equal(R.tooCheap({ total: 60 }, { ...m, confidence: "rough" }), null);
  assert.equal(R.tooCheap({ total: 0 }, m), null, "free isn't a price");
  assert.equal(R.tooCheap({ total: 60 }, null), null);
});

test("softSeller counts the signs of room to haggle", () => {
  assert.deepEqual(R.softSeller({}), { level: "none", why: [] });
  assert.equal(R.softSeller({ drops: 1 }).level, "some");
  const s = R.softSeller({ drops: 2, days: 45, motivated: "moving sale", bestOffer: true });
  assert.equal(s.level, "likely");
  assert.deepEqual(s.why, ["the price dropped 2 times", "listed for 45 days", "“moving sale”", "takes offers"]);
  assert.deepEqual(R.softSeller({ days: 90 }).why, ["listed for 3 months"]);
  assert.equal(R.softSeller({ days: 10 }).level, "none");
});

test("offerPlan opens between the cheaper quarter and the median, walks away at the median", () => {
  const m = { median: 100, p25: 80, p75: 120, n: 24, confidence: "good" };
  const p = R.offerPlan({ price: 120 }, m);
  assert.equal(p.open, 90);
  assert.equal(p.walkAway, 100);
  assert.match(p.reasons[0], /\$80–\$120 \(24 sales\)/);
  // a soft seller opens at the cheaper quarter
  assert.equal(R.offerPlan({ price: 120, soft: "likely" }, m).open, 80);
  // shipping comes off: the offer is for the item
  const s = R.offerPlan({ price: 110, shipping: 10 }, m);
  assert.deepEqual([s.open, s.walkAway], [80, 90]);
  // never under 60% of asking, never above the walk-away
  assert.equal(R.offerPlan({ price: 400 }, m).open, 100);
  assert.equal(R.offerPlan({ price: 400 }, m).walkAway, 100);
  // already cheap: no haggling advice
  assert.equal(R.offerPlan({ price: 75 }, m).cheap, true);
  // nothing solid to go on
  for (const bad of [{ price: 120, auction: true }, { price: 120, lot: 4 }, { price: 120, project: "for parts" }, { price: null }]) assert.equal(R.offerPlan(bad, m), null);
  assert.equal(R.offerPlan({ price: 120 }, null), null);
});

test("counterOffer: take it, meet in the middle, or a last offer at the walk-away price", () => {
  const plan = { open: 240, walkAway: 300 };
  assert.deepEqual(R.counterOffer(plan, 230), { action: "accept", amount: 230, why: "that's at or under your opening offer" });
  assert.equal(R.counterOffer(plan, 250).action, "accept"); // too close to haggle over
  assert.deepEqual(R.counterOffer(plan, 290), { action: "counter", amount: 260, why: "it's under your walk-away price, and meeting in the middle saves $30" });
  assert.deepEqual(R.counterOffer(plan, 320), { action: "last", amount: 300, why: "it's over your walk-away price of $300" });
  // a few dollars apart isn't worth another round
  assert.equal(R.counterOffer({ open: 90, walkAway: 100 }, 98).action, "accept");
  // the same price to open and walk away at: anything over it gets that price once
  assert.deepEqual(R.counterOffer({ open: 100, walkAway: 100 }, 110), { action: "last", amount: 100, why: "it's over your walk-away price of $100" });
  for (const [p, t] of [[null, 100], [plan, 0], [plan, "abc"], [{ open: 0 }, 50]]) assert.equal(R.counterOffer(p, t), null);
  assert.equal(R.counterOffer(plan, "290").amount, 260); // straight from a text field
});

test("fitOffer keeps the analysis's range near the plan from sold prices", () => {
  const plan = { open: 240, walkAway: 300, confidence: "good" };
  assert.deepEqual(R.fitOffer(250, 280, plan), [250, 280]); // inside: as the model said
  assert.deepEqual(R.fitOffer(150, 200, plan), [210, 210]); // far under: up to 90% of the opening offer
  assert.deepEqual(R.fitOffer(280, 400, plan), [280, 300]); // never past the walk-away price
  assert.deepEqual(R.fitOffer(0, 0, plan), [0, 0]); // no haggling: left alone
  assert.deepEqual(R.fitOffer(150, 200, { ...plan, confidence: "rough" }), [150, 200]);
  assert.deepEqual(R.fitOffer(150, 200, null), [150, 200]);
  assert.deepEqual(R.fitOffer(150, 200, { cheap: true }), [150, 200]);
});

test("counterMessage: what to send back, per site", () => {
  assert.equal(R.counterMessage({ action: "accept", amount: 250 }, { local: true }), "Deal, $250 works for me. When can I pick it up?");
  assert.equal(R.counterMessage({ action: "counter", amount: 260 }), "Thanks! Could we meet in the middle at $260?");
  assert.equal(R.counterMessage({ action: "last", amount: 300 }), "Thanks, but $300 is the most I can do. Let me know if that works.");
  assert.equal(R.counterMessage({ action: "counter", amount: 260 }, { site: "ebay", bestOffer: true }), "Counter with $260 on eBay's offer page.");
  assert.equal(R.counterMessage(null), "");
});

test("roundOffer rounds down to friendly amounts", () => {
  assert.deepEqual([12.7, 47, 99, 101, 249].map(R.roundOffer), [12, 45, 95, 100, 240]);
});

test("offerMessages: templates per site", () => {
  const local = R.offerMessages(80, { local: true });
  assert.equal(local.length, 3);
  assert.match(local[0].text, /^Hi! Is this still available\? Would you take \$80\? I can pick up/);
  assert.equal(R.offerMessages(80, { site: "ebay", bestOffer: true })[0].button, true);
  assert.doesNotMatch(R.offerMessages(80, { site: "ebay" })[0].text, /pick up/);
  assert.deepEqual(R.offerMessages(0), []);
});

test("hashDistance counts the bits two photo fingerprints differ in", () => {
  assert.equal(R.hashDistance("00ff00ff00ff00ff", "00ff00ff00ff00ff"), 0);
  assert.equal(R.hashDistance("00ff00ff00ff00ff", "01ff00ff00ff00fe"), 2);
  assert.equal(R.hashDistance("ffffffffffffffff", "0000000000000000"), 64);
  assert.equal(R.hashDistance("", "00ff00ff00ff00ff"), 64);
  assert.equal(R.hashDistance("not a hash at all", "00ff00ff00ff00ff"), 64);
});

test("photoTwins: the same picture under other titles counts; the same file or the same title doesn't", () => {
  const seen = {
    "fb:1": { h: "00ff00ff00ff00ff", f: "111_n", t: "pentax k1000 film camera" },
    "fb:2": { h: "00ff00ff00ff00fe", f: "222_n", t: "canon ae 1 slr" }, // the same picture, re-uploaded, another title
    "fb:3": { h: "00ff00ff00ff00ff", f: "111_n", t: "pentax k1000 working" }, // the same file: the seller's own relist
    "fb:4": { h: "00ff00ff00ff00ff", f: "444_n", t: "pentax k1000 film camera" }, // the same title: a repost, marked elsewhere
    "fb:5": { h: "ff00ff00ff00ff00", f: "555_n", t: "yashica fx 3" }, // another picture
    "fb:6": { h: "0fff00ff00ff00f0", f: "666_n", t: "minolta x 700" }, // 8 bits off: not the same
  };
  assert.deepEqual(R.photoTwins("fb:1", seen), ["fb:2"]);
  assert.deepEqual(R.photoTwins("fb:2", seen), ["fb:1", "fb:3", "fb:4"]);
  assert.deepEqual(R.photoTwins("fb:5", seen), []);
  assert.deepEqual(R.photoTwins("fb:9", seen), []);
});

test("photoFile: one name for a photo across its sizes", () => {
  assert.equal(R.photoFile("https://i.ebayimg.com/images/g/AbC123/s-l500.jpg"), "AbC123");
  assert.equal(R.photoFile("https://i.ebayimg.com/images/g/AbC123/s-l1600.webp"), "AbC123");
  assert.equal(R.photoFile("https://scontent-den2-1.xx.fbcdn.net/v/t45.5328-4/4567_8910_n.jpg?stp=c0.43&_nc_cat=1"), "4567_8910_n");
  assert.equal(R.photoFile("not a url"), "");
});

test("offTopic: the clutter of a browse feed, not ordinary items", () => {
  const off = (title, price = 40) => R.offTopic({ title, price });
  assert.equal(off("Looking for rental house edge of town", 1), "wanted post");
  assert.equal(off("ISO Nintendo DS charger"), "wanted post");
  assert.equal(off("\"Best Massage in Town – Feel the difference\""), "service");
  assert.equal(off("3 bed 2 bath house for rent"), "rental");
  assert.equal(off("Room for rent near UNM"), "rental");
  assert.equal(off("Now hiring cooks"), "job");
  assert.equal(off("Kittens free to good home", 0), "pets");
  assert.equal(off("Stolen and sold", 1), "$1 placeholder");
  // Ordinary listings, including ones that share a word with the clutter
  assert.equal(off("Nintendo Wii console FOR PARTS", 8), "");
  assert.equal(off("Kitten supplies (30$)", 30), "");
  assert.equal(off("Apartment size refrigerator"), "");
  assert.equal(off("Massage chair, works great", 120), "", "a massage chair is an item");
  assert.equal(off("Free couch", 0), "");
  assert.equal(off("Rental-grade ski boots"), "rental", "known miss, kept simple");
});

test("freeRead: one word before any AI, from sold prices and scam signs", () => {
  const m = { median: 100, n: 20, confidence: "good" };
  const word = (f) => R.freeRead({ title: "Pentax K1000", price: f.total, ...f }, m)?.word ?? null;
  assert.equal(word({ total: 70, vsSold: 0.7 }), "Good price");
  assert.equal(word({ total: 58, vsSold: 0.58 }), "Great price");
  assert.equal(word({ total: 50, vsSold: 0.5 }), "Check first", "too cheap for what sold is a warning, not a bargain");
  assert.equal(word({ total: 30, vsSold: 0.3 }), "Likely scam");
  assert.equal(word({ total: 100, vsSold: 1 }), "Fair price");
  assert.equal(word({ total: 150, vsSold: 1.5 }), "Over sold price");
  assert.equal(word({ total: 70, vsSold: 0.7, sellerWarn: "New seller" }), "Check first");
  assert.equal(word({ total: 70, campaign: ["A1"] }), "Likely scam");
  assert.equal(word({ total: 70 }), null, "nothing to go on");
  assert.equal(word({ total: 35, vsSold: 0.12, project: "for parts" }), null, "broken ones are cheap for a reason");
  assert.equal(R.freeRead({ title: "Room for rent", price: 700 })?.word, "Off-topic");
});

test("vsText: under or over sold, in dollars", () => {
  assert.equal(R.vsText(97, 150), "$53 under sold");
  assert.equal(R.vsText(170, 150), "$20 over sold");
  assert.equal(R.vsText(152, 150), "about the sold price");
  assert.equal(R.vsText(97, 150, { long: true }), "$53 under the sold median");
  assert.equal(R.vsText(97, 150, { rough: true }), "~$53 under sold");
  assert.equal(R.vsText(97, 150, { est: true }), "~$53 under typical (est.)");
  assert.equal(R.vsText(97, 0), "");
  assert.ok(R.SOLD_CHIP.test("Good price · $53 under sold") && !R.SOLD_CHIP.test("Too cheap? Sold ones go for $300"));
});
