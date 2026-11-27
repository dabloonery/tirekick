// After an update: the features it brought that are off get a dot on the toolbar icon and a "New in this version"
// card at the top of the popup and on Home, each with a Turn on button; seeing the card takes the dot away, Got it
// puts the card away. Chrome can't run a real update or answer a permission prompt in a test, so the worker's
// update step is called with an older version, and the page's permission request is stubbed.
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const ok = (n: string, v: boolean, why = "") => { console.log((v ? "PASS " : "FAIL ") + n + (v ? "" : ": " + why)); if (!v) Deno.exitCode = 1; };
const o = await open(`chrome-extension://${EXT}/options/options.html`);
await o.ev(`chrome.storage.local.set({useSoldComps:false, introDone:true})`);
const { targetInfos } = await c.send("Target.getTargets", {});
const sw = targetInfos.find((t: any) => t.type === "service_worker" && t.url.includes(EXT));
const { sessionId } = await c.send("Target.attachToTarget", { targetId: sw.targetId, flatten: true });
const bg = async (expression: string) => (await c.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId)).result.value;
const badge = () => o.ev(`chrome.action.getBadgeText({})`);
const title = () => o.ev(`chrome.action.getTitle({})`);
const store = (k: string[]) => o.ev(`chrome.storage.local.get(${JSON.stringify(k)})`);

ok("no dot before an update", (await badge()) === "");
await bg(`noteWhatsNew(chrome.runtime.getManifest().version)`); await sleep(300);
ok("a reload of the same version lists nothing", !(await store(["whatsNew"])).whatsNew);
await bg(`noteWhatsNew("0.58.0")`); await sleep(800);
const w = (await store(["whatsNew", "whatsNewSeen"]));
ok("an update from 0.58.0 lists what came since", w.whatsNew?.ids?.includes("chatCheck") && w.whatsNew.ids.includes("onCraigslist") && w.whatsNewSeen === false, JSON.stringify(w));
ok("the icon gets a dot", (await badge()) === "•", await badge());
ok("…and its title says why", /Updated: 4 new features you can turn on/.test(await title()), await title());

const pop = await open(`chrome-extension://${EXT}/hub/hub.html?popup`); await sleep(1000);
const rows = () => pop.ev(`[...document.querySelectorAll('#news .hm-newlist li b')].map(b=>b.textContent)`);
ok("the popup opens on the card, at the top", (await pop.ev(`!!document.querySelector('#news .hm-news') && document.querySelector('#news').getBoundingClientRect().top < document.querySelector('.look').getBoundingClientRect().top`)) === true);
const r0 = await rows();
ok("it lists the four that need nothing else; auto scan waits for the AI", r0.length === 4 && !r0.some((t: string) => /Scan new/.test(t)), JSON.stringify(r0));
ok("Home lower down doesn't show it twice", (await pop.ev(`document.querySelectorAll('.hm-news').length`)) === 1);
ok("seeing it takes the dot away", (await store(["whatsNewSeen"])).whatsNewSeen === true && (await badge()) === "", await badge());

// One with nothing to ask: on in one press
await pop.ev(`document.querySelector('[aria-label="Turn on: Scam lines in Marketplace chats"]').click()`); await sleep(800);
ok("Turn on switches it on", (await store(["chatCheck"])).chatCheck === true);
ok("…and it leaves the card", !(await rows()).some((t: string) => /chats/.test(t)), JSON.stringify(await rows()));
const o2 = await open(`chrome-extension://${EXT}/options/options.html`);
ok("settings shows it ticked", (await o2.ev(`document.getElementById('chatCheck').checked`)) === true);
await o2.close();

// One the browser has to allow, refused
await pop.ev(`chrome.permissions.request = () => Promise.resolve(false)`);
await pop.ev(`document.querySelector('[aria-label="Turn on: Craigslist"]').click()`); await sleep(800);
ok("refused: it stays off and says so", (await store(["onCraigslist"])).onCraigslist !== true && /Craigslist stays off/.test(await pop.ev(`document.getElementById('news').innerText`)));
ok("refused: nothing is left waiting", !(await store(["whatsNewAsked"])).whatsNewAsked);

// Allowed while the popup closed before it heard back: the worker finishes the job
await o.ev(`chrome.storage.local.set({whatsNewAsked:"notifyGreat"})`);
await bg(`(() => { self.__realContains = chrome.permissions.contains.bind(chrome.permissions); chrome.permissions.contains = (p) => (p?.permissions || []).includes("notifications") ? Promise.resolve(true) : self.__realContains(p); })()`);
await bg(`finishOptIn()`); await sleep(800);
ok("allowed after the popup closed: the worker turns it on", (await store(["notifyGreat", "whatsNewAsked"])).notifyGreat === true && !(await store(["whatsNewAsked"])).whatsNewAsked);
await bg(`chrome.permissions.contains = self.__realContains`);
ok("…and the card drops it", JSON.stringify(await rows()) === JSON.stringify(["Craigslist", "Vinted"]), JSON.stringify(await rows()));

// The panel's Home on a store page has it too (it can't ask the browser, so it sends you to Tirekick's page)
const eb = await open(`https://www.ebay.com/sch/i.html?_nkw=pentax+k1000`); await sleep(1500);
await eb.ev(`window.dispatchEvent(new CustomEvent("tirekick-show"))`); await sleep(600);
await eb.ev(`document.getElementById('tirekick-host').shadowRoot.querySelector('.nav [data-view="home"]').click()`); await sleep(1200);
const panelCard = await eb.ev(`(() => { const r = document.getElementById('tirekick-host')?.shadowRoot; const b = r?.querySelector('.view-home .hm-newlist button'); return b ? b.textContent : null; })()`);
ok("the panel's Home shows the card, with a way to Tirekick's page", panelCard === "Turn on in Tirekick", String(panelCard));

// Got it
await pop.ev(`[...document.querySelectorAll('#news button')].find(b=>b.textContent==='Got it').click()`); await sleep(800);
ok("Got it puts the card away", (await pop.ev(`document.getElementById('news').children.length`)) === 0 && !(await store(["whatsNew"])).whatsNew);
ok("…and it stays away when a setting changes", (await o.ev(`chrome.storage.local.set({chatCheck:false}).then(()=>new Promise(r=>setTimeout(r,600))).then(()=>chrome.action.getBadgeText({}))`)) === "" && (await pop.ev(`document.getElementById('news').children.length`)) === 0);

await eb.close(); await pop.close(); await sleep(300); // out of sight, so the next card stays unseen
// A later update brings it back with only what's new then; an update after one you skipped keeps the old list
await bg(`noteWhatsNew("0.58.5")`); await sleep(800);
ok("a later update lists its features again, with the dot", (await store(["whatsNew"])).whatsNew?.ids?.length >= 3 && (await badge()) === "•");
await o.ev(`chrome.storage.local.set({chatCheck:true, onCraigslist:true, onVinted:true, notifyGreat:true})`); await sleep(800);
ok("everything on (in settings): the card and the dot go by themselves", !(await store(["whatsNew"])).whatsNew && (await badge()) === "", await badge());
Deno.exit(Deno.exitCode || 0);
