// The Firefox zip in real Firefox (ROADMAP Brief 9): the event page starts, the page scripts go on eBay and
// Facebook, the free price check and a real sold-price lookup, a listing page, Saved, the popup and its pause switch,
// the AI switch asking Firefox about website content, Craigslist's optional access, a scan against the fake AI, and the AI refusing without that
// yes. Prints PASS/FAIL lines. Run with tests/e2e/firefox.sh, which builds the zip and starts Firefox.
import { start, installTemporary, EXT_URL, sleep } from "./bidi.ts";
const ff = await start();
let fails = 0;
const ok = (name: string, cond: unknown, why: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ": " + (typeof why === "string" ? why : JSON.stringify(why))}`);
};
const waitFor = async (fn: () => Promise<unknown>, ms = 8000) => {
  for (let t = 0; t < ms; t += 250) {
    if (await fn().catch(() => false)) return true;
    await sleep(250);
  }
  return false;
};
const API = "http://localhost:1234";
const calls = async () => (await (await fetch(`${API}/calls`)).json()).length;
const R = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);

ok("the Firefox zip installs as a temporary add-on", (await installTemporary(6000, Deno.env.get("EXT_DIR")!)) === "tirekick@tirekick.app");
await sleep(1500);
// Firefox opens settings on install (onInstalled in background.js), and the other pages are opened from there.
const o = await ff.adopt(`${EXT_URL}/options/options.html`);
// The event page, as settings sees it (no eval there: the add-on's CSP forbids it). Its errors are kept in settings'
// window, since its console isn't reachable over BiDi.
const bg = (js: string) => o.ev(`browser.runtime.getBackgroundPage().then((w) => (${js}))`);
await bg(`(self.__bgErrors = [], w.addEventListener("error", (e) => __bgErrors.push(String(e.message))), w.addEventListener("unhandledrejection", (e) => __bgErrors.push(String(e.reason?.message || e.reason))),
  ((err) => (w.console.error = (...a) => (__bgErrors.push(a.map(String).join(" ")), err(...a))))(w.console.error.bind(w.console)), true)`);

// ---------- the event page ----------
ok("the event page loaded sites.js, shared.js and background.js (no importScripts in Firefox)", (await bg(`[typeof w.TKSites, typeof w.TKShared, typeof w.syncAutoScripts].join()`)) === "object,object,function");
ok("it answers messages", (await o.ev(`browser.runtime.sendMessage({type:'blockedSites'})`))?.ok === true);
ok("eBay and Facebook can be read (host access granted)", (await o.ev(`browser.permissions.contains({origins:['https://www.ebay.com/*','https://www.facebook.com/*']})`)) === true);
const cs = await o.ev(`browser.scripting.getRegisteredContentScripts().then((x) => x.flatMap((s) => s.matches))`);
ok("the page scripts are registered for eBay and Facebook", cs.some((m: string) => m.includes("ebay")) && cs.some((m: string) => m.includes("facebook")), cs);
await o.ev(`browser.storage.local.set({introDone:true, useSoldComps:true})`);

// ---------- eBay search: the panel, tags and a real sold-price lookup ----------
const p = await ff.open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000");
ok("the panel is on an eBay search", await waitFor(() => p.ev(`!!document.getElementById('tirekick-host')`)));
const chips = () => p.ev(`[...document.querySelectorAll('.s-card')].map(c => [...(c.querySelector('.tirekick-sticker')?.shadowRoot || c).querySelectorAll('.tk-chip')].map(x => x.textContent).join(' | '))`);
ok("cards get price tags from a sold-price lookup (the worker's fetch to eBay)", await waitFor(async () => (await chips()).filter((t: string) => /typical/i.test(t)).length >= 2, 15000), await chips());
ok("…and the off-site contact card a scam mark", (await chips()).some((t: string) => /Scam\? Off-site contact/.test(t)), await chips());
await R(p, `r.querySelector('[data-act=tab]').click()`);
ok("the panel opens and lists the 6 listings", await waitFor(() => R(p, `return r.querySelectorAll('.list .row').length === 6`)), await R(p, `return r.querySelectorAll('.list .row').length`));

// ---------- Facebook ----------
const f = await ff.open("https://www.facebook.com/marketplace/albuquerque/search?query=film+camera");
ok("Marketplace: the panel and card tags", await waitFor(() => f.ev(`!!document.getElementById('tirekick-host') && document.querySelectorAll('.tirekick-marks').length >= 4`)), await f.ev(`document.querySelectorAll('.tirekick-marks').length`));

// ---------- a listing page ----------
const it = await ff.open("https://www.ebay.com/itm/1111111111");
ok("a listing page: the panel reads the listing", await waitFor(() => R(it, `return /Pentax K1000 35mm SLR/.test(r.textContent)`)), await R(it, `return r.textContent.replace(/\\s+/g,' ').slice(0,300)`));

// ---------- Saved, the popup and the pause switch ----------
await o.ev(`browser.runtime.sendMessage({type:'storeEdit', payload:{name:'saved', edit:{set:{'ebay:2222222222':{key:'ebay:2222222222', title:'Pentax K1000 with 50mm f/2 lens and case', url:'https://www.ebay.com/itm/2222222222', price:140, site:'ebay', savedAt:Date.now()}}}}})`);
const pop = await ff.open(`${EXT_URL}/hub/hub.html?popup`);
ok("the popup shows Saved", /itm\/2222222222/.test(await pop.ev(`document.body.innerText`)), (await pop.ev(`document.body.innerText`)).slice(0, 400));
ok("the popup's pause switch starts on", (await pop.ev(`document.getElementById('pause-switch').getAttribute('aria-checked')`)) === "true");
await pop.ev(`document.getElementById('pause-switch').click()`);
ok("pausing clears the open eBay tab, no reload", await waitFor(() => p.ev(`!document.getElementById('tirekick-host') && !document.querySelector('.tirekick-sticker')`)));
ok("…and the icon's title says so", /paused/i.test(await o.ev(`browser.action.getTitle({})`)), await o.ev(`browser.action.getTitle({})`));
await pop.ev(`document.getElementById('pause-switch').click()`);
ok("turned back on, the panel returns", await waitFor(() => p.ev(`!!document.getElementById('tirekick-host')`)));

// ---------- the AI: Firefox's website-content question, then a scan ----------
await o.ev(`browser.storage.local.set({provider:'anthropic', anthropicKey:'sk-ant-test', anthropicUrl:'${API}', serviceChosen:true})`);
const set = await ff.open(`${EXT_URL}/options/options.html`); // a second settings tab, with the key in place (the first holds the error hooks)
ok("the AI starts off", (await set.ev(`document.getElementById('useAI').checked`)) === false);
// A real click, as Firefox only asks inside one.
await set.click("#useAI");
ok("turning it on asks Firefox about website content, and the yes is kept", await waitFor(() => o.ev(`browser.permissions.contains({data_collection:['websiteContent']})`)));
ok("…and the AI is on", await waitFor(() => o.ev(`browser.storage.local.get('useAI').then((s) => s.useAI === true)`)));
// Craigslist: optional access, asked in the click.
await set.click("#onCraigslist");
ok("Craigslist on: Firefox is asked for craigslist.org and the page scripts go there", await waitFor(async () => (await o.ev(`browser.permissions.contains({origins:['https://*.craigslist.org/*']})`)) && (await o.ev(`browser.scripting.getRegisteredContentScripts().then((x) => x.some((s) => s.matches.some((m) => m.includes('craigslist'))))`))));
await fetch(`${API}/calls`, { method: "DELETE" });
const s = await ff.open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000");
await waitFor(() => R(s, `return !!r.querySelector('[data-act=scan]')`));
await R(s, `r.querySelector('[data-act=scan]').click()`);
ok("a scan reaches the AI service", await waitFor(async () => (await calls()) > 0, 15000));
ok("…and puts scores on the cards", await waitFor(() => s.ev(`document.querySelectorAll('.tirekick-sticker').length >= 4`), 15000), await s.ev(`document.querySelectorAll('.tirekick-sticker').length`));
// Without Firefox's yes (taken back in about:addons, or an AI turned on by a restored backup), nothing is sent.
await o.ev(`browser.permissions.remove({data_collection:['websiteContent']})`);
const refused = await o.ev(`browser.runtime.sendMessage({type:'rankBatch', payload:{items:[{key:'ebay:1', title:'x', price:1}], query:'x'}})`);
ok("without that yes, an AI call is refused and says why", refused?.ok === false && /Firefox/.test(refused.error || ""), refused);

// ---------- no errors ----------
const bgErrors = await o.ev(`__bgErrors`);
ok("no errors on the event page", !bgErrors.length, bgErrors);
const pageErrors = ff.errors.filter((e) => !/favicon/.test(e));
ok("no errors on store pages or Tirekick's own", !pageErrors.length, pageErrors);

console.log(fails ? `${fails} FAILED` : "all passed");
ff.close();
Deno.exit(fails ? 1 : 0);
