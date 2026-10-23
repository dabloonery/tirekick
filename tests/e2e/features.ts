// What the 0.23 branch's tests checked, on the real extension: modes, Home and the toolbar number, which
// model does what, budget and billing, safe links and restores, settings, the sold-price route from
// Facebook, and that no page logs an error. Prints PASS/FAIL lines.
//   tests/e2e/run.sh features.ts
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const API = "http://localhost:1234";
let fails = 0;
const ok = (name: string, cond: unknown, why: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ": " + (typeof why === "string" ? why : JSON.stringify(why))}`);
};
// Errors from any page or the worker: exceptions, and console.error.
const errors: string[] = [];
c.on((m: any) => {
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a: any) => a.value ?? a.description).join(" "));
});
// The background worker's errors too.
{
  const { targetInfos } = await c.send("Target.getTargets");
  const sw = targetInfos.find((t: any) => t.type === "service_worker" && t.url.includes(EXT));
  if (sw) {
    const { sessionId } = await c.send("Target.attachToTarget", { targetId: sw.targetId, flatten: true });
    await c.send("Runtime.enable", {}, sessionId);
  } else errors.push("no service worker found");
}
const o = await open(`chrome-extension://${EXT}/options/options.html`);
const store = (js: string) => o.ev(`chrome.storage.local.set(${js})`);
const get = (k: string) => o.ev(`chrome.storage.local.get(${JSON.stringify(k)}).then(v=>v[${JSON.stringify(k)}])`);
const R = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);
const calls = async () => (await fetch(`${API}/calls`)).json();
const clearCalls = () => fetch(`${API}/calls`, { method: "DELETE" });
const closeAll = async (re: RegExp) => {
  const { targetInfos } = await c.send("Target.getTargets");
  for (const t of targetInfos) if (t.type === "page" && re.test(t.url)) await c.send("Target.closeTarget", { targetId: t.targetId }).catch(() => {});
};
const BASE = `{anthropicKey:'sk-ant-test', anthropicUrl:'${API}', useSoldComps:false, introDone:true}`;
const reset = async (extra = "{}") => {
  await closeAll(/www\.(ebay|facebook)\.com/); // open tabs save scores a moment later; they'd refill what's cleared
  await sleep(600);
  await o.ev(`chrome.storage.local.clear()`);
  await store(BASE);
  await store(extra);
};
const SEARCH = "https://www.ebay.com/sch/i.html?_nkw=pentax+k1000";
const openPanel = async (url: string) => {
  const p = await open(url);
  await sleep(1200);
  await R(p, `r.querySelector('[data-act=tab]').click()`);
  await sleep(400);
  return p;
};
const scan = async (p: any) => {
  await R(p, `r.querySelector('[data-act=scan]').click()`);
  for (let i = 0; i < 30 && (await R(p, `return r.querySelector('[data-act=scan]').disabled`)); i++) await sleep(200);
  await sleep(300);
  return R(p, `return r.querySelector('.statusrow .status').textContent`);
};

// ---------- defaults ----------
await sleep(500);
const fresh = await o.ev(`chrome.storage.local.get(['feePct','anthropicScanModel','batchSize'])`);
const given = (await o.ev(`chrome.runtime.sendMessage({type:'getSettings'})`)).data;
ok("defaults aren't copied into storage, and pages still get them", !Object.keys(fresh).length && given.feePct === 13.6 && given.anthropicScanModel === "claude-haiku-5-5" && given.batchSize === 10, { fresh, feePct: given.feePct });

// ---------- which model does what ----------
await reset();
await clearCalls();
let p = await openPanel(SEARCH);
await scan(p);
let cs = await calls();
ok("scans use Haiku 5.5 by default, with effort", cs.length && cs.every((x: any) => x.model === "claude-haiku-5-5" && x.effort === "low"), cs);
ok("Haiku gets no server-side fallback", cs.every((x: any) => !x.fallbacks), cs);
// The mock answers "fair" at 60 and "good" at 76, outside those verdicts' ranges: the number follows the word.
const tags = await R(p, `return [...r.querySelectorAll('.list .row .tag')].map(t=>[t.dataset.v, +t.querySelector('span').textContent])`);
const BANDS: Record<string, number[]> = { great: [75, 100], good: [60, 74], fair: [45, 59], pass: [0, 44], suspicious: [0, 30] };
ok("every score sits inside its verdict's range (a Fair price is never 60, a Great deal never 55)", tags.length === 6 && tags.every(([v, n]: [string, number]) => n >= BANDS[v][0] && n <= BANDS[v][1]), tags);
await clearCalls();
let it = await openPanel("https://www.ebay.com/itm/184891897312");
await sleep(1200);
await R(it, `r.querySelector('[data-act=analyze]').click()`);
await sleep(2500);
cs = await calls();
ok("analyzing a listing uses the main model (Sonnet 5.5), with its fallback", cs.length === 1 && cs[0].model === "claude-sonnet-5-5" && cs[0].fallbacks === "default", cs);
await closeAll(/www\.ebay\.com/);
await sleep(500);
await store(`{anthropicScanModel:'', scoreCache:{}, scans:{}}`);
await clearCalls();
p = await openPanel(SEARCH);
await scan(p);
cs = await calls();
ok('"the same as above" scans with the main model', cs.length && cs.every((x: any) => x.model === "claude-sonnet-5-5"), cs);
await closeAll(/www\.ebay\.com/); // an open tab saves its scores a moment later, which would bring them straight back
await sleep(500);
await store(`{anthropicModel:'claude-haiku-4-5', scoreCache:{}, scans:{}}`);
await clearCalls();
p = await openPanel(SEARCH);
await scan(p);
cs = await calls();
ok("Haiku 4.5 is sent no effort (it would refuse it)", cs.length && cs.every((x: any) => x.effort === undefined), { cs, status: await R(p, `return r.querySelector('.statusrow .status').textContent`), tags: await p.ev(`document.querySelectorAll('.tirekick-sticker').length`) });
const ps = (await o.ev(`chrome.runtime.sendMessage({type:'getSettings'})`)).data;
ok("pages are told which model scans, and never get an API key", ps.scanModel === "claude-haiku-4-5" && !("anthropicKey" in ps) && !("oaiKey" in ps) && ps.hasKey === true, ps.scanModel);

// ---------- money ----------
await reset(`{anthropicKey:'cutoff'}`);
p = await openPanel(SEARCH);
let st = await scan(p);
const spent = (await get("usage"))?.days?.[new Date().toLocaleDateString("en-CA")]?.usd || 0;
ok("a cut-off reply says so and is still counted in spend", /cut off/i.test(st) && spent > 0, { st, spent });
await reset(`{monthlyBudget:0.01, usage:{days:{'${new Date().toLocaleDateString("en-CA")}':{usd:0.02,calls:3,models:{}}}}}`);
p = await openPanel(SEARCH);
st = await scan(p);
ok("paid AI stops once the monthly budget is used", /budget/i.test(st), st);

// ---------- Buyer and Reseller ----------
await reset();
p = await openPanel(SEARCH);
const mode = () => R(p, `return r.querySelector('button[data-mode][aria-checked=true]')?.dataset.mode`);
const feeShown = () => R(p, `return getComputedStyle(r.querySelector('.feewrap')).display !== 'none'`);
const marginOffered = () => R(p, `return !r.querySelector('.sort option[value=margin]').disabled`);
ok("starts in Buyer mode, without the Reseller's fee box or margin sort", (await mode()) === "buyer" && !(await feeShown()) && !(await marginOffered()));
await R(p, `r.querySelector('[data-mode=reseller]').click()`);
await sleep(300);
ok("Reseller brings the fee box, the margin sort (first) and its own wants hint", (await feeShown()) && (await marginOffered()) && (await R(p, `return r.querySelector('.sort').value`)) === "margin" && /fault/.test(await R(p, `return r.querySelector('#want').placeholder`)));
await R(p, `const w=r.querySelector('#want'); w.value='common fault'; w.dispatchEvent(new Event('change')); const s=r.querySelector('.sort'); s.value='price'; s.dispatchEvent(new Event('change'))`);
await R(p, `r.querySelector('[data-mode=buyer]').click()`);
await sleep(300);
const buyerSide = await R(p, `return [r.querySelector('#want').value, r.querySelector('.sort').value].join('|')`);
await R(p, `r.querySelector('[data-mode=reseller]').click()`);
await sleep(300);
const resellerSide = await R(p, `return [r.querySelector('#want').value, r.querySelector('.sort').value].join('|')`);
ok("each mode keeps its own sort and wants", buyerSide === "|score" && resellerSide === "common fault|price", { buyerSide, resellerSide });
await sleep(400);
p = await openPanel(SEARCH);
ok("the mode and its settings are still there after a reload", (await mode()) === "reseller" && (await R(p, `return r.querySelector('#want').value + '|' + r.querySelector('.sort').value`)) === "common fault|price");
await R(p, `const f=r.querySelector('#fee'); f.value='99'; f.dispatchEvent(new Event('change'))`);
await sleep(300);
ok("selling fees are the settings page's number, kept within limits", (await R(p, `return r.querySelector('#fee').value`)) === "50" && (await get("feePct")) === 50);
await reset(`{lens:'project', sortMode:'price', skipMode:'hide', want:'parts easy'}`);
p = await openPanel(SEARCH);
ok("settings from before there were modes go to the mode that was in use (not the old wants: they applied to every search)", (await mode()) === "reseller" && (await R(p, `return [r.querySelector('#want').value, r.querySelector('.sort').value, r.querySelector('[data-skip][aria-checked=true]').dataset.skip].join('|')`)) === "|price|hide");

// "What I want" belongs to its search; a listing opened from it in the same tab gets it
await reset();
p = await openPanel(SEARCH);
await R(p, `const w=r.querySelector('#want'); w.value='with lens'; w.dispatchEvent(new Event('change'))`);
await sleep(300);
let other = await openPanel("https://www.ebay.com/sch/i.html?_nkw=game+boy");
ok("another search starts without the first one's wants", (await R(other, `return r.querySelector('#want').value`)) === "");
await other.close();
p = await openPanel(SEARCH);
ok("the first search still has its own", (await R(p, `return r.querySelector('#want').value`)) === "with lens");
await p.ev(`location.href = "https://www.ebay.com/itm/184891897312"`);
await sleep(2500);
ok("a listing opened from that search in the same tab gets its wants", (await R(p, `return r.querySelector('#want').value`)) === "with lens");

// ---------- searches, marks and Saved ----------
await reset();
p = await openPanel(SEARCH);
ok("a search has a Search ideas button", (await R(p, `const b=r.querySelector('[data-act=ideas]'); return !b.hidden && b.textContent==='Search ideas'`)));
it = await openPanel("https://www.ebay.com/itm/184891897312");
await sleep(1200);
ok("a listing page doesn't", await R(it, `return r.querySelector('[data-act=ideas]').hidden`));
await scan(p);
await R(p, `[...r.querySelector('.list .row').querySelectorAll('button')].find(b=>b.textContent==='Hide').click()`);
await sleep(400);
const before = await p.ev(`[document.querySelectorAll('[data-tk-hide]').length, document.querySelectorAll('.tirekick-marks, .tirekick-sticker').length]`);
await R(p, `r.querySelector('[data-mode=reseller]').click()`);
await sleep(500);
const after = await p.ev(`[document.querySelectorAll('[data-tk-hide]').length, document.querySelectorAll('.tirekick-marks').length]`);
ok("switching mode keeps the free marks and what you hid", before[0] === 1 && after[0] === 1 && after[1] > 0, { before, after });
await R(p, `r.querySelector('[data-view=saved]').click()`);
await sleep(300);
await R(p, `r.querySelector('.hidden-box').open = true`);
await sleep(100);
await store(`{saved:{'ebay:5555555555':{t:'Something saved elsewhere',u:'javascript:alert(1)',p0:10,a0:${Date.now()},p:10,a:${Date.now()}}}}`);
await sleep(600);
ok("the Hidden section stays open while Saved redraws", await R(p, `return r.querySelector('.hidden-box')?.open === true`));
ok("Saved links never point anywhere but eBay or Facebook", await R(p, `return [...r.querySelectorAll('.saved-body a[href]')].every(a=>/^https:\\/\\/www\\.(ebay|facebook)\\.com\\//.test(a.href)) && r.querySelector('.saved-body a[href*="5555555555"]')?.href === 'https://www.ebay.com/itm/5555555555'`));

// ---------- Home and the toolbar number ----------
const NOW = Date.now(), DAY = 864e5;
const day = (i: number) => new Date(NOW - i * DAY).toLocaleDateString("en-CA");
await reset(`{monthlyBudget:10, alertsAck:{},
  usage:{days:{'${day(0)}':{usd:0.12,calls:3,models:{'claude-haiku-5-5':{usd:0.12,calls:3}}},'${day(4)}':{usd:0.05,calls:1,models:{'claude-sonnet-5-5':{usd:0.05,calls:1}}}}},
  saved:{'ebay:1000000000001':{t:'Game Boy Advance SP Cobalt',u:'https://www.ebay.com/itm/1000000000001',p0:70,a0:${NOW - 9 * DAY},p:52,a:${NOW - DAY}},
         'ebay:1000000000002':{t:'Game Boy Advance SP Pearl',u:'https://www.ebay.com/itm/1000000000002',p0:79,a0:${NOW - 5 * DAY},p:79,a:${NOW - DAY}},
         'fb:991':{t:'Super Nintendo console',u:'javascript:evil()',p0:120,a0:${NOW - 3 * DAY},p:95,a:${NOW - 2 * DAY}}},
  savedSearches:{'ebay|game boy sp':{site:'ebay',q:'game boy sp',url:'https://evil.example/',a0:${NOW - 8 * DAY},v:${NOW - 2 * DAY},n:48,fresh:3,deal:60,deals:4}},
  stats:{since:${NOW - 12 * DAY},scans:14,saves:6}}`);
await sleep(600);
const badge = () => o.ev(`chrome.action.getBadgeText({})`);
const title = () => o.ev(`chrome.action.getTitle({})`);
ok("the toolbar number counts cheaper saved listings and searches at your price", (await badge()) === "3" && /got cheaper/.test(await title()) && /at your price/.test(await title()), [await badge(), await title()]);
p = await openPanel(SEARCH);
ok("the Home tab shows the same number before you look", (await R(p, `return r.querySelector('[data-view=home] .cnt').textContent`)) === "3");
await R(p, `r.querySelector('[data-view=home]').click()`);
await sleep(1200);
ok("Home lists what's worth another look", (await R(p, `return r.querySelectorAll('.hm-alert').length`)) === 3);
ok("looking at Home clears the number", (await badge()) === "" && !!(await get("alertsAck")), await badge());
ok("Home only links to eBay and Facebook", await R(p, `return [...r.querySelectorAll('.view-home a[href]')].every(a=>/^https:\\/\\/www\\.(ebay|facebook)\\.com\\//.test(a.href))`));
const tiles = await R(p, `return [...r.querySelectorAll('.hm-tile span')].map(s=>s.textContent).join('|')`);
ok("Home's numbers are what you saved, not spending", tiles === "Saved listings|Price drops|Saved searches|At your price", tiles);
ok("30 days of spend: one labeled chart, a table view, model names", await R(p, `const plot=r.querySelector('.hm .plot'); return plot.getAttribute('role')==='img' && /30 days/.test(plot.getAttribute('aria-label')) && r.querySelectorAll('.hm-table tbody tr').length===2 && /Haiku 5.5/.test(r.querySelector('.view-home').textContent) && !r.querySelector('.hm .col[tabindex], button.col')`));
ok("no usage counters on Home", await R(p, `return !/What you use/.test(r.querySelector('.view-home').textContent)`));
const version = await o.ev(`chrome.runtime.getManifest().version`);
ok("Home shows the version", await R(p, `return r.querySelector('.hm-foot').textContent.includes(${JSON.stringify(version)})`));
await store(`{listingMemory:{}, stats:{}, saved:{}, savedSearches:{}, startHidden:false}`);
await sleep(800);
ok("a first visit gets a getting-started checklist", await R(p, `return /Getting started/.test(r.querySelector('.view-home').textContent) && r.querySelectorAll('.hm-steps li').length===4`));
await R(p, `[...r.querySelectorAll('.view-home button')].find(b=>b.textContent==='Hide').click()`);
await sleep(800);
ok("…which can be hidden and brought back", (await get("startHidden")) === true && (await R(p, `return [...r.querySelectorAll('.view-home button')].some(b=>/Show getting started/.test(b.textContent))`)));
ok("Home says so when there is nothing to show yet", await R(p, `return [...r.querySelectorAll('.hm-empty')].length >= 1`));
await c.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 760, deviceScaleFactor: 1, mobile: false }, p.sessionId);
await sleep(500);
ok("Home fits a narrow window without sideways scrolling", await R(p, `const b=r.querySelector('.body'); return b.scrollWidth <= b.clientWidth + 1 && r.querySelector('.panel').getBoundingClientRect().right <= innerWidth`));
await c.send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false }, p.sessionId);

// Tirekick's own page, for anywhere else: one tab, brought back rather than opened twice
const pages = async () => (await c.send("Target.getTargets")).targetInfos.filter((t: any) => t.type === "page").length;
const n0 = await pages();
await o.ev(`chrome.runtime.sendMessage({type:'openHome'})`);
await sleep(1500);
const n1 = await pages();
await o.ev(`chrome.runtime.sendMessage({type:'openHome'})`);
await sleep(1000);
ok("Open Tirekick home opens its own page, and only once", n1 === n0 + 1 && (await pages()) === n1, { n0, n1, now: await pages() });
{
  const { targetInfos } = await c.send("Target.getTargets");
  for (const t of targetInfos) if (t.url.includes("/hub/hub.html")) await c.send("Target.closeTarget", { targetId: t.targetId });
  await store(`{saved:{'ebay:111':{t:'Pentax on eBay',u:'https://www.ebay.com/itm/111',p:80,p0:95,a:1,a0:1},'fb:222':{t:'Pentax on Marketplace',u:'https://www.facebook.com/marketplace/item/222/',p:60,p0:60,a:2,a0:2}}, savedSearches:{'ebay|pentax':{site:'ebay',q:'pentax',v:1},'facebook|pentax':{site:'facebook',q:'pentax',v:2}}}`);
  const hub = await open(`chrome-extension://${EXT}/hub/hub.html?q=pentax+k1000`);
  await sleep(9000); // a sold lookup waits its turn (lookups are spaced out)
  const view = await hub.ev(`({
    tags: [...document.querySelectorAll('#saved .tag')].map(t=>t.textContent),
    ebay: document.querySelector('#on-ebay').href, fb: document.querySelector('#on-fb').href,
    answer: document.querySelector('#answer').textContent,
    home: !!document.querySelector('#home .hm h3'),
  })`);
  ok("its Saved list marks each listing and search eBay or Marketplace", ["eBay", "Marketplace"].every((x) => view.tags.filter((t: string) => t === x).length === 2), view.tags);
  ok("looking something up links to that search on each site", /ebay\.com\/sch\/i\.html\?_nkw=pentax%20k1000/.test(view.ebay) && /facebook\.com\/marketplace\/search\?query=pentax%20k1000/.test(view.fb), [view.ebay, view.fb]);
  ok("…and says what it sold for on eBay, and how sure that is", /Typical price, used\$58/.test(view.answer) && /10 sales/.test(view.answer) && /Check a few/.test(view.answer), view.answer.slice(0, 200));
  // what goes into that number: only the thing itself, sold
  const sm = await hub.ev(`fetch(Tirekick.soldUrl("pentax k1000", "3000")).then(r=>r.text()).then(t=>{const m=Tirekick.summarizeSold(t,{query:"pentax k1000"}); return {n:m.n, median:m.median, ship:m.ship, confidence:m.confidence, dropped:m.dropped}})`);
  ok("sold prices leave out best-offer sales, lots, parts, other things and far-off prices", sm.n === 10 && sm.median === 58 && JSON.stringify(sm.dropped) === JSON.stringify({ offers: 1, lots: 1, parts: 1, unrelated: 1, outliers: 1, foreign: 0, ranges: 0 }), sm);
  ok("…say what buyers paid to ship, and how much to trust them", sm.ship === 9 && sm.confidence === "fair", sm);
  ok("…with Home below, as in the panel", view.home);
  // One saved search: no "Open all" button, and nothing in its place (it used to print "null")
  await store(`{savedSearches:{'ebay|pentax':{site:'ebay',q:'pentax',v:1}}}`);
  await sleep(500);
  const one = await hub.ev(`document.querySelector('#saved').textContent`);
  ok("one saved search leaves no stray \"null\" in Saved", !/null/.test(one) && /pentax/.test(one), one.slice(0, 200));
  await hub.close();
}

// the toolbar icon with something new: from tucked away, a click shows Home, a second one tucks the panel away
await R(p, `r.querySelector('[data-act=toggle]').click()`);
await sleep(400);
await p.ev(`window.dispatchEvent(new CustomEvent('tirekick-show', { detail: { view: 'home', toggle: true } }))`);
await sleep(400);
const shownHome = await R(p, `return r.querySelector('.wrap').classList.contains('open') && !r.querySelector('.view-home').hidden`);
await p.ev(`window.dispatchEvent(new CustomEvent('tirekick-show', { detail: { view: 'home', toggle: true } }))`);
await sleep(400);
ok("the toolbar icon opens on Home, and a second click tucks it away", shownHome && !(await R(p, `return r.querySelector('.wrap').classList.contains('open')`)));

// ---------- backups and settings ----------
await reset(`{batchSize:10, provider:'anthropic'}`);
const backup = {
  app: "second-look", version: "0.20.0", // from before the rename: must still restore
  settings: { batchSize: 999, provider: "bogus", hideWords: "repro, box only", needWords: "working", feePct: "lots" },
  saved: { "ebay:123": { t: "ok", u: "javascript:alert(1)", p0: 5, a0: 1, p: 5, a: 1 }, "not a key": { t: "junk" } },
  savedSearches: { "ebay|x": { site: "ebay", q: "x", url: "https://evil.example/" } },
  stats: { scans: 4, bad: -3 },
};
const file = (await Deno.makeTempDir()) + "/backup.json";
await Deno.writeTextFile(file, JSON.stringify(backup));
const { root } = await c.send("DOM.getDocument", {}, o.sessionId);
const { nodeId } = await c.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#restoreFile" }, o.sessionId);
await c.send("DOM.setFileInputFiles", { files: [file], nodeId }, o.sessionId);
await sleep(1200);
const after2 = await o.ev(`chrome.storage.local.get(['saved','savedSearches','batchSize','provider','filterWords','feePct','stats'])`);
const msg = await o.ev(`document.getElementById('msg').textContent`);
ok("a restored backup rebuilds bad links, drops junk and keeps settings within limits", after2.saved?.["ebay:123"]?.u === "https://www.ebay.com/itm/123" && !after2.saved?.["not a key"] && after2.savedSearches?.["ebay|x"]?.url === "https://www.ebay.com/sch/i.html?_nkw=x" && after2.batchSize === 30 && after2.provider === "anthropic" && after2.stats?.scans === 4 && !("bad" in after2.stats), after2);
ok("…turns old word lists into the one words setting, and says what it did", after2.filterWords === '-repro -"box only" working' && /replaced/.test(msg) && /left out/.test(msg), { fw: after2.filterWords, msg });
ok("every saved field has a place on the settings page, with one words box", await o.ev(`FIELDS.every(f=>document.getElementById(f)) && !!document.getElementById('filterWords') && !document.getElementById('hideWords') && !document.getElementById('needWords') && !!document.getElementById('anthropicScanModel')`));
await reset(`{provider:'ollama', ollamaUrl:'http://10.255.255.1:11434', textModel:'qwen3:4b'}`);
p = await openPanel(SEARCH);
st = await scan(p);
ok("an Ollama address you haven't allowed is not contacted", /isn't allowed/.test(st), st);

// ---------- sold prices from Facebook, with eBay refusing ----------
await reset(`{useSoldComps:true}`);
await closeAll(/www\.ebay\.com/);
const fb = await openPanel("https://www.facebook.com/marketplace/albuquerque/search?query=blockme");
await R(fb, `const q=r.querySelector('#q'); q.value='blockme'; q.dispatchEvent(new Event('input'))`);
await sleep(1200);
await R(fb, `r.querySelector('[data-act=prices]').click()`);
await sleep(2500);
st = await R(fb, `return r.querySelector('.statusrow .status').textContent + ' ' + r.querySelector('.market').textContent`);
const paused = await o.ev(`chrome.storage.local.get(['soldWorkerPausedUntil','soldCooldownUntil'])`);
ok("a refused lookup from Facebook pauses only that route and says how to get going again", /Open eBay/.test(st) && paused.soldWorkerPausedUntil > Date.now() && !(paused.soldCooldownUntil > Date.now()), { st, paused });

// ---------- no errors ----------
const ours = errors.filter((e) => !/favicon|ERR_|net::/.test(e || ""));
ok("no page and no extension page logged an error", !ours.length, ours.slice(0, 5));
console.log(fails ? `${fails} FAILED` : "all passed");
c.close();
