// The pause switch (toolbar popup and settings): paused, a store tab that's already open loses its panel and card
// tags without a reload and a new one gets nothing; the icon says so. Turned back on, both get Tirekick again,
// still without a reload.
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const o = await open(`chrome-extension://${EXT}/options/options.html`);
await o.ev(`chrome.storage.local.set({useSoldComps:false, introDone:true})`);
const ok = (n: string, v: boolean, why = "") => { console.log((v ? "PASS " : "FAIL ") + n + (v ? "" : ": " + why)); if (!v) Deno.exitCode = 1; };
const SEARCH = `https://www.facebook.com/marketplace/albuquerque/search?query=film+camera`;
const page = (p: any) => p.ev(`({host: !!document.getElementById('tirekick-host'), marks: document.querySelectorAll('.tirekick-marks').length, cells: document.querySelectorAll('[data-tk-cell] .tirekick-marks .tk-chip').length})`);
const title = () => o.ev(`chrome.action.getTitle({})`);

const a = await open(SEARCH); await sleep(2000);
let s = await page(a);
ok("on: the panel and card tags are on the page", s.host && s.marks > 0, JSON.stringify(s));

// Pause from the toolbar popup's switch
const pop = await open(`chrome-extension://${EXT}/hub/hub.html?popup`);
ok("the popup's switch starts on", (await pop.ev(`document.getElementById('pause-switch').getAttribute('aria-checked')`)) === "true");
await pop.ev(`document.getElementById('pause-switch').click()`); await sleep(1500);
ok("pressing it pauses", (await o.ev(`chrome.storage.local.get('paused').then(s=>s.paused)`)) === true);
ok("the popup says it's paused", /Paused/.test(await pop.ev(`document.getElementById('pause-hint').textContent`)) && (await pop.ev(`document.getElementById('pause-switch').getAttribute('aria-checked')`)) === "false");
s = await page(a);
ok("paused: the open tab clears, no reload", !s.host && s.marks === 0, JSON.stringify(s));
ok("paused: the icon's title says so", /paused/.test(await title()), await title());
ok("paused: the settings box is ticked too", (await o.ev(`document.getElementById('paused').checked`)) === true);
const b = await open(SEARCH); await sleep(2000);
s = await page(b);
ok("paused: a new store tab gets nothing", !s.host && s.marks === 0, JSON.stringify(s));

// Paused, "Check my saved searches" still works: you pressed it, so the searches it opens show Tirekick
const CHECK = "https://www.ebay.com/sch/i.html?_nkw=pentax+k1000";
await o.ev(`chrome.storage.local.set({savedSearches:{'ebay|pentax k1000':{site:'ebay', q:'pentax k1000', url:'${CHECK}', a0:1, v:0, n:0, fresh:0}}})`);
const started = await o.ev(`new Promise(ok=>chrome.runtime.sendMessage({type:'checkSavedSearches'}, ok))`);
ok("paused: Check my saved searches starts", started?.ok === true, JSON.stringify(started));
let checked: any = null;
for (let t = 0; t < 25000 && !(checked?.marks > 0); t += 500) {
  await sleep(500);
  const { targetInfos } = await c.send("Target.getTargets", {});
  const t2 = targetInfos.find((x: any) => x.type === "page" && x.url.startsWith(CHECK));
  if (!t2) continue;
  const { sessionId } = await c.send("Target.attachToTarget", { targetId: t2.targetId, flatten: true });
  const r = await c.send("Runtime.evaluate", { expression: `({host: !!document.getElementById('tirekick-host'), marks: document.querySelectorAll('.tirekick-marks').length})`, returnByValue: true }, sessionId);
  checked = r.result.value;
}
ok("paused: the search it opens shows the panel and tags", checked?.host && checked.marks > 0, JSON.stringify(checked));
s = await page(a);
ok("…and the other store tabs stay clear", !s.host && s.marks === 0, JSON.stringify(s));

// Back on from settings
await o.ev(`document.getElementById('paused').click()`); await sleep(2500);
ok("unticking the settings box turns it back on", (await o.ev(`chrome.storage.local.get('paused').then(s=>s.paused)`)) === false);
// (a tab reads its listings once it's the one on screen, as on any page load)
await c.send("Target.activateTarget", { targetId: a.targetId }); await sleep(2000);
s = await page(a);
ok("on again: the first tab has its panel and tags back, no reload", s.host && s.marks > 0, JSON.stringify(s));
await c.send("Target.activateTarget", { targetId: b.targetId }); await sleep(2000);
s = await page(b);
ok("on again: the tab opened while paused has them too", s.host && s.marks > 0, JSON.stringify(s));
ok("on again: the icon's title is plain", !/paused/.test(await title()), await title());
ok("on again: the popup's switch shows on", (await pop.ev(`document.getElementById('pause-switch').getAttribute('aria-checked')`)) === "true");
c.close();
