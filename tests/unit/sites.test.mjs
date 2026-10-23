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
  assert.deepEqual(Sites.readFilters(ebay), { min: 0, max: 0 });
  assert.deepEqual(Sites.readFilters("https://www.ebay.com/sch/i.html?_nkw=x&_udlo=20&_udhi=99.5"), { min: 20, max: 100 });
  assert.deepEqual(Sites.readFilters("https://www.ebay.com/sch/i.html?_nkw=x&_udlo=junk"), { min: 0, max: 0 });
  // whole dollars, rounded outward so the store keeps every listing Tirekick would; a new range starts at page 1
  const set = new URL(Sites.withFilters(ebay, { min: 19.6, max: 80.2 }));
  assert.equal(set.searchParams.get("_udlo"), "19");
  assert.equal(set.searchParams.get("_udhi"), "81");
  assert.equal(set.searchParams.has("_pgn"), false);
  assert.equal(set.searchParams.get("_nkw"), "pentax k1000");
  assert.deepEqual(Sites.readFilters(set), { min: 19, max: 81 });
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
  assert.deepEqual(Sites.readFilters(fb), { min: 5, max: 100 });
  // not a store page: nothing to read or write
  assert.deepEqual(Sites.readFilters("https://example.com/?_udlo=5"), {});
  assert.equal(Sites.withFilters("https://example.com/?a=1", { min: 5 }), "https://example.com/?a=1");
});
