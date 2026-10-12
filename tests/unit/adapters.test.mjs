import test from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load.mjs";

const { SL } = await loadScripts();

test("parsePrice reads the first money amount", () => {
  assert.equal(SL.parsePrice("$1,249.99"), 1249.99);
  assert.equal(SL.parsePrice("US $20.00"), 20);
  assert.equal(SL.parsePrice("$45.00 to $60.00"), 45);
  assert.equal(SL.parsePrice("Free"), null);
  assert.equal(SL.parsePrice(""), null);
});

test("parseShipping: a number, 0 for free, null when the card doesn't say", () => {
  assert.equal(SL.parseShipping("+$12.35 delivery"), 12.35);
  assert.equal(SL.parseShipping("+$5 shipping estimate"), 5);
  assert.equal(SL.parseShipping("Free delivery"), 0);
  assert.equal(SL.parseShipping("Free International Shipping"), 0);
  assert.equal(SL.parseShipping("Pre-Owned"), null);
  assert.equal(SL.parseShipping("$52.00 Free shipping", true), 0, "free is checked before any amount");
  assert.equal(SL.parseShipping("US $8.50 Standard Shipping"), null, "a card's bare price is not shipping");
});

test("parseShipping(loose) reads a listing page's own shipping line", () => {
  assert.equal(SL.parseShipping("US $10.95 Standard Shipping", true), 10.95);
  assert.equal(SL.parseShipping("$8.50 Economy Shipping", true), 8.5);
  assert.equal(SL.parseShipping("Free Standard Shipping", true), 0);
  assert.equal(SL.parseShipping("Local pickup only", true), null);
});

test("lotSize only trusts what the title says outright", () => {
  assert.equal(SL.lotSize("Lot of 6 Game Boy Advance games"), 6);
  assert.equal(SL.lotSize("10 pc lot of cartridges"), 10);
  assert.equal(SL.lotSize("bundle of 12 NES games"), 12);
  assert.equal(SL.lotSize("Game Boy Advance SP"), 0);
  assert.equal(SL.lotSize("Lot of 1 game"), 0, "one is not a lot");
});

test("cardFacts: auctions, offers, lots and seller ratings", () => {
  const a = SL.cardFacts("3 bids · 2d 4h left", "Game Boy");
  assert.deepEqual([a.auction, a.bids, a.timeLeft, a.hoursLeft], [true, 3, "2d 4h", 52]);
  assert.equal(SL.cardFacts("Time left 45m", "x").auction, undefined, "no bids, no auction");
  assert.equal(SL.cardFacts("or Best Offer", "x").bestOffer, true);
  assert.equal(SL.cardFacts("", "Lot of 6 games").lot, 6);
  assert.deepEqual(pick(SL.cardFacts("retro 99.2% positive (412)", "x")), { sellerPct: 99.2, sellerCount: 412 });
  assert.deepEqual(pick(SL.cardFacts("name (1.2K) 99.5%", "x")), { sellerPct: 99.5, sellerCount: 1200 });
  assert.deepEqual(pick(SL.cardFacts("98% positive", "x")), { sellerPct: 98 });
  function pick(f) { return Object.fromEntries(Object.entries(f).filter(([k]) => k.startsWith("seller"))); }
});

test("titleCode: the random code on the end of bulk-posted Marketplace scams", () => {
  for (const [t, c] of [["Nintendo Game Boy Advance SP M2465", "M2465"], ["Halo Special Edition Xbox S1337", "S1337"], ["Nintendo DS Lite Pink U2X503", "U2X503"]]) {
    assert.equal(SL.titleCode(t), c, t);
  }
  for (const t of ["Nintendo Game Boy Advance SP", "Samsung SSD 500GB", "Sony PlayStation 2 Slim PS2", "Pentax K1000", "Nintendo Wii U 32GB", "ASUS RTX3060 Graphics Card"]) {
    assert.equal(SL.titleCode(t), "", t);
  }
  assert.equal(SL.titleStem("Nintendo Game Boy Advance SP M2465", "M2465"), "nintendo game boy advance sp");
  assert.equal(SL.titleStem("Nintendo Game Boy Advance SP K7731", "K7731"), SL.titleStem("Nintendo Game Boy Advance SP M2465", "M2465"), "two codes, one stem: that is how reposts are found");
});

test("offSite: moving the sale off the site", () => {
  const sure = (t) => SL.offSite(t)?.sure === true;
  assert.ok(sure("visit www . jmyzl . com for details"), "disguised web address");
  assert.ok(sure("message 505_507__6507 now"), "oddly written phone number");
  assert.ok(sure("remove the spaces to see it"), "say to remove the spaces");
  assert.ok(sure("text me a screenshot of the listing"));
  assert.ok(sure("contact me on WhatsApp"));
  assert.ok(sure("pay with gift cards"));
  const plain = SL.offSite("call or text 555 123 4567");
  assert.ok(plain && plain.sure === false, "a plain phone number is only a hint");
  assert.equal(SL.offSite("Works great, comes with charger"), null);
  assert.equal(SL.offSite(""), null);
});

test("offSite: ordinary sentences are not scams", () => {
  const clean = [
    "Works perfectly. Me and my wife upgraded.",
    "Great condition. Top quality, pickup only",
    "Bought new. Store in smoke free home",
    "Selling my Switch. Us shipping only",
    "Pick up in town. Co op games included",
    "Black polka dot top, size M",
    "Battery health is 92%, I can show a screenshot of it at pickup",
    "Comes with a $20 gift card for the store",
    "Text me if you have questions about pickup",
    "Everything works. Online play tested. Shop around, price is firm.",
  ];
  for (const t of clean) assert.equal(SL.offSite(t)?.sure ?? false, false, t);
});

test("offSite: the disguised forms are still caught", () => {
  const sure = (t) => SL.offSite(t)?.sure === true;
  assert.ok(sure("go to jmyzl dot com"), "dot as a word");
  assert.ok(sure("go to jmyzl [dot] shop"), "dot in brackets");
  assert.ok(sure("go to jmyzl (dot) store"));
  assert.ok(sure("go to jmyzl .com"), "space before the dot");
  assert.ok(sure("go to jmyzl. com now"), "space after the dot, lower case ending");
  assert.ok(sure("WWW . JMYZL . COM"));
  assert.ok(sure("pay only with gift cards"));
  assert.ok(sure("send me a screenshot of the code"));
});
