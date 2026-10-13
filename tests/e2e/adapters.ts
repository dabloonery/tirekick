// The site adapters against the saved pages in tests/fixtures, at their real addresses (the mock server adds the
// plain scripts to each page). When eBay or Facebook change their markup, save a fresh copy of the page over the
// fixture and this shows what broke (tests/README.md).   tests/e2e/run.sh adapters.ts
import { start, sleep } from "./lib.ts";
const { open, c } = await start();
let fails = 0;
const ok = (name: string, cond: unknown, why: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ": " + JSON.stringify(why)}`);
};
const page = async (url: string, fixture: string) => {
  const p = await open(`${url}${url.includes("?") ? "&" : "?"}fixture=${fixture}`);
  await sleep(300);
  return p;
};
// the listings without their DOM element
const extract = (p: any) => p.ev(`Tirekick.extract().map(({ el, ...it }) => it)`);
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

let p = await page("https://www.ebay.com/sch/i.html?_nkw=game+boy+sp", "ebay-results");
let items = await extract(p);
ok("eBay results (2025 layout): five listings, the repeat and the ad skipped", eq(items.map((i: any) => i.price), [52, 79, 38, 41, 90]), items.map((i: any) => i.price));
ok("…titles without 'New Listing'", items[0].title === "Nintendo Game Boy Advance SP AGS-001 Cobalt Blue Working" && items[1].title === "Game Boy Advance SP Pearl Blue w/ charger", [items[0].title, items[1].title]);
ok("…shipping and totals, null when the card doesn't say", eq([items[0].shipping, items[0].total, items[1].shipping, items[1].total, items[2].shipping], [0, 52, 8.5, 87.5, null]));
ok("…seller ratings, auctions, lots and offers", eq([items[0].sellerPct, items[0].sellerCount, items[3].auction, items[3].bids, items[3].hoursLeft, items[4].lot, items[4].bestOffer], [99.2, 412, true, 3, 52, 6, true]));
ok("…photo and link", /ebayimg\.com/.test(items[0].imageUrl) && /^https:\/\/www\.ebay\.com\/itm\/100000000001/.test(items[0].url));
ok("…page type and search words", (await p.ev(`Tirekick.pageType()`)) === "results" && (await p.ev(`Tirekick.ebayQuery()`)) === "game boy sp");

p = await page("https://www.ebay.com/sch/i.html?_nkw=snes", "ebay-results-old");
items = await extract(p);
ok("eBay results (older layout)", items.length === 2 && items[0].title === "Super Nintendo SNES Console Bundle 2 Controllers" && eq([items[0].price, items[0].shipping, items[0].total, items[1].price, items[1].shipping], [95, 12.35, 107.35, 24.99, 0]), items.map((i: any) => [i.title, i.price, i.shipping]));

p = await page("https://www.ebay.com/b/Video-Game-Consoles/139971/bn_320", "ebay-category");
items = await extract(p);
ok("eBay category page", eq(items.map((i: any) => [i.title, i.price]), [["Sony PlayStation 2 Slim Console SCPH-77001", 64], ["Nintendo Wii White Console Tested", 45]]) && (await p.ev(`Tirekick.pageType()`)) === "results" && /Video Game Consoles/i.test(await p.ev(`Tirekick.browseContext()`)), items.map((i: any) => [i.title, i.price]));

p = await page("https://www.ebay.com/sch/i.html?_nkw=x", "ebay-sold");
const m = await p.ev(`(({samples, ...m}) => ({...m, samples: samples.length}))(Tirekick.summarizeSold(document.documentElement.outerHTML))`);
ok("sold listings become a median; eBay's looser matches are left out", m.n === 8 && m.median === 56 && m.p25 === 51 && m.p75 === 59 && m.samples === 5, m);
ok("…too few sales to trust gives nothing", (await p.ev(`Tirekick.summarizeSold("<ul><li class='s-card'><a href='https://www.ebay.com/itm/9'><div class='s-card__title'>x</div></a><div class='s-card__price'>$5</div></li></ul>")`)) === null);

p = await page("https://www.ebay.com/itm/100000000001", "ebay-item");
const it = await p.ev(`(({el, ...it}) => it)(Tirekick.extractItem())`);
ok("eBay listing page: title, price, shipping with no plus sign, total", it.title === "Nintendo Game Boy Advance SP AGS-001 Cobalt Blue Working" && eq([it.price, it.shipping, it.total], [52, 8.5, 60.5]), [it.title, it.price, it.shipping, it.total]);
ok("…condition, seller, details", it.condition === "Used" && /retro_roundup/.test(it.seller) && eq([it.sellerPct, it.sellerCount], [99.2, 412]) && /powers on/.test(it.details), [it.condition, it.seller, it.sellerPct, it.sellerCount]);
ok("…the carousel photos, big, without the og:image repeat", it.imageUrls?.length === 2 && /s-l1600/.test(it.imageUrls[0]), it.imageUrls);
ok("…page type", (await p.ev(`Tirekick.pageType()`)) === "item");

p = await page("https://www.facebook.com/marketplace/search?query=game+boy", "facebook-marketplace");
items = await extract(p);
ok("Facebook Marketplace (synthetic page): titles and prices", eq(items.map((i: any) => [i.title, i.price]), [["Nintendo Game Boy Advance SP", 40], ["Game Boy Advance SP M2465", 25], ["Box of old cartridges, take them all", 0], ["Super Nintendo console with 2 controllers", 120]]), items.map((i: any) => [i.title, i.price]));
ok("…clean links, title codes and Just listed", items[0].url === "https://www.facebook.com/marketplace/item/1001/" && items[1].titleCode === "M2465" && items[1].justListed === true && items[0].titleCode === "", [items[0].url, items[1].titleCode, items[1].justListed]);
ok("…page type and search words", (await p.ev(`Tirekick.pageType()`)) === "results" && (await p.ev(`Tirekick.facebookQuery()`)) === "game boy");
console.log(fails ? `${fails} FAILED` : "all passed");
c.close();
