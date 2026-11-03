// When the browser won't let Tirekick read eBay or Facebook (Firefox's add-on settings can take them away; Chrome's
// site access can hold them back): no page scripts go there, the other store keeps working, and Home says so with a
// way to ask again. Chrome won't let a test take a listed permission away, so the worker's permission check is
// stubbed to say eBay is off.
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const ok = (n: string, v: boolean, why = "") => { console.log((v ? "PASS " : "FAIL ") + n + (v ? "" : ": " + why)); if (!v) Deno.exitCode = 1; };
const o = await open(`chrome-extension://${EXT}/options/options.html`);
await o.ev(`chrome.storage.local.set({useSoldComps:false, introDone:true})`);
const { targetInfos } = await c.send("Target.getTargets", {});
const sw = targetInfos.find((t: any) => t.type === "service_worker" && t.url.includes(EXT));
const { sessionId } = await c.send("Target.attachToTarget", { targetId: sw.targetId, flatten: true });
const bg = async (expression: string) => (await c.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId)).result.value;
const blockedSites = () => o.ev(`new Promise(ok=>chrome.runtime.sendMessage({type:'blockedSites'}, ok)).then(r=>r.data)`);
const matches = () => o.ev(`chrome.scripting.getRegisteredContentScripts().then(x=>x.flatMap(s=>s.matches))`);
const host = (p: any) => p.ev(`!!document.getElementById('tirekick-host')`);

ok("normally nothing is blocked", (await blockedSites()).length === 0, JSON.stringify(await blockedSites()));

// eBay taken away
await bg(`(() => { const real = chrome.permissions.contains.bind(chrome.permissions); self.__realContains = real;
  chrome.permissions.contains = (p) => (p?.origins || []).some((o) => o.includes('ebay.com')) ? Promise.resolve(false) : real(p); })()`);
await bg(`syncAutoScripts()`);
const b = await blockedSites();
ok("eBay is reported as blocked, with what to ask for", b.length === 1 && b[0].key === "ebay" && b[0].origins.includes("https://www.ebay.com/*"), JSON.stringify(b));
const m = await matches();
ok("the page scripts no longer go on eBay, and still go on Facebook", !m.some((x: string) => x.includes("ebay")) && m.some((x: string) => x.includes("facebook")), JSON.stringify(m));
const eb0 = await open(`https://www.ebay.com/sch/i.html?_nkw=pentax+k1000`); await sleep(1500);
ok("a new eBay tab gets nothing", !(await host(eb0)));
const fb = await open(`https://www.facebook.com/marketplace/albuquerque/search?query=film+camera`); await sleep(1500);
ok("Facebook still gets the panel", await host(fb));
const hub = await open(`chrome-extension://${EXT}/hub/hub.html`); await sleep(1000);
const note = await hub.ev(`document.body.innerText`);
ok("Home says eBay can't be read", /Tirekick can't read eBay/.test(note), note.slice(0, 300));
ok("…with a button that asks again", (await hub.ev(`[...document.querySelectorAll('#home button')].some(b=>b.textContent==='Allow again')`)) === true);

// Given back
await bg(`(chrome.permissions.contains = self.__realContains, syncAutoScripts())`);
ok("given back: nothing is blocked", (await blockedSites()).length === 0);
ok("given back: the page scripts go on eBay again", (await matches()).some((x: string) => x.includes("ebay")));
await hub.ev(`location.reload()`); await sleep(1500);
ok("given back: the note is gone", !/Tirekick can't read/.test(await hub.ev(`document.body.innerText`)));
const eb = await open(`https://www.ebay.com/sch/i.html?_nkw=pentax+k1000`); await sleep(1500);
ok("given back: a new eBay tab gets the panel", await host(eb));
Deno.exit(Deno.exitCode || 0);
