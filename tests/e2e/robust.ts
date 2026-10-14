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
c.on((m: any) => {
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

ok("no page errors", !errors.length, errors);
console.log(fails ? `${fails} failed` : "all passed");
Deno.exit(fails ? 1 : 0);
