// Alerts on saved searches (Brief 1): a great find on a saved search you have open is kept on it, raises the
// toolbar number and a Home alert, and "Check my saved searches" opens each saved search in a tab you can see,
// one at a time. Prints PASS/FAIL lines.   tests/e2e/run.sh alerts.ts
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const API = "http://localhost:1234";
const ok = (n: string, v: unknown, why: unknown = "") => { console.log((v ? "PASS " : "FAIL ") + n + (v ? "" : ": " + (typeof why === "string" ? why : JSON.stringify(why)))); if (!v) Deno.exitCode = 1; };
const waitFor = async (fn: () => Promise<unknown>, ms = 15000) => {
  for (let t = 0; t < ms; t += 250) {
    if (await fn()) return true;
    await sleep(250);
  }
  return false;
};
const SEARCH = "https://www.ebay.com/sch/i.html?_nkw=pentax+k1000";
const o = await open(`chrome-extension://${EXT}/options/options.html`);
const get = (k: string) => o.ev(`chrome.storage.local.get(${JSON.stringify(k)}).then(s=>s[${JSON.stringify(k)}])`);
await o.ev(`chrome.storage.local.set({useAI:true, anthropicKey:'sk-ant-test', anthropicUrl:'${API}', useSoldComps:false, introDone:true, autoScan:true, monthlyBudget:5,
  savedSearches:{'ebay|pentax k1000':{site:'ebay', q:'pentax k1000', url:'${SEARCH}', a0:1, v:0, n:0, fresh:0}}})`);

// ---------- a great find on a saved search you have open ----------
const p = await open(SEARCH);
const found = await waitFor(async () => ((await get("savedSearches"))?.["ebay|pentax k1000"]?.gk || []).length > 0, 25000);
const gk = (await get("savedSearches"))?.["ebay|pentax k1000"]?.gk || [];
ok("auto-scan's great listing is kept on the saved search", found && gk[0]?.k?.startsWith("ebay:") && /^https:\/\/www\.ebay\.com\/itm\//.test(gk[0].u) && gk[0].t, gk);
await sleep(500);
ok("…and the toolbar number says so", (await o.ev(`chrome.action.getBadgeText({})`)) === "1", await o.ev(`chrome.action.getBadgeText({})`));
ok("…with a tooltip that names it", /had a great find/.test(await o.ev(`chrome.action.getTitle({})`)), await o.ev(`chrome.action.getTitle({})`));
const before = JSON.stringify(gk);
await p.ev(`location.reload()`);
await sleep(6000);
ok("the same page again adds nothing new", JSON.stringify((await get("savedSearches"))?.["ebay|pentax k1000"]?.gk) === before);

// ---------- Home ----------
const hub = await open(`chrome-extension://${EXT}/hub/hub.html`);
const homeText = () => hub.ev(`document.body.innerText`);
await waitFor(async () => /Great find|New/.test(await homeText()) && /pentax k1000/.test(await homeText()));
ok("Home shows the great find, its price and the search", /on your “pentax k1000” search/.test(await homeText()) && (await hub.ev(`[...document.querySelectorAll('.hm-alert a')].some(a=>/ebay\\.com\\/itm\\//.test(a.href))`)), await homeText());

// ---------- Check my saved searches ----------
const pages = async () => (await c.send("Target.getTargets")).targetInfos.filter((t: any) => t.type === "page" && t.url.startsWith(SEARCH)).length;
const openBefore = await pages();
await hub.ev(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Check my saved searches').click()`);
await waitFor(async () => /Opens your 1 saved search in tabs/.test(await homeText()));
ok("the first press says what it does and what scans would cost", /Opens your 1 saved search in tabs, one at a time/.test(await homeText()) && /scanned automatically/.test(await homeText()), await homeText());
ok("…and opens nothing yet", (await pages()) === openBefore);
await hub.ev(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Start').click()`);
await waitFor(async () => (await pages()) > openBefore);
ok("Start opens the saved search in a tab", (await pages()) === openBefore + 1);
await sleep(16000); // the run ends when the page has settled (or at 45 seconds)
const ask = `new Promise(ok=>chrome.runtime.sendMessage({type:'checkSavedSearches'}, ok))`;
await o.ev(`chrome.storage.local.set({monthlyBudget:0})`);
const noBudget = await o.ev(ask);
ok("with automatic scanning and a paid AI, it needs a monthly budget", noBudget?.ok === false && /budget/.test(noBudget.error), noBudget);
await o.ev(`chrome.storage.local.set({monthlyBudget:5})`);
const both = await o.ev(`Promise.all([${ask}, ${ask}])`);
ok("one run at a time", both.filter((r: any) => r?.ok).length === 1 && both.some((r: any) => /Already checking/.test(r?.error || "")), both);

// ---------- notifications are opt in ----------
ok("no notification permission until the switch asks for it", !(await o.ev(`chrome.permissions.contains({permissions:['notifications']})`)));
c.close();
