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

test("alerts: a great find on a saved search, raised again by a newer one", () => {
  const now = Date.now();
  const g1 = { k: "ebay:11", t: "Pentax K1000 with 50mm", p: 85, ref: 140, u: "https://www.ebay.com/itm/11", at: now - 1000 };
  const searches = { "ebay|pentax": { q: "pentax", gk: [g1] }, "ebay|old": { q: "old", gk: [{ ...g1, k: "ebay:9", at: now - 8 * 864e5 }] } };
  const [a] = S.alerts({}, searches, {});
  assert.deepEqual([a.id, a.kind, a.value, a.n, a.top.p, a.isNew], ["g:ebay|pentax", "great", "ebay:11", 1, 85, true], "a week-old one is gone");
  assert.equal(S.alerts({}, searches, { "g:ebay|pentax": "ebay:11" })[0].isNew, false, "seen");
  const merged = S.mergeGreats([g1], [{ k: "ebay:12", t: "K1000 body", p: 60 }, { k: "ebay:11", t: "again" }], now);
  assert.deepEqual(merged.map((g) => [g.k, g.t]), [["ebay:12", "K1000 body"], ["ebay:11", "Pentax K1000 with 50mm"]], "the new one first; one found again keeps its first sighting");
  assert.equal(S.alerts({}, { "ebay|pentax": { q: "pentax", gk: merged } }, { "g:ebay|pentax": "ebay:11" })[0].isNew, true, "a newer find is new again");
  assert.equal(S.mergeGreats([], [...Array(9)].map((_, i) => ({ k: `ebay:${i}` }))).length, S.GREAT_MAX);
  assert.equal(S.alertSummary(S.alerts({}, searches, {})), "1 saved search had a great find");
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

test("localDay: YYYY-MM-DD in local time, whatever locale data the runtime has", () => {
  assert.equal(S.localDay(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
  assert.equal(S.localDay(new Date(2026, 9, 15)), "2026-10-15");
});

test("applyEdit clear: starts from nothing, other ops still apply", () => {
  assert.deepEqual(S.applyEdit({ a: 1, b: 2 }, { clear: true }), {});
  assert.deepEqual(S.applyEdit({ a: 1 }, { clear: true, set: { c: 3 } }), { c: 3 });
});

test("applyEdit: changes to a shared record, described rather than written whole", () => {
  const now = 1_000_000;
  const base = { a: { t: "one", a: 10, p: 5 }, b: { t: "two", a: 20 } };
  assert.deepEqual(S.applyEdit(base, { set: { c: { t: "three", a: 30 }, a: null } }, now), { b: { t: "two", a: 20 }, c: { t: "three", a: 30 } });
  assert.deepEqual(S.applyEdit(base, { add: { a: { t: "new" }, d: 1 } }, now), { ...base, d: 1 }, "add never replaces");
  assert.deepEqual(S.applyEdit(base, { patch: { a: { p: 4 }, gone: { p: 1 } } }, now).a, { t: "one", a: 10, p: 4 });
  assert.equal("gone" in S.applyEdit(base, { patch: { gone: { p: 1 } } }, now), false, "patch doesn't bring back a removed entry");
  assert.deepEqual(S.applyEdit({ s: { c: { X1: "k1" }, a: 1 } }, { upsert: { s: { c: { Y2: "k2" }, a: 2 }, n: { a: 3 } } }, now), { s: { c: { X1: "k1", Y2: "k2" }, a: 2 }, n: { a: 3 } }, "codes from two tabs are both kept");
  assert.deepEqual(S.applyEdit({ scans: 2 }, { inc: { scans: 1, saves: 1 }, add: { since: 5 } }, now), { scans: 3, saves: 1, since: 5 });
  assert.deepEqual(S.applyEdit({ since: 1 }, { add: { since: 5 } }, now), { since: 1 });
  const many = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, { a: i }]));
  assert.deepEqual(Object.keys(S.applyEdit(many, { cap: { max: 3, by: "a" } }, now)), ["k7", "k8", "k9"], "keeps the newest");
  assert.deepEqual(Object.keys(S.applyEdit({ old: { at: now - 100 }, young: { at: now - 5 } }, { cap: { max: 9, by: "at", maxAge: 50 } }, now)), ["young"]);
  assert.deepEqual(S.applyEdit(null, { set: { x: 1 } }, now), { x: 1 }, "nothing stored yet");
  assert.deepEqual(S.applyEdit(["junk"], {}, now), {}, "something that isn't a record is replaced");
});

test("soldAutoOk: lookups on their own take at most half the hour, none while paused or a day after a check", () => {
  const now = 1e12;
  assert.equal(S.soldAutoOk({}, now), true);
  assert.equal(S.soldAutoOk({ log: [now - 1000, now - 2000, now - 3000] }, now), true);
  assert.equal(S.soldAutoOk({ log: [now - 1000, now - 2000, now - 3000, now - 4000] }, now), false, "four this hour is the limit");
  assert.equal(S.soldAutoOk({ log: [now - 2 * 3600e3, now - 2 * 3600e3, now - 2 * 3600e3, now - 2 * 3600e3] }, now), true, "older ones don't count");
  assert.equal(S.soldAutoOk({ cooldownUntil: now + 1 }, now), false, "paused");
  assert.equal(S.soldAutoOk({ lastCheck: now - 3600e3 }, now), false, "a check an hour ago");
  assert.equal(S.soldAutoOk({ lastCheck: now - 25 * 3600e3 }, now), true, "a check yesterday");
});

test("soldSlot: one booking for every tab, spaced, capped and paused", () => {
  const opts = { perHour: 3, gap: 5000 };
  const now = 10_000_000;
  assert.deepEqual(S.soldSlot({ cooldownUntil: now + 1 }, now, opts), { pausedUntil: now + 1 });
  assert.deepEqual(S.soldSlot({}, now, opts), { wait: 0, log: [now], perHour: 3 });
  let st = { log: [] };
  const waits = [];
  for (let i = 0; i < 4; i++) {
    const r = S.soldSlot(st, now, opts);
    if (r.full) { waits.push("full"); continue; }
    waits.push(r.wait);
    st = { log: r.log };
  }
  assert.deepEqual(waits, [0, 5000, 10000, "full"], "asked at the same moment, each gets its own turn, and no more than the hour allows");
  assert.deepEqual(S.soldSlot({ log: [now - 2 * 3600e3, now - 3600e3 - 1] }, now, opts), { wait: 0, log: [now], perHour: 3 }, "older than an hour doesn't count");
  assert.deepEqual(S.soldSlot({ log: "junk" }, now, opts), { wait: 0, log: [now], perHour: 3 });
});

test("soldSlot: a search another tab is looking up waits for that answer, and a day after a check runs slower", () => {
  const opts = { perHour: 8, gap: 5000 };
  const now = 10_000_000;
  assert.deepEqual(S.soldSlot({ key: "v2:used:psp", pending: { "v2:used:psp": now + 3000 } }, now, opts), { pending: 3000 }, "no second turn for the same search");
  assert.deepEqual(S.soldSlot({ key: "v2:used:psp", pending: { "v2:used:psp": now - 1 } }, now, opts), { wait: 0, log: [now], perHour: 8 }, "a lapsed one doesn't hold it up");
  assert.deepEqual(S.soldSlot({ key: "v2:used:ps2", pending: { "v2:used:psp": now + 3000 } }, now, opts).wait, 0, "another search goes ahead");
  assert.deepEqual(S.soldSlot({ cooldownUntil: now + 1, key: "k", pending: { k: now + 5 } }, now, opts), { pausedUntil: now + 1 }, "a pause wins");
  // Within a day of eBay's check: 4 an hour, 15 s apart.
  let st = { log: [], lastCheck: now - 3600e3 };
  const waits = [];
  for (let i = 0; i < 5; i++) {
    const r = S.soldSlot(st, now, opts);
    if (r.full) { waits.push(`full ${r.perHour}`); continue; }
    waits.push(r.wait);
    st = { ...st, log: r.log };
  }
  assert.deepEqual(waits, [0, 15000, 30000, 45000, "full 4"]);
  assert.equal(S.soldSlot({ lastCheck: now - S.SOLD_WARY_MS - 1 }, now, opts).perHour, 8, "back to the usual pace after a day");
});

test("soldCooldown: an hour, then longer each time eBay's check comes back the same day", () => {
  const h = 3600e3;
  let t = 50 * h;
  let strikes;
  const pauses = [];
  for (let i = 0; i < 5; i++) {
    const r = S.soldCooldown(strikes, t);
    pauses.push((r.until - t) / h);
    strikes = r.strikes;
    t = r.until + 60e3; // tripped again a minute after it lifted
  }
  assert.deepEqual(pauses, [1, 2, 4, 6, 6], "doubles, at most six hours");
  assert.equal((S.soldCooldown(strikes, t + S.SOLD_WARY_MS).until - t - S.SOLD_WARY_MS) / h, 1, "a quiet day starts over");
  assert.equal((S.soldCooldown({ n: "junk" }, t).until - t) / h, 1);
  assert.equal((S.soldCooldown(null, t).until - t) / h, 1);
});

test("cleanBackup: a damaged or hostile backup can't leave anything that breaks the panel", () => {
  const { sets, dropped, links } = S.cleanBackup({
    saved: {
      "ebay:123456789": { t: "Camera", u: "javascript:alert(1)", img: "http://192.168.1.1/x.png", p0: 50, p: "cheap", a0: 1, a: 2, extra: { huge: true } },
      "fb:42": { t: 7, u: "https://www.facebook.com/marketplace/item/42/", img: "https://scontent.fbcdn.net/x.jpg", p0: -1, p: 10, a: 5 },
      "<img onerror>": { t: "bad key" },
      "ebay:999999999": "not a record",
    },
    savedSearches: { "ebay|psp": { q: "psp", site: "mars", url: "https://evil.example/", n: "many" }, "ebay|": { q: "  " }, x: { q: 5 }, "ebay|k1000": { q: "k1000", url: "https://www.ebay.com/sch/i.html?_nkw=k1000", gk: [{ k: "ebay:5", t: "K1000", p: 80, u: "javascript:alert(1)", at: 3 }, { k: "../x", t: "bad" }, "junk"] } },
    quickFilters: { "ebay|psp": { words: 12, min: "5", max: 100, fresh: "yes", broken: "sometimes", a: 9 }, "old": { projects: true }, "ebay|cam": { store: { cond: "used", freeShip: "on", "bad key!": "x", format: "<script>" }, a: 2 } },
    notInterested: { "ebay:111111111": { t: "x", a: 3 }, "ebay:222222222": null },
    listingMemory: { "ebay:333333333": { p: 20, pa: 1, f: 1, a: 4, h: [[25, 1], ["x", 2], 7] }, "ebay:444444444": { p: 3 } },
    codeStems: { "game boy advance sp": { c: { M2465: "fb:1", "<b>": "fb:2", K7731: "javascript:x" }, a: 6 }, empty: { c: {} } },
    modePrefs: { use: { sort: "price", skip: "everything" }, evil: { sort: "x" } },
    searchWants: { "ebay|psp": " working ", long: "x".repeat(400) },
    usage: { days: { "2026-10-01": { usd: 1.5, calls: 3, models: { haiku: { usd: 1.5, calls: 3 }, bad: { usd: -1 } } }, "yesterday": { usd: 1, calls: 1 }, "2026-10-02": { usd: Infinity, calls: 1 } } },
    stats: { scans: 4, saves: -2, junk: "x" },
  });
  assert.deepEqual(sets.saved["ebay:123456789"], { t: "Camera", u: "https://www.ebay.com/itm/123456789", img: "", p0: 50, a0: 1, p: null, a: 2 }, "a bad link is rebuilt, a photo from elsewhere dropped, a price that isn't a number cleared, extra fields gone");
  assert.deepEqual(sets.saved["fb:42"], { t: "", u: "https://www.facebook.com/marketplace/item/42/", img: "https://scontent.fbcdn.net/x.jpg", p0: null, a0: 0, p: 10, a: 5 });
  assert.deepEqual(Object.keys(sets.saved).sort(), ["ebay:123456789", "fb:42"]);
  assert.deepEqual(sets.savedSearches["ebay|psp"], { site: "ebay", q: "psp", url: "https://www.ebay.com/sch/i.html?_nkw=psp", a0: 0, v: 0, n: 0, fresh: 0, deal: 0, deals: 0 });
  assert.deepEqual(sets.savedSearches["ebay|k1000"].gk, [{ k: "ebay:5", t: "K1000", p: 80, ref: null, u: "", at: 3 }], "great finds keep listing keys and safe addresses only");
  assert.deepEqual(sets.quickFilters["ebay|psp"], { words: "", min: 0, max: 100, fresh: false, broken: "", deal: 0, a: 9 });
  assert.equal(sets.quickFilters.old.broken, "only", "the older Projects only still means broken ones only");
  assert.deepEqual(sets.quickFilters["ebay|cam"].store, { cond: "used", freeShip: "on" }, "store filters keep only short names and values");
  assert.deepEqual(sets.notInterested, { "ebay:111111111": { t: "x", a: 3 } });
  assert.deepEqual(sets.listingMemory, { "ebay:333333333": { p: 20, pa: 1, f: 1, a: 4, h: [[25, 1]] } });
  assert.deepEqual(sets.codeStems, { "game boy advance sp": { c: { M2465: "fb:1" }, a: 6 } });
  assert.deepEqual(sets.modePrefs, { use: { sort: "price" } });
  assert.deepEqual(sets.searchWants, { "ebay|psp": "working" });
  assert.deepEqual(sets.usage, { days: { "2026-10-01": { usd: 1.5, calls: 3, models: { haiku: { usd: 1.5, calls: 3 } } } } });
  assert.deepEqual(sets.stats, { scans: 4 });
  assert.equal(links, 2, "the saved listing's link and the search's");
  assert.equal(dropped, 11, "counted what was left out: two saved, two searches, and one each of the rest");
});

test("cleanBackup: nothing usable gives nothing, without throwing", () => {
  for (const junk of [null, 5, "x", [], { saved: [], usage: "x", stats: null }]) assert.doesNotThrow(() => S.cleanBackup(junk));
  assert.deepEqual(S.cleanBackup({}).sets, {});
});

test("upgradeStorage: what an older version left is carried over or cleaned, once", () => {
  const old = {
    hideWords: "repro, box only", needWords: "working", theme: "gameboy", lens: "flip",
    soldCache: { "used:psp": { at: 1, market: { median: 5 } }, "v2:used:psp": { at: 2, market: null } },
    saved: { "ebay:123456789": { t: "Camera", u: "https://www.ebay.com/itm/123456789", img: "", p0: 50, a0: 1, p: 40, a: 2 } },
    quickFilters: { "ebay|psp": { words: 12, min: 0, max: 0, fresh: false, broken: "", deal: 0, a: 1 } },
    notInterested: "broken",
    provider: "anthropic",
  };
  const { set, remove, changed } = S.upgradeStorage(old);
  assert.equal(set.filterWords, '-repro -"box only" working');
  assert.deepEqual(remove.sort(), ["hideWords", "needWords", "notInterested", "theme"]);
  assert.equal(set.lens, "project");
  assert.deepEqual(Object.keys(set.soldCache), ["v2:used:psp"]);
  assert.equal(set.quickFilters["ebay|psp"].words, "", "a filter that would throw is repaired");
  assert.equal("saved" in set, false, "a record that's already fine isn't rewritten");
  assert.equal("provider" in set, false);
  assert.ok(changed.includes("quickFilters") && changed.includes("notInterested"));
  const again = S.upgradeStorage({ filterWords: "x", saved: old.saved, lens: "use" });
  assert.deepEqual([again.set, again.remove], [{}, []], "current storage needs nothing");
});

test("upgradeStorage: the AI is opt-in, and an install that already had one set up keeps it on", () => {
  assert.equal(S.upgradeStorage({}).set.useAI, undefined, "a new install starts with the AI off");
  assert.equal(S.upgradeStorage({ storageVersion: 4, provider: "anthropic" }).set.useAI, undefined, "the default service alone isn't a setup");
  for (const all of [{ anthropicKey: "k" }, { oaiKey: "k" }, { oaiModel: "m" }, { serviceChosen: true }, { provider: "ollama" }]) {
    const { set, changed } = S.upgradeStorage({ storageVersion: 4, ...all });
    assert.equal(set.useAI, true, JSON.stringify(all));
    assert.ok(changed.includes("AI kept on"));
  }
  assert.equal(S.upgradeStorage({ storageVersion: 4, anthropicKey: "k", useAI: false }).set.useAI, undefined, "turned off on purpose stays off");
});

test("toCsv quotes every field, keeps formulas as text, and opens in Excel as UTF-8", () => {
  const csv = S.toCsv([{ a: 'Game Boy "SP", blue', b: "=HYPERLINK(1)" }, { a: "-5 off", b: -5 }, { a: "Pokémon 🎮", b: null }], [{ key: "a", label: "A" }, { key: "b", label: "B" }]);
  assert.equal(csv[0], "﻿");
  const lines = csv.slice(1).split("\r\n");
  assert.equal(lines[0], '"A","B"');
  assert.equal(lines[1], '"Game Boy ""SP"", blue","\'=HYPERLINK(1)"');
  assert.equal(lines[2], '"\'-5 off","-5"', "a negative number stays a number; text starting with - doesn't");
  assert.equal(lines[3], '"Pokémon 🎮",""');
  assert.equal(lines[4], "");
});

test("savedRows: one row per saved listing, newest first, with the latest score", () => {
  const saved = {
    "ebay:1": { t: "Pentax K1000", u: "https://www.ebay.com/itm/1", p0: 120, p: 95, a0: Date.parse("2026-10-01"), a: Date.parse("2026-10-10") },
    "fb:2": { t: "Switch", u: "javascript:alert(1)", p0: 200, a0: Date.parse("2026-10-05"), a: Date.parse("2026-10-05") },
  };
  const scans = { "ebay:1": { use: { score: 81, verdict: "great", refWorking: 140 }, flip: { score: 70, verdict: "good", margin: 22.5 } } };
  const rows = S.savedRows(saved, scans);
  assert.deepEqual(rows.map((r) => r.key), ["fb:2", "ebay:1"]);
  assert.equal(rows[0].link, "https://www.facebook.com/marketplace/item/2/", "an unsafe stored link is rebuilt");
  assert.equal(rows[0].store, "Marketplace");
  assert.deepEqual([rows[1].p0, rows[1].p, rows[1].change, rows[1].saved, rows[1].score, rows[1].verdict, rows[1].sold, rows[1].margin], [120, 95, -25, "2026-10-01", 81, "great", 140, 22.5]);
  assert.deepEqual(S.savedRows(null), []);
});

test("savedRows: a clean link, and a sold median only when it's really this listing's", () => {
  const saved = {
    "ebay:227533148143": { t: "Wii", u: "https://www.ebay.com/itm/227533148143?_skw=wii&itmmeta=01M4&hash=item34", p0: 40, a0: 3 },
    "fb:1835764070763259": { t: "Backbone One", u: "https://www.facebook.com/marketplace/item/1835764070763259/", p0: 30, a0: 2 },
    "fb:3": { t: "Netgear switch", p0: 15, a0: 1 },
  };
  const scans = {
    "fb:1835764070763259": { use: { score: 66, verdict: "good", browse: true, refWorking: 125, refIsEstimate: true } },
    "fb:3": { use: { score: 67, verdict: "good", browse: true, refWorking: 125, sold: { median: 22, n: 9 } } },
    "ebay:227533148143": { use: { score: 61, verdict: "good", refWorking: 125, related: false } },
  };
  const rows = Object.fromEntries(S.savedRows(saved, scans).map((r) => [r.key, r]));
  assert.equal(rows["ebay:227533148143"].link, "https://www.ebay.com/itm/227533148143", "eBay's tracking is left off");
  assert.equal(rows["ebay:227533148143"].sold, "", "not part of the search the median was for");
  assert.equal(rows["fb:1835764070763259"].sold, "", "an estimate isn't a sold median");
  assert.equal(rows["fb:3"].sold, 22, "a feed listing's own lookup counts");
});

test("dHash: a photo's fingerprint survives resizing and brightness, and tells pictures apart", () => {
  // 9×8 gray pixels from a smooth pattern, the same pattern brighter, and a different one.
  const pic = (fn) => Array.from({ length: 72 }, (_, i) => fn(i % 9, Math.floor(i / 9)));
  const a = S.dHash(pic((x, y) => 128 + 90 * Math.sin(x * 0.9 + y * 0.6)));
  const lighter = S.dHash(pic((x, y) => 140 + 90 * Math.sin(x * 0.9 + y * 0.6)));
  const b = S.dHash(pic((x, y) => 128 + 90 * Math.cos(x * 0.4 - y * 1.1)));
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(lighter, a);
  assert.notEqual(b, a);
  // a blank picture (or a placeholder) has no fingerprint: it would match every other blank one
  assert.equal(S.dHash(pic(() => 200)), "");
  assert.equal(S.dHash([]), "");
});

test("upgradeStorage: an install on the old default interests keeps them; a new one starts blank", () => {
  assert.equal(S.upgradeStorage({ storageVersion: 1 }).set.interests, S.OLD_INTERESTS);
  assert.equal(S.upgradeStorage({ storageVersion: 1, interests: "" }).set.interests, undefined);
  assert.equal(S.upgradeStorage({}).set.interests, undefined);
});

test("oaiKeyFits: a key goes only to the address it was entered for", () => {
  const url = "https://api.openai.com/v1";
  assert.equal(S.oaiKeyFits({ oaiKey: "k", oaiKeyFor: "https://api.openai.com", oaiUrl: url }), true);
  assert.equal(S.oaiKeyFits({ oaiKey: "k", oaiKeyFor: "https://openrouter.ai", oaiUrl: url }), false);
  assert.equal(S.oaiKeyFits({ oaiKey: "k", oaiKeyFor: "https://api.openai.com", oaiUrl: "https://api.openai.com.evil.example/v1" }), false);
  assert.equal(S.oaiKeyFits({ oaiKey: "", oaiKeyFor: "https://openrouter.ai", oaiUrl: url }), true, "no key, nothing to send");
  assert.equal(S.oaiKeyFits({ oaiKey: "k", oaiKeyFor: "", oaiUrl: url }), true, "not yet recorded (storage upgrade fills it in)");
  assert.equal(S.oaiKeyFits({ oaiKey: "k", oaiKeyFor: "https://api.openai.com", oaiUrl: "not a url" }), false);
});

test("upgradeStorage: a key already in settings is tied to the address it's used with", () => {
  assert.equal(S.upgradeStorage({ oaiKey: "k", oaiUrl: "https://api.deepseek.com/v1" }).set.oaiKeyFor, "https://api.deepseek.com");
  assert.equal(S.upgradeStorage({ oaiKey: "k" }).set.oaiKeyFor, "https://openrouter.ai", "the default address");
  assert.equal("oaiKeyFor" in S.upgradeStorage({ oaiKey: "k", oaiKeyFor: "https://x.example" }).set, false);
  assert.equal("oaiKeyFor" in S.upgradeStorage({}).set, false);
});

test("photoIndex finds every photo photoTwins would, from a short list", async () => {
  const { R } = await loadScripts();
  // 1,200 photos: some pictures uploaded several times with a few bits changed, the rest unrelated.
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const hex = () => Array.from({ length: 16 }, () => "0123456789abcdef"[(rnd() * 16) | 0]).join("");
  const flip = (h, n) => {
    const b = [...BigInt("0x" + h).toString(2).padStart(64, "0")];
    for (let i = 0; i < n; i++) { const at = (rnd() * 64) | 0; b[at] = b[at] === "1" ? "0" : "1"; }
    return BigInt("0b" + b.join("")).toString(16).padStart(16, "0");
  };
  const seen = {};
  const bases = Array.from({ length: 120 }, hex);
  for (let i = 0; i < 1200; i++) seen[`fb:${i}`] = { h: i % 3 ? hex() : flip(bases[i % 120], (rnd() * 7) | 0), f: `${i}_n`, t: `title ${i % 50 === 0 ? "same" : i}` };
  seen["fb:bad"] = { h: "not a hash", f: "x", t: "x" };
  const index = S.photoIndex(seen, R.PHOTO_NEAR);
  let found = 0;
  for (const key of Object.keys(seen)) {
    const near = index.near(seen[key].h);
    const short = Object.fromEntries([...near, key].map((k) => [k, seen[k]]));
    const want = R.photoTwins(key, seen);
    assert.deepEqual(R.photoTwins(key, short).sort(), want.sort(), key);
    assert.ok(near.size < 60, `a short list (${near.size})`);
    found += want.length;
  }
  assert.ok(found > 100, `the photos include near copies to find (${found})`);
  assert.equal(index.near("").size, 0);
});

test("upgradeStorage: the old one switch for card marks becomes a switch per kind, scam marks on", () => {
  const off = S.upgradeStorage({ autoMarks: false });
  assert.deepEqual([off.set.markPrices, off.set.markOther, off.set.markScams, off.set.marksBack], [false, false, undefined, true], "off: scam marks come back, the rest stay off, and Home says so once");
  assert.ok(off.remove.includes("autoMarks"));
  const on = S.upgradeStorage({ autoMarks: true });
  assert.deepEqual([on.set, on.remove], [{}, ["autoMarks"]], "on: nothing to carry over");
  assert.deepEqual(S.marksFromOld(undefined), {}, "a backup without it takes nothing");
  assert.equal(S.cleanSetting("markLimit", 1), 1);
  assert.equal(S.cleanSetting("markLimit", 9), 3, "clamped");
  assert.equal(S.cleanSetting("markScams", "no"), undefined);
});

test("Saved workbench: parts and a note kept on a saved listing, and the net they leave in the spreadsheet", () => {
  const saved = { "ebay:1": { t: "Broken Switch", u: "https://www.ebay.com/itm/1", p0: 60, p: 52, a0: 2, a: 3, parts: 15, note: "needs a fan" } };
  const scans = { "ebay:1": { flip: { score: 70, verdict: "good", refWorking: 140, shipOut: 12, margin: 40 } } };
  const ref = S.savedSold("ebay:1", scans);
  assert.deepEqual(ref, { sold: 140, ship: 12 });
  assert.equal(S.savedNet(saved["ebay:1"], ref), 42, "140 less 13.6% and 40 cents, less $12 shipping, $52 and $15 parts");
  assert.equal(S.savedNet({ p: 52 }, ref, 10), 62, "no parts yet, another fee");
  assert.equal(S.savedNet({ p: null }, ref), null);
  assert.equal(S.savedNet(saved["ebay:1"], null), null);
  const [row] = S.savedRows(saved, scans);
  assert.deepEqual([row.parts, row.net, row.note], [15, 42, "needs a fan"]);
  assert.deepEqual(S.SAVED_COLUMNS.map((c) => c.label).slice(-4), ["Parts cost", "Net after parts (Reseller)", "Notes", "Listing key"]);
  assert.match(S.toCsv([row], S.SAVED_COLUMNS), /"15","42","needs a fan"/);
  // A backup keeps them, within bounds.
  const { sets } = S.cleanBackup({ saved: { ...saved, "ebay:2": { t: "x", parts: -4, note: 7 }, "ebay:3": { t: "y", note: "z".repeat(400) } } });
  assert.deepEqual([sets.saved["ebay:1"].parts, sets.saved["ebay:1"].note], [15, "needs a fan"]);
  assert.equal("parts" in sets.saved["ebay:2"] || "note" in sets.saved["ebay:2"], false, "a negative cost or a note that isn't text is left out");
  assert.equal(sets.saved["ebay:3"].note.length, S.NOTE_MAX);
});

test("usageReport: counts only, never a search, a listing or a seller", () => {
  const all = {
    useAI: true, provider: "anthropic", lens: "project",
    stats: { scans: 12, soldLookups: 30, since: Date.parse("2026-10-20T12:00:00") },
    saved: { a: { title: "Nintendo Switch Lite", url: "https://www.ebay.com/itm/1" } },
    savedSearches: { b: { query: "pentax k1000" } },
    soldCache: {
      "v2::nintendo switch": { at: 1, market: { median: 200, variants: { _same: ["@switch"], "lite/*/*": { n: 6 }, "/*/*": { n: 22 } } } },
      "v2::pentax k1000": { at: 1, market: { median: 125 } },
      "v2::nosales": { at: 1, market: null },
    },
    siteHealth: { ebay: { ok: 1 }, facebook: { bad: 1, note: "x", level: "warn" } },
    anthropicKey: "sk-ant-secret",
  };
  const r = S.usageReport(all, "0.58.0");
  assert.equal(r, [
    "Tirekick 0.58.0",
    "AI: on (anthropic); auto-scan: off; Craigslist: off; mode: fix & flip",
    "Scans: 12; sold-price lookups: 30 (counting since 2026-10-20)",
    "Saved listings: 1; saved searches: 1",
    "Sold lookups kept now: 3; with a typical price: 2; split by version: 1 (2 versions, 1 of them from 5 to 7 sales)",
    "Page reading: ebay fine, facebook looked off (warn)",
  ].join("\n"));
  for (const secret of ["switch", "pentax", "ebay.com/itm", "sk-ant"]) assert.ok(!r.toLowerCase().includes(secret), secret);
  assert.match(S.usageReport({}), /^Tirekick\nAI: off.*\nScans: 0; sold-price lookups: 0\n.*\nPage reading: no results pages yet$/s);
});

test("a backup keeps saved Craigslist posts under either kind of key, and nothing that only looks like one", () => {
  const { sets } = S.cleanBackup({ saved: { "cl:wVo8Fw1YFEXCw2vSs6CZ92": { t: "Switch controller", u: "https://www.craigslist.org/view/d/x/wVo8Fw1YFEXCw2vSs6CZ92", p: 20 }, "cl:7791000001": { t: "Old post", p: 5 }, "cl:../../x": { t: "bad" }, "ebay:abc": { t: "bad" } } });
  assert.deepEqual(Object.keys(sets.saved).sort(), ["cl:7791000001", "cl:wVo8Fw1YFEXCw2vSs6CZ92"]);
  assert.equal(sets.saved["cl:wVo8Fw1YFEXCw2vSs6CZ92"].u, "https://www.craigslist.org/view/d/x/wVo8Fw1YFEXCw2vSs6CZ92");
});
