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

test("soldSlot: one booking for every tab, spaced, capped and paused", () => {
  const opts = { perHour: 3, gap: 5000 };
  const now = 10_000_000;
  assert.deepEqual(S.soldSlot({ cooldownUntil: now + 1 }, now, opts), { pausedUntil: now + 1 });
  assert.deepEqual(S.soldSlot({}, now, opts), { wait: 0, log: [now] });
  let st = { log: [] };
  const waits = [];
  for (let i = 0; i < 4; i++) {
    const r = S.soldSlot(st, now, opts);
    if (r.full) { waits.push("full"); continue; }
    waits.push(r.wait);
    st = { log: r.log };
  }
  assert.deepEqual(waits, [0, 5000, 10000, "full"], "asked at the same moment, each gets its own turn, and no more than the hour allows");
  assert.deepEqual(S.soldSlot({ log: [now - 2 * 3600e3, now - 3600e3 - 1] }, now, opts), { wait: 0, log: [now] }, "older than an hour doesn't count");
  assert.deepEqual(S.soldSlot({ log: "junk" }, now, opts), { wait: 0, log: [now] });
});

test("cleanBackup: a damaged or hostile backup can't leave anything that breaks the panel", () => {
  const { sets, dropped, links } = S.cleanBackup({
    saved: {
      "ebay:123456789": { t: "Camera", u: "javascript:alert(1)", img: "http://192.168.1.1/x.png", p0: 50, p: "cheap", a0: 1, a: 2, extra: { huge: true } },
      "fb:42": { t: 7, u: "https://www.facebook.com/marketplace/item/42/", img: "https://scontent.fbcdn.net/x.jpg", p0: -1, p: 10, a: 5 },
      "<img onerror>": { t: "bad key" },
      "ebay:999999999": "not a record",
    },
    savedSearches: { "ebay|psp": { q: "psp", site: "mars", url: "https://evil.example/", n: "many" }, "ebay|": { q: "  " }, x: { q: 5 } },
    quickFilters: { "ebay|psp": { words: 12, min: "5", max: 100, fresh: "yes", broken: "sometimes", a: 9 }, "old": { projects: true } },
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
  assert.deepEqual(sets.savedSearches, { "ebay|psp": { site: "ebay", q: "psp", url: "https://www.ebay.com/sch/i.html?_nkw=psp", a0: 0, v: 0, n: 0, fresh: 0, deal: 0, deals: 0 } });
  assert.deepEqual(sets.quickFilters["ebay|psp"], { words: "", min: 0, max: 100, fresh: false, broken: "", deal: 0, a: 9 });
  assert.equal(sets.quickFilters.old.broken, "only", "the older Projects only still means broken ones only");
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
