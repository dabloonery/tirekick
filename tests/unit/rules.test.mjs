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

test("quickReason: Hide accessories drops games, cases and parts for the search, not the thing itself", () => {
  const q = { words: "", min: 0, max: 0, fresh: false, broken: "", parts: true };
  const why = (title) => R.quickReason({ title, total: 50 }, q, "nintendo switch oled");
  assert.match(why("Case for Nintendo Switch OLED"), /^accessory or part: /);
  assert.match(why("Mario Kart 8 Deluxe - Nintendo Switch"), /^accessory or part: /);
  assert.equal(why("Nintendo Switch OLED White"), "");
  assert.equal(why("Nintendo Switch OLED + 3 games + case"), "", "a console that comes with games is the thing");
  assert.equal(R.quickReason({ title: "Case for Nintendo Switch OLED", total: 5 }, q, ""), "", "no search: nothing to be an accessory of");
  assert.equal(R.quickReason({ title: "Case for Nintendo Switch OLED", total: 5 }, { ...q, parts: false }, "nintendo switch oled"), "");
});

test("likelyScam and isDeal", () => {
  assert.equal(R.likelyScam({ campaign: ["K7731"] }), true);
  assert.equal(R.likelyScam({ titleCode: "M2465" }), false, "a code alone may be the model number (T480, QC35)");
  assert.equal(R.likelyScam({ titleCode: "M2465", cheap: "low" }), true, "a code and a bait price");
  assert.equal(R.likelyScam({ titleCode: "M2465", photoTwins: 2 }), true, "a code and a reused photo");
  assert.equal(R.likelyScam({ titleCode: "M2465", sellerWarn: "Account made in 2026" }), true, "a code and a new account");
  assert.equal(R.likelyScam({ titleCode: "M2465", cheap: "far", codeOk: true }), false, "a scan cleared the code");
  assert.equal(R.codeBacked({ titleCode: "M2465", sellerWarn: "Seller: 2 ratings" }), "a seller with 2 ratings");
  assert.equal(R.codeBacked({ titleCode: "M2465", sellerWarn: "Account made in 2026" }), "account made in 2026");
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
  assert.equal(R.tooCheap({ total: 15, accessory: "case" }, m), null, "an accessory for the search isn't the thing");
  assert.equal(R.tooCheap({ total: 15, related: false }, m), null, "nor is what a scan called a different item");
});

test("a price range ($12.99 to $59.99) isn't compared: its low end may be another version", () => {
  const m = { median: 200, p25: 170, p75: 230, n: 20, confidence: "good" };
  const f = { title: "Nintendo Switch OLED console", total: 13, price: 13, priceRange: true };
  assert.equal(R.tooCheap(f, m), null);
  assert.equal(R.compareFacts({ ...f }, m, "nintendo switch oled"), null, "no share of the typical price, so no price word");
  assert.deepEqual(R.priceVerdict("great", { ...f, score: 80 }, m), { v: "great" }, "a scan's verdict isn't turned into Likely scam");
  assert.equal(R.priceVerdict("great", { total: 400, priceRange: true, score: 80 }, m).v, "great", "nor held at Fair by its low end");
  assert.equal(R.offerPlan({ price: 13, priceRange: true }, m), null, "no offer on an unknown version");
});

test("accessoryOf: an accessory or part for what was searched, not the thing itself", () => {
  const yes = [
    ["nintendo switch", "Case for Nintendo Switch"], ["nintendo switch", "Nintendo Switch Carrying Case"], ["nintendo switch", "Nintendo Switch Pro Controller"],
    ["nintendo switch", "Nintendo Switch Dock"], ["nintendo switch", "Nintendo Switch box only"], ["nintendo switch", "Nintendo Switch empty box"],
    ["nintendo switch", "Tempered glass screen protector Nintendo Switch"], ["iphone 12", "iPhone 12 case"], ["iphone 12", "iPhone 12 replacement screen"],
    ["game boy sp", "Game Boy SP charger"], ["game boy sp", "Game Boy Advance SP replacement shell"], ["dewalt drill", "DeWalt 20V MAX battery"],
    ["pentax k1000", "Pentax K1000 lens cap"], ["ps5", "Sony PS5 DualSense Controller"], ["apple watch", "Apple Watch charger"], ["nikon d3100", "Nikon D3100 manual"],
    ["ipod classic", "iPod classic battery"], ["ipod classic", "New battery for iPod classic"], ["ipod classic", "Apple iPod Classic 4th Generation 40GB Empty Box Only"],
  ];
  for (const [q, t] of yes) assert.ok(R.accessoryOf(t, q), `${t} (search: ${q})`);
  const no = [
    ["nintendo switch", "Nintendo Switch OLED with Carrying Case"], ["nintendo switch", "Nintendo Switch Console + 2 Controllers"], ["nintendo switch", "Nintendo Switch V2 Neon 32GB"],
    ["nintendo switch", "Nintendo Switch in box"], ["switch case", "Nintendo Switch Carrying Case"], ["iphone 12", "Apple iPhone 12 64GB Black Unlocked"],
    ["game boy sp", "Nintendo Game Boy Advance SP AGS-001 Cobalt Blue Working"], ["game boy sp", "Game Boy Advance SP Pearl Blue w/ charger"],
    ["dewalt drill", "DeWalt 20V MAX drill with 2 batteries"], ["pentax k1000", "Pentax K1000 35mm film camera with 50mm lens"], ["pentax k1000", "Pentax K1000 with 50mm f/2 lens and case"],
    ["ps5", "PS5 Console Disc Edition"], ["xbox one", "Xbox One S 1TB Console"], ["nikon d3100", "Nikon D3100 body only"], ["", "Case for Nintendo Switch"],
    ["nintendo switch oled", "Nintendo Switch OLED white + 3 games + case"], ["ps5", "PS5 Slim & extra controller"],
    // a battery put in it (a real iPod search, 2026-10): 12 of 60 cards end like this
    ["ipod classic 5.5", "APPLE iPOD CLASSIC 7TH GEN. GRAY 120GB...NEW BATTERY..."], ["ipod classic 5.5", "APPLE iPOD CLASSIC 5.5th Atomic Ocean Blue 512gb SSD Wolfson DAC Battery"],
    ["ipod classic 5.5", "Apple iPod 5th Video Black - A1136 - 256GB Flash Storage + 3000mAh Battery"], ["ipod classic 5.5", "Apple iPod Classic 5th Gen Wolfson DAC 30GB Original Rebuild 850mAh Battery"],
  ];
  for (const [q, t] of no) assert.equal(R.accessoryOf(t, q), "", `${t} (search: ${q})`);
  assert.equal(R.accessoryOf("Case for Nintendo Switch", "nintendo switch"), "case", "says which word gave it away");
});

test("accessoryOf: a game named after the console it's for", () => {
  const yes = [
    ["nintendo switch", "Mario Kart 8 Deluxe - Nintendo Switch"], ["nintendo switch", "Mario Kart 8 Deluxe Nintendo Switch"],
    ["nintendo switch", "The Legend of Zelda: Breath of the Wild (Nintendo Switch, 2017)"], ["nintendo switch", "Minecraft for Nintendo Switch"],
    ["nintendo switch", "Super Mario Odyssey Nintendo Switch game cartridge only"], ["nintendo switch", "Pokemon Scarlet Nintendo Switch Video Game"],
    ["nintendo switch", "Pokemon Violet - Nintendo Switch - NEW SEALED"], ["ps5", "Spider-Man 2 - PS5"], ["ps5", "God of War Ragnarok - PS5 (2022)"],
    ["xbox series x", "Halo Infinite (Xbox Series X)"], ["nintendo switch", "Animal Crossing New Horizons Nintendo Switch"],
    ["nintendo switch oled", "Mario Kart 8 Deluxe - Nintendo Switch"],
  ];
  for (const [q, t] of yes) assert.ok(R.accessoryOf(t, q), `${t} (search: ${q})`);
  assert.equal(R.accessoryOf("Mario Kart 8 Deluxe - Nintendo Switch", "nintendo switch"), "mario kart 8 deluxe", "says what it names");
  // The thing itself, and bait that copies the search's words first, stay priced.
  const no = [
    ["nintendo switch", "Nintendo Switch OLED - White"], ["nintendo switch", "Brand New - Nintendo Switch OLED Console"], ["nintendo switch", "Nintendo Switch console - fast shipping"],
    ["nintendo switch", "Nintendo Switch (V2) Neon 32GB"], ["nintendo switch", "Nintendo Switch Lite Coral - like new"], ["nintendo switch", "Neon - Nintendo Switch"],
    ["nintendo switch", "Nintendo Switch with 3 games"], ["nintendo switch", "Super cheap deal - Nintendo Switch"], ["nintendo switch", "Jailbroken Modded Nintendo Switch"],
    ["nintendo switch", "Brand New Sealed Nintendo Switch"], ["nintendo switch", "Neon Red Blue 32GB Nintendo Switch"], ["nintendo switch", "Nintendo Switch video game console"],
    ["ps5", "PS5 Slim Disc Console"], ["ps5", "Sony PlayStation 5 (PS5) Disc Edition"], ["ps5", "Sony - PS5 Console"], ["iphone 13", "Apple - iPhone 13"],
    ["iphone 13", "Unlocked - Apple iPhone 13 128GB"], ["iphone 13", "Apple iPhone 13 - 128GB - Midnight (Unlocked)"], ["pentax k1000", "Pentax K1000 35mm (with 50mm lens)"],
    ["pentax k1000", "Vintage Film Camera Pentax K1000"], ["game boy", "Nintendo Game Boy DMG-01 Console"],
  ];
  for (const [q, t] of no) assert.equal(R.accessoryOf(t, q), "", `${t} (search: ${q})`);
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
  assert.match(p.reasons[0], /\$80–\$120 \(24 recent eBay sales\)/);
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
  assert.equal(word({ total: 150, vsSold: 1.5 }), "Above typical");
  assert.equal(word({ total: 70, vsSold: 0.7, sellerWarn: "New seller" }), "Check first");
  assert.equal(word({ total: 70, campaign: ["A1"] }), "Likely scam");
  assert.equal(word({ total: 70, vsSold: 0.7, titleCode: "T480" }), "Check first", "a code alone: maybe the model number");
  assert.equal(word({ total: 50, vsSold: 0.5, titleCode: "M2465" }), "Likely scam", "a code and a price under typical");
  assert.equal(word({ total: 70, vsSold: 0.7, titleCode: "T480", codeOk: true }), "Good price", "cleared by a scan");
  assert.equal(word({ total: 70 }), null, "nothing to go on");
  assert.equal(word({ total: 35, vsSold: 0.12, project: "for parts" }), null, "broken ones are cheap for a reason");
  assert.equal(R.freeRead({ title: "Room for rent", price: 700 })?.word, "Off-topic");
});

test("bestPlace: best first without a score is shelves, then the price against typical", () => {
  const m = { median: 250, n: 20, confidence: "good" };
  const q = "nintendo switch oled";
  // The real Switch OLED page's free read (tests/e2e/real.ts), in the store's order.
  const page = [
    { title: "Nintendo Switch OLED Model White Console HEG", total: 239, vsSold: 239 / 250 },
    { title: "Nintendo Switch OLED Neon Joy-Con, barely used", total: 211, vsSold: 211 / 250 },
    { title: "Mario Kart 8 Deluxe - Nintendo Switch", total: 43, accessory: "nintendo switch" },
    { title: "Nintendo Switch OLED carrying case", total: 15, accessory: "case" },
    { title: "Nintendo Switch OLED for parts, no power", total: 105, vsSold: 105 / 250, project: "for parts" },
    { title: "Nintendo Switch OLED Mario Red Edition", total: 175, auction: true },
    { title: "Lot of 2 Nintendo Switch OLED consoles", total: 420, lot: 2 },
    { title: "Nintendo Switch OLED 64GB White - NEW SEALED", total: 329, vsSold: 329 / 250 },
    { title: "Nintendo Switch OLED white + 3 games + case", total: 265, vsSold: 265 / 250 },
    { title: "Switch OLED console only (no dock), tested", total: 160, vsSold: 160 / 250 },
    { title: "Nintendo Switch OLED Splatoon 3 Edition", total: 200, vsSold: 0.8, sellerWarn: "3 ratings" },
  ].map((f) => ({ price: f.total, ...f }));
  const order = (opts) => page.map((f) => [f, R.bestPlace(f, m, { query: q, ...opts })]).sort((a, b) => R.bestCompare(a[1], b[1])).map(([f]) => f.title.slice(0, 24));
  assert.deepEqual(order(), [
    "Switch OLED console only", // Good price, 64% of typical
    "Nintendo Switch OLED Neo", // Fair, $211 before the $239 one: further below
    "Nintendo Switch OLED Mod",
    "Nintendo Switch OLED Mar", // your search with nothing to compare: the store's order
    "Lot of 2 Nintendo Switch",
    "Nintendo Switch OLED whi", // above typical, the closest first
    "Nintendo Switch OLED 64G",
    "Nintendo Switch OLED for", // broken
    "Mario Kart 8 Deluxe - Ni", // not the console
    "Nintendo Switch OLED car",
    "Nintendo Switch OLED Spl", // a warning
  ]);
  assert.equal(order({ broken: true }).indexOf("Nintendo Switch OLED for"), 3, "a reseller who wants broken ones keeps it with the search");
  // Price marks off: no shelf by a price the list doesn't show, so the store's order, parts and warnings under it.
  assert.deepEqual(order({ prices: false }).slice(0, 7), ["Nintendo Switch OLED Mod", "Nintendo Switch OLED Neo", "Nintendo Switch OLED Mar", "Lot of 2 Nintendo Switch", "Nintendo Switch OLED 64G", "Nintendo Switch OLED whi", "Switch OLED console only"]);
  assert.equal(R.bestPlace({ title: "Adjustable Dumbbells 4-44 lbs", total: 150, price: 150 }, m, { query: "dumbells" }).shelf, 1, "a search word spelled a letter off is still the search");
  assert.equal(R.spelledNear("Dumbbell Set", "dumbells"), true);
  assert.equal(R.spelledNear("Barbells", "dumbells"), false);
  assert.equal(R.spelledNear("Bose SoundLink speaker", "ipod classic"), false);
  assert.equal(R.bestPlace({ title: "Bose SoundLink speaker", total: 80, price: 80 }, m, { query: "ipod classic" }).why, "not your search");
  assert.equal(R.bestPlace({ title: "iPod classic 160GB", total: 30, price: 30, vsSold: 0.3 }, m, { query: "ipod classic" }).shelf, 6, "Likely scam");
  const drop = R.bestPlace({ title: "iPod classic", total: 90, price: 90, drop: 20 }, null, { query: "ipod classic" });
  const plain = R.bestPlace({ title: "iPod classic", total: 80, price: 80 }, null, { query: "ipod classic" });
  assert.ok(R.bestCompare(drop, plain) < 0, "a price drop goes first among ones with nothing to compare");
  assert.equal(R.bestCompare(plain, { ...plain }), 0, "ties keep the store's order");
});

test("vsText: below or above typical, in dollars", () => {
  assert.equal(R.vsText(97, 150), "$53 below typical");
  assert.equal(R.vsText(170, 150), "$20 above typical");
  assert.equal(R.vsText(152, 150), "about typical");
  assert.equal(R.vsText(97, 150, { long: true }), "$53 below the typical price");
  assert.equal(R.vsText(97, 150, { rough: true }), "~$53 below typical");
  assert.equal(R.vsText(97, 150, { est: true }), "~$53 below typical (est.)");
  assert.equal(R.vsText(97, 0), "");
  assert.ok(R.SOLD_CHIP.test("Good price · $53 below typical") && !R.SOLD_CHIP.test("Too cheap? Typical is $300"));
  assert.equal(R.vsText(105, 252, { working: true }), "$147 below working ones", "a broken one is set against working ones, and says so");
  assert.equal(R.vsText(105, 252, { working: true, long: true }), "$147 below the typical price of a working one");
  assert.ok(R.SOLD_CHIP.test("$147 below working ones"));
});

test("priceVerdict: when score and price disagree, the price check wins", () => {
  const m = { median: 300, confidence: "good" };
  const pick = ({ v, label }) => (label ? { v, label } : { v });
  assert.deepEqual(pick(R.priceVerdict("great", { total: 85 }, m)), { v: "suspicious", label: "Great price, if it’s real" });
  assert.deepEqual(pick(R.priceVerdict("good", { total: 295 * 1.3 }, m)), { v: "fair" }, "well above typical: no better than Fair");
  assert.deepEqual(R.priceVerdict("great", { total: 250 }, m), { v: "great" }, "a fair gap keeps the score's verdict");
  assert.deepEqual(R.priceVerdict("pass", { total: 85 }, m), { v: "pass" });
  assert.deepEqual(R.priceVerdict("great", { total: 85, auction: true }, m), { v: "great" }, "a bid isn't a price");
  assert.deepEqual(R.priceVerdict("great", { total: 85 }, { median: 300, confidence: "rough" }), { v: "great" }, "only a trusted typical price");
  assert.deepEqual(R.priceVerdict("great", { total: 85 }, null), { v: "great" });
  assert.deepEqual(R.priceVerdict("good", { total: 15, related: false }, m), { v: "good" }, "a scan's 'not your search' isn't compared with the search's price");
  assert.deepEqual(R.priceVerdict("good", { total: 500, related: false }, m), { v: "good" }, "…either way");
  assert.deepEqual(R.priceVerdict("good", { total: 15, accessory: "case" }, m), { v: "good" }, "nor is an accessory");

  // When the verdict moves, the number moves with it and the reason says why (the "Switch OLED" search in real.ts).
  const bait = R.priceVerdict("great", { total: 89, score: 91 }, { median: 252, confidence: "good" });
  assert.equal(bait.score, 30, "a 91 on the bait reads 30, inside the warning's range");
  assert.match(bait.why, /^\$89 is 35% of the typical \$252\. Far under/);
  const dear = R.priceVerdict("great", { total: 329, score: 82 }, { median: 252, confidence: "good" });
  assert.deepEqual([dear.v, dear.score], ["fair", 59], "an 82 held at Fair price reads 59");
  assert.equal(dear.why, "Held at Fair price: $329 is 131% of the typical $252.");
  assert.equal(R.priceVerdict("good", { total: 239, score: 70 }, { median: 252, confidence: "good" }).score, undefined, "an unchanged verdict keeps the model's score");
});

test("missingWord: the first word of the search a title leaves out", () => {
  assert.equal(R.missingWord("Mario Kart 8 Deluxe - Nintendo Switch", "nintendo switch oled"), "oled");
  assert.equal(R.missingWord("Nintendo Switch OLED Model White", "nintendo switch oled"), "");
  assert.equal(R.missingWord("Pentax K-1000 35mm SLR", "pentax k1000"), "", "spacing and hyphens don't count");
  assert.equal(R.missingWord("Nintendo Switch Joy-Con", "nintendo switch joycons"), "", "nor a plural");
  assert.equal(R.missingWord("Nintendo Switch OLED", "nintendo switch -case"), "", "nor a word the search leaves out");
  assert.equal(R.missingWord("Lot of 3 Game Boy games", "a game boy"), "", "nor short words");
  assert.equal(R.missingWord("", "pentax"), "");
});

test("offSearch: none of the search's words in the title, so its price isn't compared with the search's", () => {
  for (const t of ["Phone", "Bose soundlink", "Portable DVD PLAYER", "Polaroid Snap"]) assert.ok(R.offSearch(t, "ipod classic"), t);
  for (const t of ["Apple iPod Touch 4th Generation 32GB", "MagSafe Charger I phones I pods", "Apple Ipod Classic 6th Generation Silver (80 Gb)"]) assert.equal(R.offSearch(t, "ipod classic"), false, t);
  assert.equal(R.offSearch("Phone", ""), false, "no search, nothing to miss");
  assert.equal(R.offSearch("Phone", "-case"), false, "only words left out");
  // A two-letter search, from a real "ds" search on Marketplace: a word of its own, not part of another.
  for (const t of ["DVDs", "PlayStation 3", "Garage sale", "Zebra DS22 Wired Scanner", "Razer Base Station V2 Chroma"]) assert.ok(R.offSearch(t, "ds"), t);
  for (const t of ["Pink Nintendo DS Lite", "Nintendo DSi", "3ds", "INSTRUCTION BOOKLETS(GAMEBOY,DS)", "Story of Seasons – Nintendo 3DS"]) assert.equal(R.offSearch(t, "ds"), false, t);
  const f = { title: "Shokz", total: 50 };
  assert.equal(R.compareFacts(f, { median: 100, confidence: "good" }, "ipod classic"), null);
  assert.equal(R.freeRead(f, { median: 100, confidence: "good" }), null, "no Great price for headphones in an iPod search");
  const g = { title: "Zelda game", total: 15 };
  R.compareFacts(g, { median: 100, confidence: "good" }, "ipod classic");
  assert.equal(R.freeRead(g, { median: 100, confidence: "good" }), null, "nor Check first for a $15 game");
});

test("tooCheap: a title missing a search word is Check first, not Likely scam", () => {
  const m = { median: 252, confidence: "good" };
  assert.equal(R.tooCheap({ total: 42.99 }, m).level, "far");
  assert.equal(R.tooCheap({ total: 42.99, offWords: "oled" }, m).level, "low", "Mario Kart in a Switch OLED search");
  assert.equal(R.tooCheap({ total: 200, offWords: "oled" }, m), null);
});

test("broadQuery: a store category is too broad to price, a model isn't", () => {
  for (const q of ["Electronics", "electronics", "Video Games & Consoles", "Home & Garden", "Cell Phones & Accessories", "stuff"]) assert.equal(R.broadQuery(q), true, q);
  for (const q of ["", "pentax k1000", "ps2 slim", "electronics lot", "game boy", "vintage watch"]) assert.equal(R.broadQuery(q), false, q);
});

test("placeholder and far-off prices get no dollar comparison (real-site check, 0.49.1)", () => {
  for (const p of [1, 1234, 12345, 123456, 1111, 99999]) assert.equal(R.placeholderPrice(p), true, `${p}`);
  for (const p of [0.99, 2, 70, 120, 2345, 9999, 5555, 1250]) assert.equal(R.placeholderPrice(p), false, `${p}`);
  assert.equal(R.tooFarToCompare(12345, 82), true);
  assert.equal(R.tooFarToCompare(1700, 82), true, "20 times the typical price is a different item");
  assert.equal(R.tooFarToCompare(150, 82), false);
  assert.equal(R.offTopic({ title: "Nook e-reader", price: 12345 }), "placeholder price");
  assert.equal(R.offTopic({ title: "Nook e-reader", price: 45 }), "");
});

test("an analysis that read the web address clears 'Contact outside the site?' (real-site check, 0.49.1)", () => {
  const plain = { offSite: { sure: false, why: ["web address “example.org”"] } };
  assert.equal(R.freeRead(plain)?.word, "Check first");
  assert.equal(R.freeRead({ ...plain, offSiteOk: true }), null);
  assert.equal(R.freeRead({ offSite: { sure: true, why: [] }, offSiteOk: true })?.word, "Likely scam", "a disguised address stays a scam sign");
  assert.equal(R.sellerWarning({ sellerCount: 1 }, { minSellerRatings: 10, minSellerPct: 97 }), "Seller: 1 rating");
});

test("the scan prompt's price lines are the cards' (priceWord, TOO_CHEAP)", async () => {
  const bg = await (await import("node:fs/promises")).readFile(new URL("../../background.js", import.meta.url), "utf8");
  const line = bg.match(/const PRICE_BANDS = `([^`]+)`/)?.[1] || "";
  assert.match(line, /60% or less is a great price, up to 80% good, up to 105% fair/);
  assert.match(line, /under 55% with no reason given is too cheap/);
  // The 55% rule leans on the price check's own note, so a price the check cleared (sales go that low, pickup, an
  // established seller) isn't bait to the model either: the note and the rule must name it the same way.
  const note = bg.match(/it\.cheapPct > 0 && `(the total is )\$\{it\.cheapPct\}(% of the typical price)/);
  assert.ok(note, "scamNotes says the cheap share");
  assert.ok(line.includes(`"${note[1]}N${note[2]}"`), "PRICE_BANDS names that note");
  assert.match(line, /without that signal, the price check has already cleared the price/);
  assert.equal(R.priceWord(0.6).v, "great");
  assert.equal(R.priceWord(0.8).v, "good");
  assert.equal(R.priceWord(1.05).v, "fair");
  assert.equal(R.priceWord(1.06).v, "pass");
  assert.equal(R.TOO_CHEAP.low, 0.55);
  for (const base of ["RANK_BASE", "ITEM_BASE"]) assert.match(bg.match(new RegExp(`const ${base} = \`[^\`]+\``))?.[0] || "", /\$\{PRICE_BANDS\}[\s\S]*\$\{OFFSITE_RULE\}/, base);
  // A listing selling several versions isn't a scam on its own (both prompts).
  for (const base of ["RANK_BASE", "ITEM_BASE"]) assert.match(bg.match(new RegExp(`const ${base} = \`[^\`]+\``))?.[0] || "", /\$\{VERSIONS_RULE\}/, base);
  assert.doesNotMatch(bg, /keyword-stuffed titles/, "no longer a red flag by itself");
  // Praise for big sellers read as a scam sign for small ones: a new seller's console-only at 47% turned suspicious.
  const versions = bg.match(/const VERSIONS_RULE = `([^`]+)`/)?.[1] || "";
  assert.match(versions, /Few ratings alone don't make one likely/);
  assert.match(versions, /Far lower, or with anything else odd, it's still bait/);
});

test("forPickup: a pickup listing is compared without the shipping in eBay's totals", () => {
  const m = { median: 52, p25: 45, p75: 60, n: 20, confidence: "good", ship: 12 };
  assert.deepEqual(R.forPickup(m, { shipping: null }, true), { ...m, median: 40, p25: 33, p75: 48, pickupShip: 12, local: true });
  assert.equal(R.forPickup({ ...m, p10: 30 }, { shipping: null }, true).p10, 18, "the cheapest tenth comes down by the shipping too");
  assert.equal(R.forPickup(m, { shipping: null }, false), m, "only on a local site");
  assert.equal(R.forPickup(m, { shipping: 0 }, true), m, "a listing that ships (free) keeps the totals");
  assert.equal(R.forPickup(m, { shipping: null, auction: true }, true), m);
  assert.equal(R.forPickup({ ...m, ship: null }, { shipping: null }, true).median, 52, "no shipping known from the sales");
  assert.equal(R.forPickup({ ...m, ship: null }, { shipping: null }, true).local, true, "still a pickup listing");
  assert.equal(R.forPickup({ ...m, median: 20 }, { shipping: null }, true).median, 20, "shipping over half the price isn't trusted");
  assert.equal(R.forPickup(null, {}, true), null);
  assert.equal(R.tooCheap({ total: 18 }, R.forPickup(m, { shipping: null }, true)).level, "low", "$18 is 45% of $40, not a 35% bait price");
});

test("codeInSearch: a title code that is the searched model number isn't a scammer's code", () => {
  assert.equal(R.codeInSearch("DCD771C2", "dewalt dcd771"), true);
  assert.equal(R.codeInSearch("A2337", "macbook air a2337"), true);
  assert.equal(R.codeInSearch("M2465", "nintendo switch oled"), false);
  assert.equal(R.codeInSearch("K7Q2", "k7q2x"), true, "the search starts with it");
  assert.equal(R.codeInSearch("U2X5", "ps5 console"), false, "a word needs letters and digits and 4 or more");
  assert.equal(R.codeInSearch("ABC1", ""), false);
});

test("tooCheap: under the softer cutoff from a seller with a warning is far, unless the title says what's missing", () => {
  const m = { median: 252, confidence: "good" };
  assert.deepEqual(R.tooCheap({ title: "Nintendo Switch OLED Console", total: 110, sellerCount: 0 }, m), { level: "far", pct: 44, seller: "a new seller" });
  assert.deepEqual(R.tooCheap({ title: "Nintendo Switch OLED Console", total: 110 }, m), { level: "low", pct: 44 });
  assert.deepEqual(R.tooCheap({ title: "Nintendo Switch OLED - missing Joy-Cons", total: 110, sellerCount: 4 }, m), { level: "low", pct: 44, why: "missing joy-cons" });
  assert.deepEqual(R.tooCheap({ title: "Switch OLED", total: 110, sellerCount: 0, offWords: "nintendo" }, m), { level: "low", pct: 44 }, "a title missing a search word stays low");
  assert.equal(R.tooCheap({ title: "Nintendo Switch OLED", total: 229, sellerCount: 0 }, m), null, "a new seller at a normal price isn't too cheap");
  const pv = R.priceVerdict("great", { title: "Nintendo Switch OLED", total: 110, sellerCount: 0, score: 90 }, m);
  assert.equal(pv.v, "suspicious");
  assert.match(pv.why, /from a new seller\. /);
});

test("riskySeller: only a strong seller sign makes a low price Likely scam", () => {
  const now = Date.UTC(2026, 9, 22);
  assert.equal(R.riskySeller({ sellerCount: 0 }, now), "a new seller");
  assert.equal(R.riskySeller({ sellerCount: 1 }, now), "a seller with 1 rating");
  assert.equal(R.riskySeller({ sellerCount: 4, sellerPct: 100 }, now), "a seller with 4 ratings");
  assert.equal(R.riskySeller({ sellerCount: 6, sellerPct: 100 }, now), "", "a small honest seller: your warning, not the mark");
  assert.equal(R.riskySeller({ sellerCount: 400, sellerPct: 94.1 }, now), "a seller at 94.1% positive");
  assert.equal(R.riskySeller({ sellerCount: 12, sellerPct: 97 }, now), "a seller at 97% positive");
  assert.equal(R.riskySeller({ sellerCount: 300, sellerPct: 97 }, now), "", "97% over hundreds of sales is ordinary");
  assert.equal(R.riskySeller({ sellerJoined: 2026 }, now), "an account made in 2026");
  assert.equal(R.riskySeller({ sellerJoined: 2019 }, now), "");
  assert.equal(R.riskySeller({}, now), "");
  const m = { median: 252, confidence: "good" };
  assert.equal(R.tooCheap({ title: "Nintendo Switch OLED Console", total: 125, sellerCount: 6, sellerPct: 100 }, m).level, "low", "6 ratings at 50%: Check first");
  assert.equal(R.tooCheap({ title: "Nintendo Switch OLED Console", total: 125, sellerCount: 2 }, m).level, "far");
  assert.equal(R.tooCheap({ title: "Nintendo Switch OLED Console", total: 125, sellerRisk: "" , sellerCount: 2 }, m).level, "low", "the caller's sellerRisk wins");
});

test("accessoryOf: a game in a console search, and two parts joined by and", () => {
  assert.equal(R.accessoryOf("Pokemon Scarlet Nintendo Switch OLED Game Brand New Sealed", "nintendo switch oled"), "game");
  assert.equal(R.accessoryOf("Nintendo Switch OLED Handheld Game Console White 64GB", "nintendo switch oled"), "");
  assert.equal(R.accessoryOf("Nintendo Switch OLED console with game", "nintendo switch oled"), "");
  assert.equal(R.accessoryOf("Game Boy Advance SP", "game boy advance"), "", "the search says game");
  assert.equal(R.accessoryOf("Pentax K1000 game camera", "pentax k1000"), "", "only for console searches");
  assert.equal(R.accessoryOf("Switch OLED dock and charger", "nintendo switch oled"), "charger");
  assert.equal(R.accessoryOf("Nintendo Switch OLED console and charger", "nintendo switch oled"), "");
  assert.equal(R.accessoryOf("Nintendo Switch OLED with dock and charger", "nintendo switch oled"), "");
});

test("a price in another currency isn't compared with US sales", () => {
  const m = { median: 252, p25: 220, p75: 280, n: 40, confidence: "good" };
  const f = { title: "Nintendo Switch OLED", price: 180, total: 180, foreign: "CA$" };
  assert.equal(R.compareFacts(f, m, "nintendo switch oled"), null);
  assert.equal(f.cheap, "");
  assert.equal(R.tooCheap({ ...f, total: 60 }, m), null);
  assert.equal(R.priceVerdict("great", { ...f, total: 60, score: 90 }, m).v, "great");
  assert.equal(R.offerPlan({ price: 180, foreign: "CA$" }, m), null);
  assert.ok(R.compareFacts({ title: "Nintendo Switch OLED", price: 180, total: 180 }, m, "nintendo switch oled") > 0.7, "dollars still are");
});

test("cheapReason: a flaw, something missing or a cheaper version, in the listing's words", () => {
  const why = (t, q = "") => R.cheapReason(t, "", q);
  assert.equal(why("Nintendo Switch OLED - dead pixel on screen, otherwise works"), "dead pixel");
  assert.equal(why("iPhone 13 128GB Unlocked - battery 76%, scratches"), "battery 76%");
  assert.equal(why("iPhone 13 128GB Verizon - carrier locked"), "carrier locked");
  assert.equal(why("MacBook Air M1 8GB 256GB - dent on corner, screen spots"), "dent");
  assert.equal(why("Nintendo Switch OLED heavy wear, drift on joycons"), "heavy wear");
  assert.equal(why("Pentax K1000 film camera, needs light seals"), "needs light seals");
  assert.equal(why("Nintendo Switch OLED console only, no dock"), "console only");
  assert.equal(why("DeWalt DCD771 drill, no charger"), "no charger");
  assert.equal(why("Apple iPhone 13 Mini 128GB Pink", "iphone 13 128gb"), "mini");
  assert.equal(why("Nintendo Switch Lite Turquoise", "nintendo switch"), "lite");
  assert.equal(why("Nintendo Switch Lite Turquoise", "nintendo switch lite"), "", "the version searched for isn't a cheaper one");
  assert.equal(why("Apple iPhone 13 64GB", "iphone 13 128gb"), "64GB", "a smaller size than the search names");
  assert.equal(why("MacBook Air M1 8GB 256GB", "macbook air m1 256gb"), "", "memory beside storage isn't a size");
  // Said away, or no reason at all
  assert.equal(why("Switch OLED barely used, no scratches"), "");
  assert.equal(why("scratch-free screen, works without issues"), "");
  assert.equal(why("not missing anything, battery 91%"), "");
  assert.equal(why("Nintendo Switch OLED - moving sale, must go"), "", "a quick sale isn't a reason: bait says it too");
  assert.equal(why("Nintendo Switch OLED White, lightly used"), "");
});

test("tooCheap and cheapForReason: a listing that says why it's cheap", () => {
  const m = { median: 252, confidence: "good" };
  const at = (title, total, extra = {}) => ({ title, total, ...extra });
  // 40-55%: no warning when it says why, a plain chip instead
  assert.equal(R.tooCheap(at("Nintendo Switch OLED - dead pixel", 125), m), null);
  assert.deepEqual(R.cheapForReason(at("Nintendo Switch OLED - dead pixel", 125), m), { pct: 50, why: "dead pixel" });
  assert.equal(R.cheapForReason(at("Nintendo Switch OLED", 125), m), null);
  assert.equal(R.freeRead({ ...at("Nintendo Switch OLED - dead pixel", 125), vsSold: 125 / 252 }, m), null, "no warning, no price word");
  // A seller warning beside it: still Check first, never cleared
  assert.equal(R.tooCheap(at("Nintendo Switch OLED - dead pixel", 125, { sellerCount: 0 }), m).level, "low");
  // Under 40%: a flaw story doesn't explain it (bait tells one); something missing makes it Check first
  assert.equal(R.tooCheap(at("iPhone 13 128gb minor scratches", 85), m).level, "far");
  assert.equal(R.tooCheap(at("Nintendo Switch OLED console only", 90), m).level, "low");
  assert.equal(R.tooCheap(at("Nintendo Switch OLED console only", 90, { sellerCount: 0 }), m).level, "far");
  // After a scan: the word stands, no better than Good price
  const pv = R.priceVerdict("great", at("Nintendo Switch OLED - dead pixel", 125, { score: 88 }), m);
  assert.equal(pv.v, "good");
  assert.equal(pv.score, 74);
  assert.match(pv.why, /50% of the typical \$252, and the listing says why \(“dead pixel”\)/);
  assert.deepEqual(R.priceVerdict("fair", at("Nintendo Switch OLED - dead pixel", 125), m), { v: "fair" });
  assert.equal(R.priceVerdict("good", at("Nintendo Switch OLED", 125), m).v, "suspicious", "no reason: still the bait warning");
  // A code on the title is still backed by the low price
  const coded = { ...at("Nintendo Switch OLED small scratch K9F21", 120), titleCode: "K9F21", vsSold: 120 / 252 };
  assert.equal(R.freeRead(coded, m).word, "Likely scam");
});

test("accessoryOf and PROJECT: one earbud is a part, a locked device is for parts", () => {
  assert.equal(R.accessoryOf("AirPods Pro 2 - right earbud only + case", "airpods pro 2"), "right earbud only");
  assert.equal(R.clueOf(R.PROJECT, "MacBook Air M1 MDM locked"), "mdm locked");
  assert.equal(R.clueOf(R.PROJECT, "iPhone 13 iCloud locked"), "icloud locked");
});

test("tooCheap: real sales this low, and a reference with fewer sales", () => {
  const mixed = { median: 200, p10: 95, confidence: "fair" }; // a "nintendo switch" search: Lites, V1s and OLEDs
  assert.equal(R.tooCheap({ title: "Nintendo Switch Console Gray", total: 105 }, mixed), null, "the cheapest tenth of sales went this low");
  assert.equal(R.tooCheap({ title: "Nintendo Switch Console Gray", total: 90 }, mixed).level, "low");
  assert.deepEqual(R.cheapForReason({ title: "Nintendo Switch Lite", total: 100 }, mixed), { pct: 50, why: "lite" }, "still says why");
  // Under 40% on a "fair" reference: Check first on price alone, Likely scam with a seller warning
  const fair = { median: 160, confidence: "fair" };
  assert.equal(R.tooCheap({ title: "Canon AE-1 35mm camera body", total: 55 }, fair).level, "low");
  assert.equal(R.tooCheap({ title: "Canon AE-1 35mm camera body", total: 55, sellerCount: 0 }, fair).level, "far");
  assert.equal(R.tooCheap({ title: "Canon AE-1 35mm camera body", total: 55 }, { ...fair, confidence: "good" }).level, "far");
  // Old cached answers have no p10: as before
  assert.equal(R.tooCheap({ title: "Nintendo Switch OLED", total: 60 }, { median: 252, confidence: "good" }).level, "far");
});

test("priceVerdict: the model's reason for a low price (cheapWhy)", () => {
  const m = { median: 252, confidence: "good" };
  const at = (title, total, extra = {}) => ({ title, total, score: 85, ...extra });
  // 40-55%, no reason on the card: a scan that read one keeps its word, no better than Good
  const pv = R.priceVerdict("great", at("Nintendo Switch OLED", 125, { cheapWhy: "missing parts" }), m);
  assert.equal(pv.v, "good");
  assert.match(pv.why, /the scan read why \(missing parts\)/);
  assert.equal(R.priceVerdict("fair", at("Nintendo Switch OLED", 125, { cheapWhy: "flaw" }), m).v, "fair");
  assert.equal(R.priceVerdict("great", at("Nintendo Switch OLED", 125, { cheapWhy: "quick sale" }), m).v, "suspicious", "a quick sale is no reason");
  assert.equal(R.priceVerdict("great", at("Nintendo Switch OLED", 125, { cheapWhy: "none" }), m).v, "suspicious");
  assert.equal(R.priceVerdict("great", at("Nintendo Switch OLED", 125, { cheapWhy: "none" }), m).level, "low", "the panel sorts a Too cheap? above a Likely scam");
  assert.equal(R.priceVerdict("great", at("Nintendo Switch OLED", 125, { cheapWhy: "missing parts", sellerCount: 1 }), m).v, "suspicious", "not beside a strong seller sign");
  // Under 40%: only Analyze, only something missing or a cheaper version, no better than Fair
  assert.equal(R.priceVerdict("good", at("Nintendo Switch OLED", 90, { cheapWhy: "missing parts" }), m).v, "suspicious", "a scan doesn't clear it");
  const deep = R.priceVerdict("good", at("Nintendo Switch OLED", 90, { cheapWhy: "missing parts" }), m, { deep: true });
  assert.equal(deep.v, "fair");
  assert.match(deep.why, /Held at Fair price/);
  assert.equal(R.priceVerdict("good", at("Nintendo Switch OLED", 90, { cheapWhy: "flaw" }), m, { deep: true }).v, "suspicious", "a flaw story doesn't take 60% off");
  assert.equal(R.priceVerdict("good", at("Nintendo Switch OLED", 90, { cheapWhy: "missing parts", sellerCount: 0 }), m, { deep: true }).v, "suspicious");
  assert.equal(R.priceVerdict("good", at("Nintendo Switch OLED K9F21", 90, { cheapWhy: "missing parts", titleCode: "K9F21", sellerCount: 50, sellerPct: 100 }), m, { deep: true }).v, "suspicious", "not with a title code");
  assert.equal(R.priceVerdict("suspicious", at("Nintendo Switch OLED", 125, { cheapWhy: "missing parts" }), m).v, "suspicious", "the model's own warning stands");
});

test("tooCheap by site: Marketplace sellers pay no eBay fee, established eBay sellers have eBay behind them", () => {
  const m = { median: 252, confidence: "good" };
  const local = { ...m, local: true };
  // 48%: Too cheap? on eBay; under the fee allowance (86% of 55%) on Marketplace
  assert.equal(R.tooCheap({ title: "Switch OLED", total: 121 }, m).level, "low");
  assert.equal(R.tooCheap({ title: "Switch OLED", total: 121 }, local), null);
  assert.equal(R.tooCheap({ title: "Switch OLED", total: 110 }, local).level, "low", "44% is still under it");
  assert.equal(R.tooCheap({ title: "Switch OLED", total: 121, sellerJoined: 2026, sellerRisk: "an account made in 2026" }, local).level, "far", "not beside a strong seller sign");
  // An established eBay seller at 40-55%: no warning, a plain chip
  const est = { title: "Nintendo Switch OLED White Console", total: 128, sellerCount: 1500, sellerPct: 99.7 };
  assert.equal(R.tooCheap(est, m), null);
  assert.deepEqual(R.cheapForReason(est, m), { pct: 51, why: "", established: true });
  assert.match(R.priceVerdict("great", { ...est, score: 90 }, m).why, /from an established eBay seller/);
  assert.equal(R.tooCheap({ ...est, sellerPct: 97.5 }, m).level, "low", "under 98%: not established");
  assert.equal(R.tooCheap({ ...est, total: 75 }, m).level, "far", "under 40% it's as for anyone");
  assert.equal(R.cheapForReason({ ...est, total: 110 }, local)?.established, undefined, "on Marketplace there's no eBay guarantee");
  // A title code no scan cleared, with a reason: still the fake's look after a scan
  const coded = { title: "Nintendo Switch OLED small scratch K9F21", total: 121, titleCode: "K9F21", score: 70 };
  assert.equal(R.priceVerdict("good", coded, m).v, "suspicious");
  assert.equal(R.priceVerdict("good", { ...coded, codeOk: true }, m).v, "good");
});

test("pickChips: each kind of mark follows its switch, scam marks lead, and only cards can drop them", () => {
  const chips = [["deal", "At your $50", null, "other"], ["good", "Good price · $20 below typical", "", "price"], ["warn", "Code in title: AB12", "why", "scam"], ["new", "New to you", null, "other"], ["warn", "Filtered: “repro”", null, "state"]];
  const texts = (list) => list.map((c) => c[1]);
  assert.deepEqual(texts(R.pickChips(chips)), ["Filtered: “repro”", "Code in title: AB12", "At your $50"], "why it's hidden, then the warning, then the rest in order");
  assert.deepEqual(texts(R.pickChips(chips, { markLimit: 1 })), ["Filtered: “repro”"]);
  assert.deepEqual(texts(R.pickChips(chips.slice(0, 4), { markLimit: 1 })), ["Code in title: AB12"], "one chip: the scam mark, never a price word");
  assert.deepEqual(texts(R.pickChips(chips.slice(0, 4), { markPrices: false, markOther: false })), ["Code in title: AB12"], "scam check only");
  assert.deepEqual(texts(R.pickChips(chips.slice(0, 4), { markScams: false }, { onCard: true })), ["At your $50", "Good price · $20 below typical", "New to you"]);
  assert.deepEqual(texts(R.pickChips(chips.slice(0, 4), { markScams: false })), ["Code in title: AB12", "At your $50", "Good price · $20 below typical"], "the panel and listing page keep the warning");
  assert.equal(R.pickChips(chips, { markLimit: 0 }).length, 3, "a bad limit is the default");
});

test("focusOf: the three focuses and Custom, from the switches they set", () => {
  assert.equal(R.focusOf({}), "noai", "a fresh install: every switch at its default, and the AI is opt-in");
  assert.equal(R.focusOf({ useAI: true }), "everything");
  for (const name of Object.keys(R.FOCUS)) assert.equal(R.focusOf(R.FOCUS[name]), name);
  assert.equal(R.focusOf({ ...R.FOCUS.scams, markLimit: 1, theme: "dark" }), "scams", "marks per listing and other settings don't change the focus");
  assert.equal(R.focusOf({ markScams: false }), "custom", "scam marks off is never a focus");
  assert.equal(R.focusOf({ useSoldComps: false }), "custom");
  for (const f of Object.values(R.FOCUS)) assert.equal(f.markScams && f.useSoldComps, true, "every focus keeps the scam marks and the lookups they need");
});

test("games in a console search, from a real \"ds\" search: plural, and named after the console's maker", () => {
  for (const t of ["Nintendo DS games", "Various DS games", "DS Games Your Pick"]) assert.equal(R.accessoryOf(t, "ds"), "game", t);
  for (const t of ["Nintendo DS Lite with games", "Two Hand Held Game Consoles with hundreds of Games!!", "Nintendo DSi"]) assert.equal(R.accessoryOf(t, "ds"), "", t);
  assert.equal(R.madeFor("Story of Seasons – Nintendo 3DS", "ds"), "story of seasons");
  assert.equal(R.madeFor("Castlevania: Order of Ecclesia – Nintendo DS", "ds"), "castlevania order of ecclesia");
  const f = { title: "Nintendo DS and 3DS Games", price: 1, total: 1 };
  R.compareFacts(f, { median: 60, confidence: "fair" }, "ds");
  assert.equal(R.freeRead(f, { median: 60, confidence: "fair" })?.word, "Off-topic", "$1 is a stand-in, not too cheap");
});

test("real eBay drive and Marketplace iPod searches: specs in the search, parts for it, and empty titles", () => {
  // A word with a number in it is a spec: "24TB" and "2TB" aren't "4tb", "4 TB" is.
  for (const t of ["Seagate Exos X24 ST24000NM000H 24TB CMR 7200RPM", "WD Ultrastar DC HC530 14TB SATA", "HGST Ultrastar 2TB 3.5\" Enterprise SATA"]) assert.ok(R.offSearch(t, "4tb hard drive"), t);
  for (const t of ["Seagate ST4000DM000 4 TB,Internal,5900 RPM", "HGST 4TB SAS Hard Drive 3.5\" 7200RPM"]) assert.equal(R.offSearch(t, "4tb hard drive"), false, t);
  for (const t of ["PS5 Slim", "Sony PlayStation 5 Digital Edition"]) assert.equal(R.offSearch(t, "ps5"), false, t);
  assert.equal(R.missingWord("WD Ultrastar 14TB Hard Drive", "4tb hard drive"), "4tb");
  assert.ok(R.offSearch("📸📸", "ipod"), "nothing to go on");
  assert.equal(R.offSearch("", ""), false);
  // A part, then "for" and the search.
  assert.equal(R.accessoryOf("30‑Pin Apple Composite AV Video Cable w USB Charge/Sync for iPod iPhone iPad", "ipod"), "cable");
  for (const t of ["iPod Classic 160GB with case for sale", "iPod nano 7th gen charger cable works great for kids"]) assert.equal(R.accessoryOf(t, "ipod"), "", t);
});

test("variantOf: the version a title names that the search doesn't", () => {
  assert.equal(R.variantOf("Nintendo Switch Lite Turquoise", "nintendo switch"), "lite");
  assert.equal(R.variantOf("Nintendo Switch Lite Turquoise", "switch lite"), "", "the search names it");
  assert.equal(R.variantOf("Apple iPhone 13 Pro Max 256GB", "iphone 13"), "pro max", "the longer phrase first");
  assert.equal(R.variantOf("Apple iPhone 13 Pro Max 256GB", "iphone 13 pro"), "pro max", "a Pro Max isn't the Pro searched for");
  assert.equal(R.variantOf("Apple iPhone 13 Pro Max 256GB", "iphone 13 pro max"), "");
  assert.equal(R.variantOf("DeWalt DCD771 20V Max drill (tool only)", "dewalt dcd771"), "tool only");
  assert.equal(R.variantOf("Nintendo Switch V2 with Pro Controller", "nintendo switch"), "", "what comes with it isn't its version");
  assert.equal(R.variantOf("Nintendo Switch OLED + Pro Controller", "nintendo switch"), "oled");
  assert.equal(R.variantOf("Sony PlayStation 5 Digital Edition", "ps5"), "digital edition");
  assert.equal(R.variantOf("Nintendo Switch Console Gray Joy-Con", "nintendo switch"), "");
  assert.equal(R.variantOf("Seminole county map", "map"), "", "whole words only");
  assert.equal(R.variantOf(undefined), "");
});

// The blueprint's mixed search: 10 plain Switches around $160, 8 Lites around $95, 8 OLEDs around $240.
test("genOf and sizeOf: a generation and a storage size, however they're written", () => {
  for (const t of ["AirPods Pro 2nd Generation", "AirPods Pro (2nd Gen) USB-C", "AirPods Pro Gen 2", "iPad generation 2", "Dyson V2"]) assert.equal(R.genOf(t), "gen 2", t);
  assert.equal(R.genOf("iPad Mini 6th Gen 64GB"), "gen 6");
  assert.equal(R.genOf("Nintendo Switch V1 unpatched"), "gen 1");
  for (const t of ["DeWalt 20V Max drill", "Bosch 18v", "Dyson V220 cable", "Nintendo Switch"]) assert.equal(R.genOf(t), "", t);
  assert.equal(R.sizeOf("iPhone 13 Pro 256GB Graphite"), "256gb");
  assert.equal(R.sizeOf("iPhone 13 1 TB"), "1tb");
  assert.equal(R.sizeOf("MacBook Air M1 8GB 256GB"), "256gb", "the largest, not the memory");
  assert.equal(R.sizeOf("Kingston 8GB DDR4"), "", "under 16GB is memory, not storage");
});

test("versionOf: tier, generation and size, leaving out what's the thing itself", () => {
  assert.deepEqual(R.versionOf("Apple iPhone 13 Pro Max 256GB Unlocked"), ["pro max", "", "256gb"]);
  assert.deepEqual(R.versionOf("AirPods Pro 2nd Generation with MagSafe case"), ["pro", "gen 2", ""]);
  assert.deepEqual(R.versionOf("AirPods Pro 2nd Generation", ["pro"]), ["", "gen 2", ""]);
  assert.deepEqual(R.versionOf("iPhone 13 256GB", ["size"]), ["", "", ""], "the search names a size: storage is off");
  assert.deepEqual(R.versionOf("iPhone 13 with 64GB card"), ["", "", ""], "what comes with it isn't its size");
});

// The blueprint's mixed search: 10 plain Switches around $160, 8 Lites around $95, 8 OLEDs around $240.
const switchSales = () => [
  ...[150, 155, 158, 160, 160, 162, 165, 168, 170, 155].map((total, i) => ({ title: `Nintendo Switch Console Gray ${i}`, total })),
  ...[88, 90, 92, 95, 95, 98, 100, 102].map((total, i) => ({ title: `Nintendo Switch Lite Coral ${i}`, total })),
  ...[230, 235, 238, 240, 240, 245, 248, 250].map((total, i) => ({ title: `Nintendo Switch OLED White ${i}`, total })),
];

test("variantGroups: sales grouped by tier, generation and size", () => {
  const g = R.variantGroups(switchSales(), "nintendo switch");
  assert.deepEqual([g.groups["/*/*"].length, g.groups["lite/*/*"].length, g.groups["oled/*/*"].length], [10, 8, 8]);
  assert.deepEqual(g.same, []);
  assert.deepEqual(R.variantGroups(switchSales(), "switch oled").same, ["oled"], "a version the search names is the thing itself");
  assert.equal(R.variantGroups(switchSales(), "switch oled").groups["oled/*/*"], undefined);
  // "20V Max" on nearly every DeWalt drill is the drill, not a version of it.
  const drills = [...Array(9)].map((_, i) => ({ title: `DeWalt DCD771C2 20V MAX Cordless Drill Kit ${i}`, total: 80 + i })).concat({ title: "DeWalt DCD771 drill", total: 75 });
  const d = R.variantGroups(drills, "dewalt dcd771");
  assert.deepEqual(d.same, ["max"]);
  assert.deepEqual(Object.keys(d.groups), ["/*/*"]);
  // Sizes and generations: a 256GB iPhone 13 Pro counts in "pro/*/256gb", "pro/*/*" and so on.
  const phones = R.variantGroups([{ title: "iPhone 13 Pro 256GB", total: 500 }, { title: "iPhone 13 128GB", total: 300 }, { title: "iPhone 13", total: 290 }], "iphone 13");
  assert.deepEqual(Object.keys(phones.groups).sort(), ["/*/*", "/*/128gb", "pro/*/*", "pro/*/256gb"]);
  assert.deepEqual(R.variantGroups([{ title: "iPhone 13 128GB", total: 300 }], "iphone 13 128gb").same, ["size"]);
  assert.deepEqual(R.variantGroups([], "x"), { same: [], groups: {} });
});

const mixed = { median: 160, p10: 92, p25: 98, p75: 235, n: 26, confidence: "fair", ship: 14, variants: {
  "lite/*/*": { median: 95, p10: 89, p25: 92, p75: 99, n: 8, confidence: "fair" },
  "oled/*/*": { median: 240, p10: 234, p25: 237, p75: 245, n: 8, confidence: "fair" },
  "mini/*/*": { median: 50, n: 8, confidence: "rough" },
  "/*/*": { median: 160, p10: 155, p25: 156, p75: 165, n: 10, confidence: "fair" },
} };

test("forVariant: a listing is compared with sales of its own kind", () => {
  const lite = R.forVariant(mixed, { title: "Nintendo Switch Lite Turquoise" });
  assert.deepEqual([lite.median, lite.p10, lite.n, lite.variantUsed, lite.variantWords, lite.ship], [95, 89, 8, "lite/*/*", ["lite"], 14], "the whole market's shipping stays");
  assert.equal(lite.variants, undefined, "the copy has no groups, so a second pass changes nothing");
  assert.deepEqual(R.forVariant(lite, { title: "Nintendo Switch Lite" }), lite);
  assert.equal(R.forVariant(mixed, { title: "Nintendo Switch OLED" }).median, 240);
  const base = R.forVariant(mixed, { title: "Nintendo Switch Console Gray" });
  assert.deepEqual([base.median, base.variantUsed, base.variantWords, base.variantOthers], [160, "/*/*", [], ["lite", "oled", "mini"]]);
  assert.equal(R.forVariant(mixed, { title: "Nintendo Switch Mini" }), mixed, "a group too spread out to trust: the whole market");
  assert.equal(R.forVariant(mixed, { title: "Nintendo Switch Pro Max" }), mixed, "a kind with no group of its own keeps the whole market");
  assert.equal(R.forVariant({ median: 100 }, { title: "Nintendo Switch Lite" }).median, 100, "a market from before versions");
  assert.equal(R.forVariant({ median: 100, variants: { lite: { median: 50, confidence: "good" } } }, { title: "Switch Lite" }).median, 100, "a cached market from the first version of this (keys by tier alone) is left alone");
  assert.equal(R.forVariant(null, { title: "x" }), null);
  // A pickup Lite: its own kind, less the shipping.
  const pick = R.forPickup(mixed, { title: "Nintendo Switch Lite gray", shipping: null }, true);
  assert.deepEqual([pick.median, pick.pickupShip, pick.variantUsed], [81, 14, "lite/*/*"]);
});

test("forVariant: most like it first, then any size, then any generation", () => {
  const m = { median: 400, n: 60, confidence: "good", variants: {
    "pro/*/256gb": { median: 520, n: 9, confidence: "fair" },
    "pro/*/*": { median: 480, n: 20, confidence: "good" },
    "/*/512gb": { median: 380, n: 8, confidence: "fair" },
    "/*/*": { median: 320, n: 30, confidence: "good" },
    "/gen 2/*": { median: 200, n: 10, confidence: "fair" },
  } };
  assert.equal(R.forVariant(m, { title: "iPhone 13 Pro 256GB" }).median, 520);
  assert.equal(R.forVariant(m, { title: "iPhone 13 Pro 1TB" }).median, 480, "no 1TB Pro sales: any Pro");
  assert.equal(R.forVariant(m, { title: "iPhone 13 Pro" }).median, 480, "no size given: any Pro");
  assert.equal(R.forVariant(m, { title: "iPhone 13 512GB" }).median, 380);
  assert.deepEqual(R.forVariant(m, { title: "iPhone 13 512GB" }).variantWords, ["512gb"]);
  assert.equal(R.forVariant(m, { title: "iPhone 13 64GB" }).median, 320, "no 64GB sales: any plain one");
  assert.equal(R.forVariant(m, { title: "Thing 2nd gen" }).median, 200);
  assert.equal(R.forVariant(m, { title: "Thing 3rd gen" }).median, 320, "no sales of that generation: any plain one");
});

test("forVariant: a cheap Lite in a Switch search is priced as a Lite, and 'lite' no longer explains the price", () => {
  const market = { median: 200, p10: 95, p25: 120, p75: 240, n: 52, confidence: "fair", ship: 14, variants: { "lite/*/*": { median: 95, p10: 80, p25: 88, p75: 100, n: 14, confidence: "fair" }, "/*/*": { median: 165, p10: 140, p25: 155, p75: 175, n: 22, confidence: "good" } } };
  // An honest Lite at $85: 43% of the mixed typical price, 89% of a Lite's.
  const honest = { title: "Nintendo Switch Lite Turquoise", price: 85, total: 85, shipping: 0, sellerCount: 900, sellerPct: 99.7 };
  const mk = R.forVariant(market, honest);
  honest.vsSold = R.compareFacts(honest, mk, "nintendo switch");
  assert.equal(Math.round(honest.vsSold * 100), 89);
  assert.equal(R.freeRead(honest, mk).word, "Fair price");
  // Bait at $30: under the Lite's own cheapest tenth, and "lite" isn't a reason any more.
  const bait = { title: "Nintendo Switch Lite NEW sealed", price: 30, total: 30, shipping: 0, sellerCount: 2, sellerPct: 100 };
  const bm = R.forVariant(market, bait);
  bait.vsSold = R.compareFacts(bait, bm, "nintendo switch");
  assert.equal(bait.saysWhy, "");
  assert.equal(R.freeRead(bait, bm).word, "Likely scam");
  // A plain Switch at $195 was Fair price against the mix; against sales of plain ones it's above typical.
  const v2 = { title: "Nintendo Switch Console Gray Joy-Con", price: 195, total: 195, shipping: 0 };
  assert.equal(R.freeRead({ ...v2, vsSold: R.compareFacts(v2, market, "nintendo switch") }, market).word, "Fair price");
  const vm = R.forVariant(market, v2);
  v2.vsSold = R.compareFacts(v2, vm, "nintendo switch");
  assert.equal(R.freeRead(v2, vm).word, "Above typical");
});

test("a generation or size the typical price is already for isn't why it's cheap", () => {
  assert.equal(R.cheapReason("AirPods Pro 1st Generation", "", "airpods pro"), "1st generation");
  assert.equal(R.cheapReason("AirPods Pro 1st Generation", "", "airpods pro gen 1"), "", "compared with first-generation sales");
  assert.equal(R.cheapReason("iPhone 13 64GB", "", "iphone 13 128gb"), "64GB");
  assert.equal(R.cheapReason("iPhone 13 64GB", "", "iphone 13 64gb"), "");
});

test("genOf and sizeOf, from real iPod and drive titles: a choice of several is none", () => {
  assert.equal(R.genOf("Apple iPod Classic 5th 6th 7th Generation (128GB ,256GB, 512GB,1TB,2TB) Modded"), "");
  assert.equal(R.sizeOf("Apple iPod Classic 5th 6th 7th Generation (128GB ,256GB, 512GB,1TB,2TB) Modded"), "");
  assert.equal(R.sizeOf("iPod Classic 5th 6th 7th Generation 30GB 60GB 80GB 120GB 160GB All Colors"), "");
  assert.equal(R.genOf("Apple iPod Classic Video 5th 5.5 Enhanced Generation (30 GB) Black"), "", "not \"generation 30\"");
  assert.equal(R.sizeOf("MacBook Pro 16GB 512GB"), "512gb", "memory and storage");
  assert.deepEqual(R.versionOf("Apple iPod Classic 7th Gen 160GB Space Gray"), ["", "gen 7", "160gb"]);
});
