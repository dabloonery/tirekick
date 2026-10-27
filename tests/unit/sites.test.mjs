// The table of sites (lib/sites.js) and what every site needs elsewhere: a site added in one place and
// forgotten in another fails here, not on someone's page.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadScripts } from "../helpers/load.mjs";

const { TK } = await loadScripts();
const Sites = globalThis.TKSites;
const manifest = JSON.parse(fs.readFileSync(new URL("../../manifest.json", import.meta.url)));

test("each site has its own id and key, and a name", () => {
  const ids = Sites.all.map((s) => s.id);
  const keys = Sites.all.map((s) => s.key);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(keys).size, keys.length);
  for (const s of Sites.all) assert.ok(s.name && s.owner && s.home.startsWith("https://"), s.id);
  assert.equal(Sites.all.filter((s) => s.soldReference).length, 1, "one site is the price reference");
});

test("the manifest can reach every site (host permission, required or optional)", () => {
  const hosts = [...(manifest.host_permissions || []), ...(manifest.optional_host_permissions || [])];
  for (const m of Sites.matches()) assert.ok(hosts.includes(m) || hosts.includes("https://*/*"), m);
});

test("every site has its page readers, search builder, card finder and browse wording", () => {
  for (const s of Sites.all) {
    for (const table of ["READERS", "ITEM_READERS", "SEARCH_BUILDERS", "LISTING_LINKS", "CARD_FINDERS", "BROWSE_CONTEXT"]) {
      assert.ok(TK[table]?.[s.id], `${table}.${s.id}`);
    }
  }
});

test("listing keys and addresses go both ways, as before", () => {
  assert.equal(Sites.keyOf("https://www.ebay.com/itm/Pentax-K1000/184891897312?hash=x"), "ebay:184891897312");
  assert.equal(Sites.keyOf("https://www.facebook.com/marketplace/item/1590480216438381/?ref=search"), "fb:1590480216438381");
  assert.equal(Sites.keyOf("https://example.com/thing?x=1"), "https://example.com/thing");
  assert.equal(Sites.itemUrl("ebay:184891897312"), "https://www.ebay.com/itm/184891897312");
  assert.equal(Sites.itemUrl("fb:42"), "https://www.facebook.com/marketplace/item/42/");
  assert.equal(Sites.nameOf("fb:42"), "Marketplace");
  assert.equal(Sites.nameOf("ebay:1"), "eBay");
  assert.equal(Sites.nameOf("facebook"), "Marketplace");
  assert.equal(Sites.get("ebay").searchUrl("game boy & sp"), "https://www.ebay.com/sch/i.html?_nkw=game%20boy%20%26%20sp");
  assert.equal(Sites.get("facebook").searchUrl("game boy"), "https://www.facebook.com/marketplace/search?query=game%20boy");
});

test("which page is which", () => {
  const at = (u) => new URL(u);
  const ebay = Sites.get("ebay");
  const fb = Sites.get("facebook");
  assert.equal(Sites.here(at("https://www.ebay.com/sch/i.html?_nkw=x")).id, "ebay");
  assert.equal(Sites.here(at("https://www.facebook.com/marketplace/")).id, "facebook");
  assert.equal(Sites.here(at("https://www.facebook.com/groups/1")), null, "Facebook outside Marketplace isn't ours");
  assert.equal(Sites.here(at("https://example.com/")), null);
  assert.deepEqual(["/", "/itm/1", "/sch/i.html", "/b/Cameras/1", "/help"].map((p) => ebay.pageType(at(`https://www.ebay.com${p}`))), ["home", "item", "results", "results", "other"]);
  assert.deepEqual(["/marketplace/item/1/", "/marketplace/search?query=x", "/marketplace/"].map((p) => fb.pageType(at(`https://www.facebook.com${p}`))), ["item", "results", "results"]);
  assert.equal(ebay.queryOf(at("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000")), "pentax k1000");
  assert.equal(fb.queryOf(at("https://www.facebook.com/marketplace/search?query=game%20boy")), "game boy");
});

test("photos only from the sites' own hosts; saved searches only to their search pages", () => {
  for (const h of ["i.ebayimg.com", "scontent-lax3-1.xx.fbcdn.net", "www.ebay.com"]) assert.ok(Sites.isImageHost(h), h);
  for (const h of ["evil.example", "ebayimg.com.evil.example", "localhost"]) assert.ok(!Sites.isImageHost(h), h);
  assert.ok(Sites.isSearchUrl(new URL("https://www.ebay.com/sch/i.html?_nkw=x")));
  assert.ok(Sites.isSearchUrl(new URL("https://www.facebook.com/marketplace/search?query=x")));
  assert.ok(!Sites.isSearchUrl(new URL("https://www.ebay.com/itm/1")));
  assert.ok(!Sites.isSearchUrl(new URL("https://www.facebook.com/groups/1")));
});

test("the store's own price filter, read from and written to its address", () => {
  const ebay = "https://www.ebay.com/sch/i.html?_nkw=pentax%20k1000&_pgn=3";
  const price = (u) => (({ min, max }) => ({ min, max }))(Sites.readFilters(u));
  assert.deepEqual(price(ebay), { min: 0, max: 0 });
  assert.deepEqual(price("https://www.ebay.com/sch/i.html?_nkw=x&_udlo=20&_udhi=99.5"), { min: 20, max: 100 });
  assert.deepEqual(price("https://www.ebay.com/sch/i.html?_nkw=x&_udlo=junk"), { min: 0, max: 0 });
  // whole dollars, rounded outward so the store keeps every listing Tirekick would; a new range starts at page 1
  const set = new URL(Sites.withFilters(ebay, { min: 19.6, max: 80.2 }));
  assert.equal(set.searchParams.get("_udlo"), "19");
  assert.equal(set.searchParams.get("_udhi"), "81");
  assert.equal(set.searchParams.has("_pgn"), false);
  assert.equal(set.searchParams.get("_nkw"), "pentax k1000");
  assert.deepEqual(price(set), { min: 19, max: 81 });
  // nothing to change: the address comes back exactly as it was, page number and spelling included
  assert.equal(Sites.withFilters(ebay, { min: 0, max: 0 }), ebay);
  assert.equal(Sites.hasFilters(set, { min: 19.6, max: 80.2 }), true);
  assert.equal(Sites.hasFilters(set, { max: 90 }), false);
  // 0 takes a setting off; a field left out stays
  const off = new URL(Sites.withFilters(set, { max: 0 }));
  assert.equal(off.searchParams.has("_udhi"), false);
  assert.equal(off.searchParams.get("_udlo"), "19");
  const fb = new URL(Sites.withFilters("https://www.facebook.com/marketplace/albuquerque/search?query=camera", { min: 5, max: 100 }));
  assert.equal(fb.searchParams.get("minPrice"), "5");
  assert.equal(fb.searchParams.get("maxPrice"), "100");
  assert.deepEqual(price(fb), { min: 5, max: 100 });
  // not a store page: nothing to read or write
  assert.deepEqual(Sites.readFilters("https://example.com/?_udlo=5"), {});
  assert.equal(Sites.withFilters("https://example.com/?a=1", { min: 5 }), "https://example.com/?a=1");
});

test("the store's own choices: condition, Buy It Now or Auction, shipping, delivery, listed within", () => {
  const ebay = "https://www.ebay.com/sch/i.html?_nkw=x&_pgn=2";
  assert.deepEqual(Sites.readFilters(ebay), { min: 0, max: 0, cond: "", format: "", freeShip: "", usOnly: "" });
  const set = Sites.withFilters(ebay, { cond: "parts", format: "auction", freeShip: "on", usOnly: "on" });
  const p = new URL(set).searchParams;
  assert.deepEqual([p.get("LH_ItemCondition"), p.get("LH_Auction"), p.get("LH_FS"), p.get("LH_PrefLoc"), p.has("LH_BIN"), p.has("_pgn")], ["7000", "1", "1", "1", false, false]);
  assert.deepEqual(Sites.readFilters(set), { min: 0, max: 0, cond: "parts", format: "auction", freeShip: "on", usOnly: "on" });
  // switching a choice takes the old one's setting off; "" takes it off altogether
  const bin = new URL(Sites.withFilters(set, { format: "bin", freeShip: "" })).searchParams;
  assert.deepEqual([bin.get("LH_BIN"), bin.has("LH_Auction"), bin.has("LH_FS"), bin.get("LH_ItemCondition")], ["1", false, false, "7000"]);
  // a setting Tirekick doesn't offer (eBay's refurbished, or two conditions) reads "?" and is left alone
  const refurb = "https://www.ebay.com/sch/i.html?_nkw=x&LH_ItemCondition=2000%7C3000";
  assert.equal(Sites.readFilters(refurb).cond, "?");
  assert.equal(Sites.hasFilters(refurb, { cond: "?" }), true);
  assert.equal(new URL(Sites.withFilters(refurb, { cond: "?", max: 50 })).searchParams.get("LH_ItemCondition"), "2000|3000");
  const fb = Sites.withFilters("https://www.facebook.com/marketplace/albuquerque/search?query=camera", { cond: "used", delivery: "pickup", listed: "7" });
  const q = new URL(fb).searchParams;
  assert.deepEqual([q.get("itemCondition"), q.get("deliveryMethod"), q.get("daysSinceListed")], ["used_like_new,used_good,used_fair", "local_pick_up", "7"]);
  assert.deepEqual(Sites.readFilters(fb), { min: 0, max: 0, cond: "used", delivery: "pickup", listed: "7" });
  // a filter one store doesn't have is ignored there
  assert.equal(Sites.withFilters("https://www.facebook.com/marketplace/search?query=x", { format: "bin" }), "https://www.facebook.com/marketplace/search?query=x");
});

test("every store filter is a price or a set of choices with distinct values and labels", () => {
  for (const s of Sites.all) {
    const names = s.storeFilters.map((f) => f.name);
    assert.equal(new Set(names).size, names.length, s.id);
    for (const f of s.storeFilters) {
      assert.ok(/^[A-Za-z]{1,20}$/.test(f.name), f.name);
      if (f.money) { assert.ok(f.param && ["down", "up"].includes(f.money), f.name); continue; }
      assert.ok(f.label && f.choices.length, f.name);
      const values = f.choices.map((c) => c.value);
      assert.equal(new Set(values).size, values.length, f.name);
      for (const c of f.choices) assert.ok(/^[a-z0-9]{1,20}$/.test(c.value) && c.label && Object.keys(c.params).length, `${f.name}.${c.value}`);
    }
  }
});

test("Craigslist: opt in, a host per city, keys from the post number", () => {
  const cl = Sites.get("craigslist");
  assert.deepEqual(Sites.inUse().map((s) => s.id), ["ebay", "facebook"], "off until turned on");
  assert.deepEqual(Sites.inUse({ onCraigslist: true }).map((s) => s.id), ["ebay", "facebook", "craigslist"]);
  assert.deepEqual(Sites.matches(Sites.inUse()), ["https://www.ebay.com/*", "https://www.facebook.com/*"]);
  assert.deepEqual(Sites.originsOf(cl), ["https://*.craigslist.org/*", "https://images.craigslist.org/*"]);
  for (const o of Sites.originsOf(cl)) assert.ok(manifest.optional_host_permissions.includes(o), o);
  for (const o of Sites.originsOf(cl)) assert.ok(!manifest.host_permissions.includes(o), "never a required host: Chrome would turn Tirekick off on update");
  assert.equal(Sites.keyOf("https://sfbay.craigslist.org/sfc/vgm/d/san-francisco-switch/7791000001.html"), "cl:7791000001");
  assert.equal(Sites.keyOf("https://sfbay.craigslist.org.evil.example/sfc/vgm/d/x/7791000001.html"), "https://sfbay.craigslist.org.evil.example/sfc/vgm/d/x/7791000001.html");
  assert.equal(Sites.nameOf("cl:7791000001"), "Craigslist");
  assert.equal(Sites.itemUrl("cl:7791000001"), "", "a post's address needs its city: saved listings keep their own");
  assert.ok(Sites.isSiteHost("sfbay.craigslist.org") && Sites.isSiteHost("www.craigslist.org"));
  assert.ok(!Sites.isSiteHost("craigslist.org.evil.example") && !Sites.isSiteHost("evilcraigslist.org"));
  assert.ok(Sites.isImageHost("images.craigslist.org") && !Sites.isImageHost("sfbay.craigslist.org"));
  assert.ok(Sites.isSearchUrl(new URL("https://sfbay.craigslist.org/search/sss?query=x")) && !Sites.isSearchUrl(new URL("https://sfbay.craigslist.org/about/help")));
  const at = (u) => new URL(u);
  assert.deepEqual(["/", "/search/sss?query=x", "/sfc/vgm/d/x/7791000001.html", "/about/help"].map((p) => cl.pageType(at(`https://sfbay.craigslist.org${p}`))), ["home", "results", "item", "other"]);
  assert.equal(cl.queryOf(at("https://sfbay.craigslist.org/search/sss?query=game+boy")), "game boy");
  assert.equal(cl.searchUrl("game boy"), "https://www.craigslist.org/search/sss?query=game%20boy");
  const f = new URL(Sites.withFilters("https://sfbay.craigslist.org/search/sss?query=switch", { min: 20, max: 99.5 }));
  assert.deepEqual([f.searchParams.get("min_price"), f.searchParams.get("max_price")], ["20", "100"]);
});

test("Craigslist as addressed today: www.craigslist.org/view/… posts keyed by their code, /search/area/… searches", () => {
  const cl = Sites.get("craigslist");
  const at = (u) => new URL(u);
  const post = "https://www.craigslist.org/view/d/albuquerque-nintendo-switch-wireless/wVo8Fw1YFEXCw2vSs6CZ92";
  assert.equal(Sites.keyOf(post), "cl:wVo8Fw1YFEXCw2vSs6CZ92");
  assert.equal(Sites.keyOf("https://www.craigslist.org/view/5UAWWjKyUjM75ZEmeiujnW"), "cl:5UAWWjKyUjM75ZEmeiujnW", "Craigslist's own prev and next links");
  assert.equal(Sites.itemUrl("cl:wVo8Fw1YFEXCw2vSs6CZ92"), "https://www.craigslist.org/view/wVo8Fw1YFEXCw2vSs6CZ92");
  assert.equal(Sites.here(at(post)).id, "craigslist");
  assert.deepEqual([post, "https://www.craigslist.org/search/area/albuquerque?cat=ela", "https://www.craigslist.org/view/d/x"].map((u) => cl.pageType(at(u))), ["item", "results", "other"]);
  assert.equal(Sites.keyOf("https://www.craigslist.org/about/help/safety/scams"), "https://www.craigslist.org/about/help/safety/scams");
});
