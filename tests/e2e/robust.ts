// The features that work without a model, when things go wrong: a site that changed its pages, and (as
// they're added) storage, several tabs at once, damaged backups. Prints PASS/FAIL lines.
//   tests/e2e/run.sh robust.ts
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
let fails = 0;
const ok = (name: string, cond: unknown, why: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ": " + (typeof why === "string" ? why : JSON.stringify(why))}`);
};
const errors: string[] = [];
const worlds: any[] = []; // execution contexts, to reach the extension's own (isolated) world on a page
c.on((m: any) => {
  if (m.method === "Runtime.executionContextCreated") worlds.push({ ...m.params.context, sessionId: m.sessionId });
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
});
const o = await open(`chrome-extension://${EXT}/options/options.html`);
const store = (js: string) => o.ev(`chrome.storage.local.set(${js})`);
const get = (k: string) => o.ev(`chrome.storage.local.get(${JSON.stringify(k)}).then(v=>v[${JSON.stringify(k)}])`);
const R = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);
const closeAll = async (re: RegExp) => {
  const { targetInfos } = await c.send("Target.getTargets");
  for (const t of targetInfos) if (t.type === "page" && re.test(t.url)) await c.send("Target.closeTarget", { targetId: t.targetId }).catch(() => {});
};
const reset = async (extra = "{}") => {
  await closeAll(/www\.(ebay|facebook)\.com/);
  await sleep(600);
  await o.ev(`chrome.storage.local.clear()`);
  await store(`{introDone:true, useSoldComps:false}`);
  await store(extra);
};
const waitFor = async (fn: () => Promise<unknown>, ms = 8000) => {
  for (let t = 0; t < ms; t += 250) {
    if (await fn()) return true;
    await sleep(250);
  }
  return false;
};

ok("installing brings storage up to date and notes its version", (await get("storageVersion")) === 4);

// ---------- a site that changed its pages ----------
await reset();
{
  const p = await open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000&changed=1");
  const warned = await waitFor(() => R(p, `const w=r.querySelector('.readwarn'); return !w.hidden && w.textContent`));
  const text = await R(p, `return r.querySelector('.readwarn').textContent`);
  ok("a results page whose cards can't be read says so in the panel", warned && /eBay changed this page/.test(text) && /6 on the page, none read/.test(text), text);
  ok("…with Check this page next to it", await R(p, `return [...r.querySelectorAll('.readwarn button')].some(b=>b.textContent==='Check this page')`));
  ok("…and it's noted for Home", await waitFor(async () => (await get("siteHealth"))?.ebay?.level === "broken"));
  await R(p, `r.querySelector('[data-view=home]').click()`);
  await sleep(600);
  ok("Home says which site changed", /A site changed/.test(await R(p, `return r.querySelector('.view-home').textContent`)));
  await p.close();

  const q = await open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000");
  await sleep(4000);
  ok("a page that reads fine shows no warning", await R(q, `return r.querySelector('.readwarn').hidden`));
  ok("…and clears the note on Home", await waitFor(async () => { const h = (await get("siteHealth"))?.ebay; return h?.ok > h?.bad; }));
  await R(q, `r.querySelector('[data-view=home]').click()`);
  await sleep(600);
  ok("…so Home no longer mentions it", !/A site changed/.test(await R(q, `return r.querySelector('.view-home').textContent`)));
  await q.close();

  const e = await open("https://www.ebay.com/sch/i.html?_nkw=nothing&empty=1");
  await sleep(4000);
  ok("a search with no results is not a changed page", await R(e, `return r.querySelector('.readwarn').hidden`));
  await e.close();
}

// ---------- storage that can't silently fill up ----------
await reset();
{
  // Chrome gives an extension 10 MB unless it asks for more; a few months of kept scores and listings
  // can get there, and then every save fails.
  const big = await o.ev(`chrome.storage.local.set({ bigTest: "x".repeat(12 * 1024 * 1024) }).then(() => "ok", (e) => e.message)`);
  ok("storage holds more than Chrome's default 10 MB", big === "ok", big);
  await o.ev(`chrome.storage.local.remove("bigTest")`);
}

// ---------- several tabs at once ----------
await reset();
{
  const o2 = await open(`chrome-extension://${EXT}/options/options.html`);
  const burst = (page: any, tag: string) =>
    page.ev(`Promise.all(Array.from({ length: 25 }, (_, i) => chrome.runtime.sendMessage({ type: "storeEdit", payload: { name: "saved", edit: { set: { ["ebay:${tag}" + i]: { t: "x", a: Date.now() } } } } })))`);
  await Promise.all([burst(o, "1"), burst(o2, "2")]);
  const saved = await get("saved");
  ok("two tabs saving 25 listings each at the same moment keep all 50", Object.keys(saved || {}).length === 50, Object.keys(saved || {}).length);
  const slots = await Promise.all([o, o2].map((page) =>
    page.ev(`Promise.all(Array.from({ length: 6 }, () => chrome.runtime.sendMessage({ type: "soldSlot", payload: { perHour: 8, gap: 0 } }).then((r) => r.data)))`)));
  const granted = slots.flat().filter((s: any) => s && !s.full).length;
  ok("two tabs asking for 12 sold-price lookups at once get 8, the hourly limit", granted === 8, slots);
  await o2.close();
}

// ---------- a damaged backup ----------
await reset();
{
  // A filter whose words aren't text used to throw on every search it applied to.
  const backup = {
    app: "tirekick", version: "0.36.0",
    quickFilters: { "ebay|pentax k1000": { words: 12, min: "5", a: 1 } },
    listingMemory: { "ebay:1111111111": "seen", "ebay:2222222222": { p: "x" } },
    notInterested: { "ebay:3333333333": null },
    saved: { "ebay:4444444444": { t: { title: "object" }, img: "http://127.0.0.1:1/x.png", p0: "5" } },
  };
  const file = (await Deno.makeTempDir()) + "/damaged.json";
  await Deno.writeTextFile(file, JSON.stringify(backup));
  const { root } = await c.send("DOM.getDocument", {}, o.sessionId);
  const { nodeId } = await c.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#restoreFile" }, o.sessionId);
  await c.send("DOM.setFileInputFiles", { files: [file], nodeId }, o.sessionId);
  await sleep(1200);
  const msg = await o.ev(`document.getElementById('msg').textContent`);
  ok("restoring a damaged backup says what it left out", /entries that didn't make sense were left out/.test(msg), msg);
  const saved = await get("saved");
  ok("…keeps what it can, cleaned", saved?.["ebay:4444444444"]?.t === "" && saved["ebay:4444444444"].img === "" && saved["ebay:4444444444"].p0 === null, saved);
  const before = errors.length;
  const p = await open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000");
  await sleep(2500);
  ok("…and the panel still works on the search it touched", (await R(p, `return r.querySelector('.pi-line')?.textContent || ''`)).includes("listings") && errors.length === before, errors.slice(before));
  await p.close();
}

// ---------- storage a current version writes passes the upgrade untouched ----------
await reset();
{
  const p = await open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000");
  await sleep(1500);
  await R(p, `r.querySelector('[data-act=tab]').click()`);
  await sleep(400);
  const chips = async (label: string) => p.ev(`(() => { const b = [...document.querySelectorAll('.tirekick-marks button, .tirekick-sticker button')].find((b) => b.textContent === ${JSON.stringify(label)}); if (b) b.click(); return !!b; })()`);
  const clicked = [await chips("Save"), await chips("Hide")];
  await R(p, `[...r.querySelectorAll('button')].find(b=>b.textContent==='Save search')?.click()`);
  await R(p, `r.querySelector('[data-act=prices]').click()`); // counted in stats
  await R(p, `r.querySelector('.qf-toggle').click()`);
  await R(p, `const i=r.querySelector('.qf-words'); i.focus(); i.value='k1000 -parts'; i.dispatchEvent(new Event('input',{bubbles:true}))`);
  await R(p, `r.querySelector('[data-mode=reseller]').click()`);
  await sleep(2500);
  await p.close();
  await sleep(800);
  const all = await o.ev(`chrome.storage.local.get(null)`);
  const filled = ["saved", "notInterested", "savedSearches", "quickFilters", "listingMemory", "stats"].filter((k) => all[k] && Object.keys(all[k]).length);
  ok("a session's worth of real storage is set up for the check", filled.length === 6 && clicked.every(Boolean), { filled, clicked });
  const up = await o.ev(`TKShared.upgradeStorage(${JSON.stringify(all)})`);
  const diff = Object.fromEntries(Object.keys(up.set).map((k) => { const key = Object.keys(all[k]).find((x) => JSON.stringify(all[k][x]) !== JSON.stringify(up.set[k][x])); return [k, { key, was: all[k][key], now: up.set[k][key] }]; }));
  // The one change: a saved listing's photo that was still the page's lazy-load placeholder (nothing shows it).
  const onlyPlaceholder = Object.keys(up.set).every((k) => k === "saved") && Object.values(diff).every((d: any) => /^data:/.test(d.was?.img) && d.now?.img === "");
  ok("…and the storage upgrade leaves it as it is", onlyPlaceholder && !up.remove.length, diff);
}

// ---------- the extension is reloaded with a page still open ----------
// The old copy on the page can't reach the extension any more: a storage call it still makes must not
// surface as "Extension context invalidated", and the old panel should step aside.
{
  const p = await open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000");
  await sleep(1500);
  const world = worlds.filter((w) => w.sessionId === p.sessionId && w.auxData?.type === "isolated" && w.origin?.includes?.("chrome-extension") || (w.sessionId === p.sessionId && /Tirekick/i.test(w.name))).pop();
  ok("the panel's own world is found on the page", !!world, worlds.filter((w) => w.sessionId === p.sessionId).map((w) => w.name));
  await o.ev(`setTimeout(() => chrome.runtime.reload(), 50), true`).catch(() => {});
  await sleep(1500);
  const before = errors.length;
  if (world) await c.send("Runtime.evaluate", { expression: "(async () => { await chrome.storage.local.get('saved'); })(); 1", contextId: world.id }, p.sessionId).catch(() => {});
  await sleep(2500);
  ok("…after a reload a late storage call from the old copy is swallowed, not an error", errors.length === before, errors.slice(before));
  ok("…and the old panel stepped aside: one panel on the page at most", (await p.ev(`document.querySelectorAll('#tirekick-host').length`)) <= 1);
  await p.close();
}

ok("no page errors", !errors.length, errors);
console.log(fails ? `${fails} failed` : "all passed");
Deno.exit(fails ? 1 : 0);
