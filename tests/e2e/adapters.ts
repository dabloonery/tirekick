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

// Odd cards: whatever a page throws at the adapter, it reads what it can and never throws.
{
  const odd = `<ul>
    <li class='s-card'><div class='s-card__title'>No link at all</div><div class='s-card__price'>$5.00</div></li>
    <li class='s-card'><a href='https://www.ebay.com/itm/300000000001'></a><div class='s-card__price'>$5.00</div></li>
    <li class='s-card'><a href='https://www.ebay.com/itm/300000000002'><div class='s-card__title'>Price missing camera body</div></a></li>
    <li class='s-card'><a href='https://www.ebay.com/itm/300000000003'><div class='s-card__title'>Foreign seller camera</div></a><div class='s-card__price'>C $40.00</div><span>Approximately US $29.20</span></li>
    <li class='s-card'><a href='https://www.ebay.com/itm/300000000004'><div class='s-card__title'>Pokémon Red 🎮 cartridge</div></a><div class='s-card__price'>$1,249.99</div><span>+$12.35 delivery</span></li>
    <li class='s-card'><a href='javascript:alert(1)'><div class='s-card__title'>Not a listing</div></a></li>
    <li class='s-card'></li>
  </ul>`;
  const q = await page("https://www.ebay.com/sch/i.html?_nkw=x", "ebay-results");
  const r = await q.ev(`(() => { try { const d = new DOMParser().parseFromString(${JSON.stringify(odd)}, "text/html"); return Tirekick.extractEbay(d).map(({ el, raw, ...it }) => [it.title, it.price, it.total]); } catch (e) { return "THREW " + e.message; } })()`);
  ok("odd cards: no link or no title are skipped, a missing price stays unknown, another currency uses eBay's US price, emoji and accents survive", eq(r, [["Price missing camera body", null, null], ["Foreign seller camera", 29.2, 29.2], ["Pokémon Red 🎮 cartridge", 1249.99, 1262.34]]), r);
  const empty = await q.ev(`(() => { try { document.body.replaceChildren(); return [Tirekick.extract().length, Tirekick.linkedListings(), typeof Tirekick.extractItem().title]; } catch (e) { return "THREW " + e.message; } })()`);
  ok("an empty page reads as nothing, without throwing", eq(empty, [0, 0, "string"]), empty);
  await q.close();
}

// eBay renames its price class: the cards are still read, but a price must never come from the title, the
// shipping or a struck-through old price (a price read that low is a "Likely scam" mark). Unknown beats wrong.
{
  const q = await page("https://www.ebay.com/sch/i.html?_nkw=game+boy+sp", "ebay-results");
  const renamed = await q.ev(`(() => { const d = new DOMParser().parseFromString(document.documentElement.outerHTML.replaceAll("s-card__price", "s-card__amount"), "text/html"); return Tirekick.extractEbay(d).map((it) => it.price); })()`);
  ok("a renamed price class: the fixture's prices are still read", eq(renamed, [52, 79, 38, 41, 90]), renamed);
  const card = (id: number, inner: string, title = `Game Boy Advance SP ${id}`) => `<li class='s-card'><a href='https://www.ebay.com/itm/40000000000${id}'><div class='s-card__title'>${title}</div></a>${inner}</li>`;
  const odd = [
    card(1, `<div class='s-card__amount'>$52.00</div>`, "Game Boy SP - $1 NO RESERVE"),
    card(2, `<div class='x'><span>+$8.50 delivery</span></div><div class='s-card__amount'>$52.00</div>`),
    card(3, `<span class='strikethrough'>$79.99</span><div class='s-card__amount'>$52.00</div>`),
    card(4, `<div><s>$79.99</s></div><div class='s-card__amount'>$52.00</div>`),
    card(5, `<div><span>Was:</span><span>$79.99</span></div><div class='s-card__amount'>$52.00</div>`),
    card(6, `<div><span>Save</span><span>$5.00</span></div><div class='s-card__amount'>$52.00</div>`),
    card(7, `<div class='s-card__amount'>C $40.00</div><span>+$9.00 delivery</span>`),
    card(8, `<div class='s-card__price'>C $40.00</div><span>+US $5.00 shipping</span>`),
    card(9, `<span>+$8.50 delivery</span><span>Free returns</span>`),
  ].join("");
  const r = await q.ev(`(() => { const d = new DOMParser().parseFromString(${JSON.stringify(`<ul>${odd}</ul>`)}, "text/html"); return Tirekick.extractEbay(d).map((it) => it.price); })()`);
  const pr = await q.ev(`(() => { const d = new DOMParser().parseFromString(${JSON.stringify(`<ul>${card(1, "<div class='s-card__price'>$12.99 to $59.99</div>")}${card(2, "<div class='s-card__price'>$5.00</div><span>Current bid</span>")}</ul>`)}, "text/html"); return Tirekick.extractEbay(d).map((it) => [it.price, !!it.priceRange, !!it.auction]); })()`);
  ok("a price range is marked (its low end isn't compared), and a reworded auction is still an auction", eq(pr, [[12.99, true, false], [5, false, true]]), pr);
  ok("…not the title's '$1', the shipping, a struck-through, 'Was' or 'Save' amount; another currency stays unknown, even next to a US shipping cost; no price at all is unknown", eq(r, [52, 52, 52, 52, 52, 52, null, null, null]), r);
  await q.close();
}

p = await page("https://www.ebay.com/sch/i.html?_nkw=snes", "ebay-results-old");
items = await extract(p);
ok("eBay results (older layout)", items.length === 2 && items[0].title === "Super Nintendo SNES Console Bundle 2 Controllers" && eq([items[0].price, items[0].shipping, items[0].total, items[1].price, items[1].shipping], [95, 12.35, 107.35, 24.99, 0]), items.map((i: any) => [i.title, i.price, i.shipping]));

p = await page("https://www.ebay.com/b/Video-Game-Consoles/139971/bn_320", "ebay-category");
items = await extract(p);
ok("eBay category page", eq(items.map((i: any) => [i.title, i.price]), [["Sony PlayStation 2 Slim Console SCPH-77001", 64], ["Nintendo Wii White Console Tested", 45]]) && (await p.ev(`Tirekick.pageType()`)) === "results" && /Video Game Consoles/i.test(await p.ev(`Tirekick.browseContext()`)), items.map((i: any) => [i.title, i.price]));

p = await page("https://www.ebay.com/sch/i.html?_nkw=x", "ebay-sold");
const m = await p.ev(`(({samples, ...m}) => ({...m, samples: samples.length}))(Tirekick.summarizeSold(document.documentElement.outerHTML))`);
ok("sold listings become a median; eBay's looser matches are left out", m.n === 8 && m.median === 56 && m.p25 === 51 && m.p75 === 59 && m.samples === 5 && m.p10 > 0 && m.p10 <= m.p25, m);
ok("…too few sales to trust gives nothing", (await p.ev(`Tirekick.summarizeSold("<ul><li class='s-card'><a href='https://www.ebay.com/itm/9'><div class='s-card__title'>x</div></a><div class='s-card__price'>$5</div></li></ul>")`)) === null);
{
  const card = (id: number, price: string, extra = "") => `<li class='s-card'><a href='https://www.ebay.com/itm/${id}'><div class='s-card__title'>Pentax K1000 camera body ${id}</div></a><div class='s-card__price'>${price}</div>${extra}</li>`;
  const html = `<ul>${[50, 52, 54, 56, 58, 60].map((p, i) => card(100000000 + i, `$${p}.00`)).join("")}${card(200000001, "C $20.00")}${card(200000002, "AU $25.00")}${card(200000003, "$45.00 to $60.00")}${card(200000004, "$90.00", `<p>${"Ships from a smoke-free home. ".repeat(15)}</p><span>Best offer accepted</span>`)}</ul>`;
  const s = await p.ev(`(({samples, ...m}) => m)(Tirekick.summarizeSold(${JSON.stringify(html)}))`);
  ok("sold prices leave out other currencies, price ranges and best offers (even far down a card)", s.n === 6 && s.median === 55 && s.dropped.foreign === 2 && s.dropped.ranges === 1 && s.dropped.offers === 1, s);
}

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
// Facebook changes its cards: the title moves above the price, a new label appears on the photo, the old price
// sits on the same line as the new one. The price and title must still be right, or unknown.
{
  const cards = [
    `<a href="/marketplace/item/2001/"><div>Switch OLED $200 firm</div><div>$250</div><div>Chicago, IL</div></a>`,
    `<a href="/marketplace/item/2002/"><div>Popular near you</div><div>$250</div><div>Nintendo Switch OLED</div><div>Toronto, ON</div></a>`,
    `<a href="/marketplace/item/2003/"><div><span>$165</span><span>$180</span></div><div>PS5 disc edition</div><div>Chicago, IL</div></a>`,
    `<a href="/marketplace/item/2004/"><div>PS5 disc edition</div><div>Chicago, IL</div></a>`,
    `<a href="/marketplace/item/2005/"><div>$40</div><div>Couch, Grey</div><div>Chicago, IL</div></a>`,
  ].join("");
  const r = await p.ev(`(() => { document.querySelector('[role=main]').innerHTML = ${JSON.stringify(cards)}; return Tirekick.extractFacebook(document).map((it) => [it.title, it.price, it.wasPrice ?? null]); })()`);
  ok("Marketplace cards rearranged: the title above the price, a new label, old and new price on one line, no price, a title with a comma", eq(r, [["Switch OLED $200 firm", 250, null], ["Nintendo Switch OLED", 250, null], ["PS5 disc edition", 165, 180], ["PS5 disc edition", null, null], ["Couch, Grey", 40, null]]), r);
}

// Real saved pages (trimmed and sanitized: ids, sellers, places and photos replaced). Hand-made fixtures only test
// what we thought the sites do; these are what they did do.
p = await page("https://www.ebay.com/sch/i.html?_nkw=ipod+classic+5.5", "ebay-results-real");
items = await extract(p);
{
  const by = (k: string) => items.filter((i: any) => i[k]);
  ok("real eBay page: 60 listings, the 'Shop on eBay' placeholder and the carousel skipped, each once", items.length === 60 && new Set(items.map((i: any) => i.url)).size === 60 && !items.some((i: any) => /shop on ebay/i.test(i.title)), items.length);
  ok("…every one has a title (without eBay's screen-reader words) and a price", items.every((i: any) => i.title && !/opens in a new window|^new listing/i.test(i.title) && i.price > 0), items.filter((i: any) => !i.price).map((i: any) => i.title));
  ok("…a range split over three pieces is read whole and marked, not taken for its low end", by("priceRange").length === 10 && items[4].priceText === "$139.99 to $349.99" && items[4].price === 139.99, [by("priceRange").length, items[4].priceText]);
  const cond: Record<string, number> = {};
  for (const i of items) cond[i.condition] = (cond[i.condition] || 0) + 1;
  ok("…eBay's condition under the title, never the seller's blurb beside it", eq(cond, { "Brand New": 3, "Very Good - Refurbished": 5, "Excellent - Refurbished": 7, "Pre-Owned": 42, "Parts Only": 2, "Open Box": 1 }) && items[6].condition === "Very Good - Refurbished", cond);
  ok("…'Parts Only' with nothing about it in the title", items[52].condition === "Parts Only" && !/parts|broken|repair/i.test(items[52].title), [items[52].title, items[52].condition]);
  ok("…seller ratings, a seller with none yet ('0% positive (0)') included", eq([items[20].sellerPct, items[20].sellerCount, items[45].sellerPct, items[45].sellerCount], [99.5, 164500, 0, 0]), [items[20].sellerCount, items[45].sellerPct, items[45].sellerCount]);
  ok("…auctions with their bids, offers, shipping", eq(items.filter((i: any) => i.auction).map((i: any) => i.bids), [1, 19, 1]) && by("bestOffer").length === 12 && eq([items[0].shipping, items[5].shipping, items[5].total], [0, 9.35, 92.34]), [items.filter((i: any) => i.auction).map((i: any) => i.bids), by("bestOffer").length]);
}
// Tirekick's own tag and chips sit inside the cards. Read back, an earlier "Likely scam" or "Typical price"
// went into the next scan as listing text, and a chip could pass for a card fact.
{
  const ours = `<div class="tirekick-marks"><span class="tk-chip">Likely scam</span><span class="tk-chip">3 bids</span><span class="tk-chip">or Best Offer</span><span class="tk-chip">99% positive (2)</span></div>`;
  const r = await p.ev(`(() => { const card = Tirekick.extract()[5].el; card.querySelector("a").insertAdjacentHTML("beforebegin", ${JSON.stringify(ours)}); const it = Tirekick.extract()[5]; return [it.raw, !!it.auction, !!it.bestOffer, it.sellerCount]; })()`);
  ok("eBay: Tirekick's own marks on a card are not read as the listing's", !/Likely scam|3 bids|Best Offer/i.test(r[0]) && eq(r.slice(1), [false, false, 8300]), r);
}
await p.close();

p = await page("https://www.facebook.com/marketplace/search?query=ipod+classic", "facebook-marketplace-real");
items = await extract(p);
{
  // Facebook's own label on each link says "<title>, <price>, [reduced from <old>,] <place>, listing <id>".
  const labels = await p.ev(`[...document.querySelectorAll('a[href*="/marketplace/item/"]')].map((a) => a.getAttribute("aria-label"))`);
  const wrong = items.filter((it: any, n: number) => {
    const [, title, price, was] = labels[n].replace(/\s+/g, " ").match(/^(.*), \$([\d,.]+), (?:reduced from \$([\d,.]+), )?/) || [];
    return it.title !== title || it.price !== +price.replace(/,/g, "") || (it.wasPrice ?? null) !== (was ? +was.replace(/,/g, "") : null);
  });
  ok("real Marketplace page: all 90 listings, each title, price and old price as Facebook labels it", items.length === 90 && !wrong.length, wrong.map((i: any) => [i.title, i.price]));
  ok("…no place, 'Ships to you' or 'Partner listing' taken for a title; clean links", !items.some((i: any) => /, [A-Z]{2}$|^ships to you$|^partner listing$/i.test(i.title)) && items[0].url === "https://www.facebook.com/marketplace/item/900000000000001/", items[0].url);
  ok("…codes at the end of a title, 'Just listed'", eq(items.filter((i: any) => i.titleCode).map((i: any) => i.titleCode), ["T5949", "Y8WV", "M5769"]) && items.filter((i: any) => i.justListed).length === 2);
  const ours = `<div class="tirekick-marks"><span class="tk-chip">Code in title: X1</span><span class="tk-chip">$5</span><span class="tk-chip">Not interested</span></div>`;
  const r = await p.ev(`(() => { document.querySelectorAll('a[href*="/marketplace/item/"]')[2].insertAdjacentHTML("afterbegin", ${JSON.stringify(ours)}); const it = Tirekick.extractFacebook(document)[2]; return [it.title, it.price, it.wasPrice, it.raw]; })()`);
  ok("Marketplace: Tirekick's own marks inside a card are not read as the listing's", r[0] === "PS1 Japanese edition" && r[1] === 50 && r[2] === 70 && !/Code in title|Not interested/.test(r[3]), r);
}
await p.close();
console.log(fails ? `${fails} FAILED` : "all passed");
c.close();
