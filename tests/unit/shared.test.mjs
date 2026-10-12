import test from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load.mjs";

const { S } = await loadScripts();

test("safeUrl keeps only https addresses on eBay and Facebook", () => {
  const ok = ["https://www.ebay.com/itm/123", "https://www.ebay.com/sch/i.html?_nkw=snes", "https://www.facebook.com/marketplace/item/9/"];
  for (const u of ok) assert.equal(S.safeUrl(u, "X"), u);
  const bad = [
    "javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "http://www.ebay.com/itm/1", "https://evil.example/phish",
    "https://www.ebay.com.evil.example/itm/1", "https://www.ebay.com@evil.example/", "https://user:pw@www.ebay.com/", "https://www.ebay.com:8443/", "ftp://www.ebay.com/", "not a url", "", undefined, null,
  ];
  for (const u of bad) assert.equal(S.safeUrl(u, "FALLBACK"), "FALLBACK", String(u));
  assert.equal(S.safeUrl("javascript:1"), "", "no fallback gives an empty string");
});

test("dropped: at least 3% or a dollar cheaper than when saved", () => {
  assert.equal(S.dropped({ p0: 100, p: 96 }), true);
  assert.equal(S.dropped({ p0: 100, p: 98 }), false, "2% is noise");
  assert.equal(S.dropped({ p0: 20, p: 18.5 }), true, "a dollar and a half on twenty counts");
  assert.equal(S.dropped({ p0: 20, p: 19.5 }), false);
  assert.equal(S.dropped({ p0: 100, p: 120 }), false, "going up is not a drop");
  assert.equal(S.dropped({ p0: null, p: 5 }), false);
  assert.equal(S.dropped(undefined), false);
});

test("alerts: cheaper saved listings and saved searches with listings at your price", () => {
  const saved = { "ebay:1": { t: "A", p0: 70, p: 52, a: 5 }, "ebay:2": { t: "B", p0: 79, p: 79, a: 4 }, "fb:3": { t: "C", p0: 120, p: 95, a: 9 } };
  const searches = { "ebay|x": { q: "x", deal: 60, deals: 4, v: 7 }, "ebay|y": { q: "y", deal: 80, deals: 0, v: 8 } };
  const list = S.alerts(saved, searches, {});
  assert.deepEqual(list.map((a) => a.id).sort(), ["l:ebay:1", "l:fb:3", "s:ebay|x"]);
  assert.ok(list.every((a) => a.isNew));
  assert.equal(list[0].when, 9, "newest first");
  const seen = S.alerts(saved, searches, { "l:ebay:1": 52, "s:ebay|x": 4 });
  assert.deepEqual(seen.filter((a) => a.isNew).map((a) => a.id), ["l:fb:3"]);
  const cheaper = S.alerts({ ...saved, "ebay:1": { t: "A", p0: 70, p: 45, a: 6 } }, searches, { "l:ebay:1": 52 });
  assert.ok(cheaper.find((a) => a.id === "l:ebay:1").isNew, "a further drop is new again");
  assert.deepEqual(S.alerts(), []);
});

test("alertSummary says what the toolbar number means", () => {
  const a = S.alerts({ "ebay:1": { p0: 70, p: 52 }, "ebay:2": { p0: 10, p: 5 } }, { s: { q: "s", deals: 1 } }, {});
  assert.equal(S.alertSummary(a), "2 saved listings got cheaper; 1 saved search had listings at your price");
  assert.equal(S.alertSummary([]), "");
});

test("filterFromLists turns the old two lists into the filter bar's words", () => {
  assert.equal(S.filterFromLists("replica, box only,\nrepro/reproduction", "tested/working, with charger"), '-replica -"box only" -repro/reproduction tested/working "with charger"');
  assert.equal(S.filterFromLists("", ""), "");
  assert.equal(S.filterFromLists(undefined, undefined), "");
});

test("isListingImage: only the two sites' own image hosts, over https", () => {
  const ok = ["https://i.ebayimg.com/images/g/abc/s-l1600.jpg", "https://scontent-lax3-1.xx.fbcdn.net/v/t45/1.jpg", "https://ir.ebaystatic.com/x.png", "https://www.facebook.com/photo.jpg"];
  for (const u of ok) assert.equal(S.isListingImage(u), true, u);
  const bad = ["http://i.ebayimg.com/a.jpg", "https://evil.example/a.jpg", "http://127.0.0.1:11434/api/tags", "https://i.ebayimg.com.evil.example/a.jpg", "https://i.ebayimg.com@evil.example/a.jpg", "https://i.ebayimg.com:8443/a.jpg", "data:image/gif;base64,R0lGOD", "javascript:1", "", undefined];
  for (const u of bad) assert.equal(S.isListingImage(u), false, String(u));
});

test("cleanSetting: what a settings value may be", () => {
  assert.equal(S.cleanSetting("feePct", 12.5), 12.5);
  assert.equal(S.cleanSetting("feePct", 90), 50, "clamped");
  assert.equal(S.cleanSetting("feePct", "12"), undefined, "a number setting holds a number");
  assert.equal(S.cleanSetting("feePct", NaN), undefined);
  assert.equal(S.cleanSetting("batchSize", 0), 10, "not a usable number: the default");
  assert.equal(S.cleanSetting("batchSize", 7.6), 8);
  assert.equal(S.cleanSetting("provider", "ollama"), "ollama");
  assert.equal(S.cleanSetting("provider", "evil"), undefined);
  assert.equal(S.cleanSetting("useSoldComps", false), false);
  assert.equal(S.cleanSetting("useSoldComps", "false"), undefined);
  assert.equal(S.cleanSetting("ollamaUrl", " http://localhost:11434/ "), "http://localhost:11434");
  for (const bad of ["javascript:alert(1)", "file:///etc/passwd", "http://user:pw@host/", "nope", ""]) assert.equal(S.cleanSetting("oaiUrl", bad), undefined, bad);
  assert.equal(S.cleanSetting("textModel", 42), undefined);
  assert.equal(S.cleanSetting("interests", "x".repeat(9000)).length, 4000);
  assert.equal(S.cleanSetting("textModel", "x".repeat(900)).length, 300);
});

test("itemUrl, searchUrl, savedItemUrl: where saved things lead", () => {
  assert.equal(S.itemUrl("ebay:123"), "https://www.ebay.com/itm/123");
  assert.equal(S.itemUrl("fb:77"), "https://www.facebook.com/marketplace/item/77/");
  assert.equal(S.savedItemUrl("ebay:123", { u: "https://evil.example/" }), "https://www.ebay.com/itm/123");
  assert.equal(S.savedItemUrl("ebay:123", { u: "https://www.ebay.com/itm/123?x=1" }), "https://www.ebay.com/itm/123?x=1");
  assert.equal(S.searchUrl({ site: "ebay", q: "game boy", url: "javascript:1" }), "https://www.ebay.com/sch/i.html?_nkw=game%20boy");
  assert.equal(S.searchUrl({ site: "facebook", q: "snes" }), "https://www.facebook.com/marketplace/search?query=snes");
});

test("usageSummary: today, this month, last month, and the models behind this month", () => {
  const now = new Date(2026, 9, 10, 12); // 10 October 2026
  const usage = { days: {
    "2026-10-10": { usd: 0.1, calls: 2, models: { a: { usd: 0.1, calls: 2 } } },
    "2026-10-02": { usd: 0.4, calls: 3, models: { a: { usd: 0.3, calls: 2 }, b: { usd: 0.1, calls: 1 } } },
    "2026-09-28": { usd: 0.7, calls: 5, models: { a: { usd: 0.7, calls: 5 } } },
  } };
  const s = S.usageSummary(usage, now);
  assert.equal(+s.today.toFixed(2), 0.1);
  assert.equal(+s.month.toFixed(2), 0.5);
  assert.equal(+s.last.toFixed(2), 0.7);
  assert.equal(s.calls, 5);
  assert.equal(+s.models.a.usd.toFixed(2), 0.4);
  assert.deepEqual(S.usageSummary(undefined, now), { today: 0, month: 0, last: 0, calls: 0, models: {} });
});
