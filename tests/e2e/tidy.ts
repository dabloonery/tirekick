// 0.39.0: a tidier page and more help before any AI. The Marketplace home feed without its clutter, the quick
// filters and Skips out of the Filter drawer, a free read on every listing, an offer without an analysis,
// search ideas on the feed, color back, and clicking the page tucking the panel away. Prints PASS/FAIL lines.
//   tests/e2e/run.sh tidy.ts
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
const R = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);
const waitFor = async (fn: () => Promise<unknown>, ms = 8000) => {
  for (let t = 0; t < ms; t += 250) {
    if (await fn()) return true;
    await sleep(250);
  }
  return false;
};
const MARKET = { n: 20, median: 150, p25: 120, p75: 170, confidence: "good", ship: null, dropped: {}, currency: "$", samples: [] };
const soldFor = (q: string) => store(`{soldCache:{${JSON.stringify(`v2:used:${q.toLowerCase()}`)}:{at:Date.now(), market:${JSON.stringify(MARKET)}}}}`);

await o.ev(`chrome.storage.local.clear()`);
await store(`{introDone:true, useSoldComps:true}`);

// ---------- the Marketplace home feed ----------
const f = await open("https://www.facebook.com/marketplace/?feed");
const shown = () => f.ev(`[...document.querySelectorAll('a[href*="/marketplace/item/"]')].filter(a => a.getClientRects().length).map(a => a.getAttribute('href').match(/\\d+/)[0]).join(',')`);
await waitFor(async () => (await shown()) === "111,444,555");
ok("the home feed hides rentals, services, wanted posts, pets and $1 placeholders by itself", (await shown()) === "111,444,555", await shown());
await R(f, `r.querySelector('[data-act=tab]').click()`);
await sleep(400);
const bar = await R(f, `return { quick: [...r.querySelectorAll('.lb-quick .qt')].filter(b=>!b.hidden).map(b=>b.textContent+':'+b.getAttribute('aria-pressed')), filter: r.querySelector('.qf-toggle').textContent, drawer: r.querySelector('.qf').hidden, skip: !!r.querySelector('.listbar > .skipwrap [data-skip=hide]')?.getClientRects().length }`);
ok("…with the toggle in plain sight, not in the Filter drawer", bar?.quick?.includes("Hide off-topic:true") && bar.drawer && bar.filter === "Filter", bar);
ok("Skips and scams sits in the bar too, with the drawer closed", bar?.skip, bar);
await R(f, `[...r.querySelectorAll('.lb-quick .qt')].find(b=>b.textContent==='Hide off-topic').click()`);
await sleep(600);
ok("turning it off shows them again", (await shown()).split(",").length === 8, await shown());
await R(f, `[...r.querySelectorAll('.lb-quick .qt')].find(b=>b.textContent==='Hide off-topic').click()`);
await sleep(600);
ok("search ideas are offered on the feed (no search yet)", await R(f, `const b=r.querySelector('[data-act=ideas]'); return !b.hidden && b.textContent==='Find searches for what I want'`));
// Click the page: the panel tucks away.
await f.ev(`document.querySelector('main').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))`);
await sleep(400);
ok("clicking the page outside the panel tucks it away", await R(f, `return !r.querySelector('.wrap').classList.contains('open')`));
await f.close();

// ---------- a free read before any AI ----------
await soldFor("pentax k1000");
const e = await open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000");
await sleep(2000);
await R(e, `r.querySelector('[data-act=tab]').click()`);
await waitFor(() => R(e, `return r.querySelectorAll('.row .free-read').length > 2`));
const reads = await R(e, `return [...r.querySelectorAll('.list .row')].map(x => (x.querySelector('.free-read .verdict')?.textContent || '-') + ' ' + x.querySelector('.pr')?.firstChild?.textContent)`);
ok("unscored rows carry a free read from sold prices", reads?.includes?.("Good price $97") && reads.includes("Fair price $140"), reads);
ok("…and best first puts good prices first before any scan", /^Good price/.test(reads?.[0] || ""), reads);
ok("…but a broken one gets no price word: it's cheap for a reason", reads?.includes?.("- $35"), reads);
const cardChips = await e.ev(`[...document.querySelectorAll('.tk-chip')].map(c=>c.textContent).filter(t=>/% of sold$/.test(t))`);
ok("the card's sold chip says it in a word too", cardChips?.includes?.("Good price · 65% of sold") && cardChips.includes("23% of sold"), cardChips);
await e.close();

// ---------- an offer without an analysis ----------
await o.ev(`chrome.storage.local.remove('soldCache')`);
const it = await open("https://www.ebay.com/itm/184891897312");
await sleep(2500);
await R(it, `r.querySelector('[data-act=tab]').click()`);
await waitFor(() => R(it, `return !!r.querySelector('[data-act=offer-prices]')`));
ok("a listing page with no sold prices offers to work out an offer, free", await R(it, `return /Want an offer to send\\? Work one out from sold prices/.test(r.querySelector('.offer-ask')?.textContent || '')`));
await R(it, `r.querySelector('[data-act=offer-prices]').click()`);
await waitFor(() => R(it, `return /Offer \\$/.test(r.querySelector('.pi-line .offer')?.textContent || '')`), 12000);
ok("…and pressing it gives the offer and the message, with no AI", await R(it, `const b=r.querySelector('.pi-line .offer'); return /Offer \\$/.test(b?.textContent||'') && !!b.querySelector('.msg-kind [data-kind=friendly][aria-checked=true]')`), await R(it, `return r.querySelector('.pi-line')?.textContent`));
const calls = await (await fetch("http://localhost:1234/calls")).json();
ok("…without calling the model", !calls.length, calls);
// Color is back: the dark panel is navy with an orange main button.
const col = await R(it, `const w=r.querySelector('.wrap'); w.dataset.theme='dark'; const cs=getComputedStyle(w); return cs.getPropertyValue('--paper').trim()+' '+cs.getPropertyValue('--btn').trim()`);
ok("the dark theme is navy with an orange button again", col === "#1A2B4C #FF8F3A", col);
await it.close();

// ---------- the toolbar icon: a popup everywhere, the panel on the stores ----------
const pop = await o.ev(`chrome.action.getPopup({})`);
ok("the icon opens Tirekick's page as a popup", /\/hub\/hub\.html\?popup$/.test(pop), pop);
const st = await open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000");
await sleep(2000);
const tabPop = await o.ev(`chrome.tabs.query({ url: 'https://www.ebay.com/sch/*' }).then(([t]) => chrome.action.getPopup({ tabId: t.id }))`);
ok("…but on an eBay page it opens the panel instead", tabPop === "", tabPop);
await st.close();
const hp = await open(`chrome-extension://${EXT}/hub/hub.html?popup`);
await sleep(800);
const hub = await hp.ev(`({ popup: document.documentElement.classList.contains('popup'), width: document.body.offsetWidth, tab: getComputedStyle(document.querySelector('.tab-link')).display !== 'none', look: !!document.querySelector('#look-form'), saved: !!document.querySelector('#saved') })`);
ok("the popup is the same page, narrow, with a link to open it in a tab", hub?.popup && hub.width === 400 && hub.tab && hub.look && hub.saved, hub);
const menus = await o.ev(`chrome.runtime.getManifest().action.default_title`);
ok("the icon's name is just Tirekick", menus === "Tirekick", menus);
await hp.close();

ok("no page logged an error", !errors.length, errors.slice(0, 5));
console.log(fails ? `${fails} FAILED` : "all passed");
c.close();
