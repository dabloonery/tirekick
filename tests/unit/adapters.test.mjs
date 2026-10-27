import test from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load.mjs";

const { TK } = await loadScripts();

test("parsePrice reads the first money amount", () => {
  assert.equal(TK.parsePrice("$1,249.99"), 1249.99);
  assert.equal(TK.parsePrice("US $20.00"), 20);
  assert.equal(TK.parsePrice("$45.00 to $60.00"), 45);
  assert.equal(TK.parsePrice("Free"), null);
  assert.equal(TK.parsePrice(""), null);
});

test("parseShipping: a number, 0 for free, null when the card doesn't say", () => {
  assert.equal(TK.parseShipping("+$12.35 delivery"), 12.35);
  assert.equal(TK.parseShipping("+$5 shipping estimate"), 5);
  assert.equal(TK.parseShipping("Free delivery"), 0);
  // A listing page's shipping row, from a real eBay listing (2026-10): the label, then free or the cost.
  assert.equal(TK.parseShipping("Shipping:FreeFedEx Ground / FedEx Home Delivery®. See details", true), 0);
  assert.equal(TK.parseShipping("Shipping: US $12.45 USPS Ground Advantage®. See details", true), 12.45);
  assert.equal(TK.parseShipping("Shipping: Free FedEx Ground"), null, "a card's text needs the plus sign or 'free shipping'");
  assert.equal(TK.parseShipping("Free International Shipping"), 0);
  assert.equal(TK.parseShipping("Pre-Owned"), null);
  assert.equal(TK.parseShipping("$52.00 Free shipping", true), 0, "free is checked before any amount");
  assert.equal(TK.parseShipping("US $8.50 Standard Shipping"), null, "a card's bare price is not shipping");
});

test("parseShipping(loose) reads a listing page's own shipping line", () => {
  assert.equal(TK.parseShipping("US $10.95 Standard Shipping", true), 10.95);
  assert.equal(TK.parseShipping("$8.50 Economy Shipping", true), 8.5);
  assert.equal(TK.parseShipping("Free Standard Shipping", true), 0);
  assert.equal(TK.parseShipping("Local pickup only", true), null);
});

test("lotSize only trusts what the title says outright", () => {
  assert.equal(TK.lotSize("Lot of 6 Game Boy Advance games"), 6);
  assert.equal(TK.lotSize("10 pc lot of cartridges"), 10);
  assert.equal(TK.lotSize("bundle of 12 NES games"), 12);
  assert.equal(TK.lotSize("Game Boy Advance SP"), 0);
  assert.equal(TK.lotSize("Lot of 1 game"), 0, "one is not a lot");
});

test("cardFacts: auctions, offers, lots and seller ratings", () => {
  const a = TK.cardFacts("3 bids · 2d 4h left", "Game Boy");
  assert.deepEqual([a.auction, a.bids, a.timeLeft, a.hoursLeft], [true, 3, "2d 4h", 52]);
  assert.equal(TK.cardFacts("Time left 45m", "x").auction, undefined, "no bids, no auction");
  assert.equal(TK.cardFacts("or Best Offer", "x").bestOffer, true);
  for (const t of ["Current bid", "Starting bid · Ends Fri 10:12", "Place bid"]) assert.equal(TK.cardFacts(`$5.00 ${t}`, "x").auction, true, `reworded: ${t}`);
  assert.equal(TK.cardFacts("Buy It Now · Bidding is not available", "x").auction, undefined);
  assert.equal(TK.cardFacts("", "Lot of 6 games").lot, 6);
  assert.deepEqual(pick(TK.cardFacts("retro 99.2% positive (412)", "x")), { sellerPct: 99.2, sellerCount: 412 });
  assert.deepEqual(pick(TK.cardFacts("name (1.2K) 99.5%", "x")), { sellerPct: 99.5, sellerCount: 1200 });
  assert.deepEqual(pick(TK.cardFacts("98% positive", "x")), { sellerPct: 98 });
  assert.deepEqual(pick(TK.cardFacts("new_seller 0% positive (0)", "x")), { sellerPct: 0, sellerCount: 0 }, "no ratings yet");
  assert.deepEqual(pick(TK.cardFacts("argent 0% positive (782)", "x")), { sellerCount: 782 }, "ratings, none in the last 12 months: no percentage");
  function pick(f) { return Object.fromEntries(Object.entries(f).filter(([k]) => k.startsWith("seller"))); }
});

test("titleCode: the random code on the end of bulk-posted Marketplace scams", () => {
  // Labeled as a model or part number, from a real Marketplace iPod search: what it is, not a code.
  for (const t of ["Apple iPod Shuffle 2nd Gen 1GB Model A1204", "Apple iPod Shuffle Model # A1204", "HGST HUS726040ALS210 4TB P/N: 0F27003"]) assert.equal(TK.titleCode(t), "", t);
  assert.equal(TK.titleCode("3ds console T5949"), "T5949");
  for (const [t, c] of [["Nintendo Game Boy Advance SP M2465", "M2465"], ["Halo Special Edition Xbox S1337", "S1337"], ["Nintendo DS Lite Pink U2X503", "U2X503"]]) {
    assert.equal(TK.titleCode(t), c, t);
  }
  for (const t of ["Nintendo Game Boy Advance SP", "Samsung SSD 500GB", "Sony PlayStation 2 Slim PS2", "Pentax K1000", "Nintendo Wii U 32GB", "ASUS RTX3060 Graphics Card"]) {
    assert.equal(TK.titleCode(t), "", t);
  }
  assert.equal(TK.titleStem("Nintendo Game Boy Advance SP M2465", "M2465"), "nintendo game boy advance sp");
  assert.equal(TK.titleStem("Nintendo Game Boy Advance SP K7731", "K7731"), TK.titleStem("Nintendo Game Boy Advance SP M2465", "M2465"), "two codes, one stem: that is how reposts are found");
});

test("offSite: moving the sale off the site", () => {
  const sure = (t) => TK.offSite(t)?.sure === true;
  assert.ok(sure("visit www . jmyzl . com for details"), "disguised web address");
  assert.ok(sure("message 505_507__6507 now"), "oddly written phone number");
  assert.ok(sure("remove the spaces to see it"), "say to remove the spaces");
  assert.ok(sure("text me a screenshot of the listing"));
  assert.ok(sure("contact me on WhatsApp"));
  assert.ok(sure("pay with gift cards"));
  const plain = TK.offSite("call or text 555 123 4567");
  assert.ok(plain && plain.sure === false, "a plain phone number is only a hint");
  assert.equal(TK.offSite("Works great, comes with charger"), null);
  assert.equal(TK.offSite(""), null);
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
  for (const t of clean) assert.equal(TK.offSite(t)?.sure ?? false, false, t);
});

test("offSite: the disguised forms are still caught", () => {
  const sure = (t) => TK.offSite(t)?.sure === true;
  assert.ok(sure("go to jmyzl dot com"), "dot as a word");
  assert.ok(sure("go to jmyzl [dot] shop"), "dot in brackets");
  assert.ok(sure("go to jmyzl (dot) store"));
  assert.ok(sure("go to jmyzl .com"), "space before the dot");
  assert.ok(sure("go to jmyzl. com now"), "space after the dot, lower case ending");
  assert.ok(sure("WWW . JMYZL . COM"));
  assert.ok(sure("pay only with gift cards"));
  assert.ok(sure("send me a screenshot of the code"));
});

test("prices in another currency aren't read as US dollars", () => {
  for (const t of ["C $20.00", "AU $35.00", "£15.00", "EUR 12,00", "CA $9.99", "NZ $5"]) assert.equal(TK.foreignCurrency(t), true, t);
  for (const t of ["$20.00", "US $20.00", "$1,249.99", "Was $45", "WAS $45", "MSRP $50", ""]) assert.equal(TK.foreignCurrency(t), false, t);
  assert.equal(TK.usdPrice("$20.00"), 20);
  assert.equal(TK.usdPrice("C $20.00"), null, "unknown rather than wrong");
  assert.equal(TK.usdPrice("C $20.00", "C $20.00 Approximately US $14.60 Buy It Now"), 14.6, "eBay's own conversion when it's there");
  assert.equal(TK.usdPrice("C $20.00", "C $20.00 +US $5.00 shipping"), null, "a US shipping cost is not the price");
  assert.equal(TK.usdPrice("C $20.00", "C $20.00 US $5.00 delivery"), null);
});

test("price ranges are spotted", () => {
  assert.equal(TK.isPriceRange("$45.00 to $60.00"), true);
  assert.equal(TK.isPriceRange("$45 - $60"), true);
  assert.equal(TK.isPriceRange("US $45.00 to US $60.00"), true);
  assert.equal(TK.isPriceRange("$45.00"), false);
  assert.equal(TK.isPriceRange("$45.00 + $5 shipping"), false);
});

test("leftOutSold names what a sold summary left out", () => {
  assert.deepEqual(TK.leftOutSold({ offers: 1, lots: 2, foreign: 3, ranges: 1, parts: 0 }), ["1 best-offer sale (the real price isn't shown)", "2 lots", "3 in another currency", "1 with a price range"]);
  assert.deepEqual(TK.leftOutSold(undefined), []);
});

test("joinedYear and listedDaysAgo read what a listing page says", () => {
  assert.equal(TK.joinedYear("Seller details Joined Facebook in 2019"), 2019);
  assert.equal(TK.joinedYear("Joined in 2024"), 2024);
  assert.equal(TK.joinedYear("joined facebook in 1999"), null);
  assert.equal(TK.joinedYear("nothing here"), null);
  assert.equal(TK.listedDaysAgo("Listed 3 weeks ago in Albuquerque, NM"), 21);
  assert.equal(TK.listedDaysAgo("Listed a day ago"), 1);
  assert.equal(TK.listedDaysAgo("Listed over a year ago"), 365);
  assert.equal(TK.listedDaysAgo("Listed 5 hours ago"), 0.2);
  const now = Date.parse("2026-10-14T12:00:00");
  assert.equal(TK.listedDaysAgo("Listed on Oct 3, 2026", now), 11);
  assert.equal(TK.listedDaysAgo("no date"), null);
});

test("currencyOf and parseAmount: Marketplace prices in the buyer's own currency", () => {
  assert.equal(TK.currencyOf("CA$200"), "CA$");
  assert.equal(TK.currencyOf("C $20.00"), "C$");
  assert.equal(TK.currencyOf("£85"), "£");
  assert.equal(TK.currencyOf("€40.50"), "€");
  assert.equal(TK.currencyOf("$200"), "");
  assert.equal(TK.currencyOf("US $20.00"), "");
  assert.equal(TK.parseAmount("CA$1,200"), 1200);
  assert.equal(TK.parseAmount("£85"), 85);
  assert.equal(TK.parseAmount("$165"), 165);
  assert.equal(TK.parseAmount("Free"), null);
});

// The blueprint's mixed "nintendo switch" sales: 10 plain ones around $160, 8 Lites around $95, 8 OLEDs around $240.
const mixedSwitch = () => [
  ...[150, 155, 158, 160, 160, 162, 165, 168, 170, 155].map((total, i) => ({ title: `Nintendo Switch V2 Console Gray ${i}`, total, shipping: 12, url: `https://www.ebay.com/itm/10000000000${i}` })),
  ...[88, 90, 92, 95, 95, 98, 100, 102].map((total, i) => ({ title: `Nintendo Switch Lite Coral ${i}`, total, shipping: 8 })),
  ...[230, 235, 238, 240, 240, 245, 248, 250].map((total, i) => ({ title: `Nintendo Switch OLED White ${i}`, total, shipping: 14 })),
];

test("soldStats: median, spread, confidence, shipping and the sales nearest the median", () => {
  const s = TK.soldStats(mixedSwitch().slice(0, 10));
  assert.deepEqual([s.n, s.median, s.confidence, s.ship, s.samples.length], [10, 160, "fair", 12, 5]);
  assert.ok(s.p10 <= s.p25 && s.p25 <= s.median && s.median <= s.p75);
});

test("soldVariants: each version with 5+ sales gets its own numbers, the plain ones theirs with 8+", () => {
  const v = TK.soldVariants(mixedSwitch(), "nintendo switch");
  assert.deepEqual(Object.keys(v).sort(), ["_base", "lite", "oled"]);
  assert.deepEqual([v.lite.median, v._base.median, v.oled.median], [95, 160, 240]);
  assert.deepEqual([v.lite.n, v._base.n, v.oled.n], [8, 10, 8]);
  assert.equal(v.lite.samples, undefined, "no samples or shipping per version: the cache entry stays small");
  assert.ok(JSON.stringify(v).length < 400, JSON.stringify(v).length);
  // The acceptance check: a card of each kind gets its own version's typical price, before any scan.
  const market = { ...TK.soldStats(mixedSwitch()), variants: v };
  const R = globalThis.TKRules;
  assert.equal(R.forVariant(market, { title: "Nintendo Switch Lite Turquoise" }).median, 95);
  assert.equal(R.forVariant(market, { title: "Nintendo Switch Console Neon" }).median, 160);
  assert.equal(R.forVariant(market, { title: "Nintendo Switch OLED Model" }).median, 240);
  // Fewer than 8 plain ones: no base numbers, the plain ones use the whole market.
  const few = TK.soldVariants(mixedSwitch().slice(3), "nintendo switch");
  assert.equal(few._base, undefined);
  assert.equal(R.forVariant({ ...market, variants: few }, { title: "Nintendo Switch Console" }).median, market.median);
  // A version with 4 sales is too few.
  assert.equal(TK.soldVariants(mixedSwitch().filter((s, i) => !/Lite/.test(s.title) || i < 14), "nintendo switch").lite, undefined);
  // The search names the version: "oled" is the thing itself, a Lite still another version.
  const oled = TK.soldVariants(mixedSwitch(), "switch oled");
  assert.deepEqual(oled._same, ["oled"]);
  assert.deepEqual(Object.keys(oled).sort(), ["_base", "_same", "lite"]);
  assert.equal(TK.soldVariants(mixedSwitch().slice(0, 10), "nintendo switch"), null, "no version stands out");
});
