// The rename from Second Look to Tirekick: a tab left open across the update loses the old panel and card tags,
// and the old registered page script is dropped.   tests/e2e/run.sh rename.ts
import { start, sleep, EXT } from "./lib.ts";
const { open, c } = await start();
const ok = (n: string, cond: boolean, why: unknown = "") => console.log(`${cond ? "PASS" : "FAIL"} ${n}${cond ? "" : ": " + JSON.stringify(why)}`);
const p = await open("https://www.ebay.com/sch/i.html?_nkw=pentax+k1000"); await sleep(2000);
await p.ev(`(()=>{ const d=document; const h=d.createElement('div'); h.id='second-look-host'; d.body.append(h);
  const s=d.createElement('style'); s.id='second-look-styles'; d.head.append(s);
  const li=d.querySelector('li.s-card, li.s-item'); li.setAttribute('data-sl-v','good'); li.setAttribute('data-second-look-key','ebay:1'); li.setAttribute('data-second-look-pos','1'); li.style.position='relative';
  const t=d.createElement('div'); t.className='second-look-sticker'; li.append(t); d.documentElement.setAttribute('data-sl-theme','dark'); return true })()`);
const o = await open(`chrome-extension://${EXT}/options/options.html`);
const r = await o.ev(`(async()=>{ const [tab]=await chrome.tabs.query({url:'https://www.ebay.com/*'});
  await chrome.scripting.executeScript({target:{tabId:tab.id}, func:()=>{ window.__tirekickPanel=false; document.getElementById('tirekick-host')?.remove(); }});
  await chrome.scripting.executeScript({target:{tabId:tab.id}, files:['lib/sites.js','lib/shared.js','lib/theme.js','content/rules.js','content/adapters.js','lib/sold.js','content/home.js','content/panel.js']});
  return true })()`);
await sleep(1500);
const s = await p.ev(`({ old: document.querySelectorAll('#second-look-host,#second-look-styles,.second-look-sticker,[data-second-look-key],[data-sl-v],[data-second-look-pos]').length, theme: document.documentElement.hasAttribute('data-sl-theme'), pos: document.querySelector('li.s-card, li.s-item').style.position, host: !!document.getElementById('tirekick-host') })`);
ok("a tab open across the rename loses the old panel and tags and gets the new panel", s.old === 0 && !s.theme && s.pos === "" && s.host, s);
const b = await o.ev(`(async()=>{ await chrome.scripting.registerContentScripts([{id:'second-look-auto', matches:['https://www.ebay.com/*'], js:['lib/shared.js']}]);
  await chrome.storage.local.set({showTab:false}); await new Promise(r=>setTimeout(r,500)); await chrome.storage.local.set({showTab:true}); await new Promise(r=>setTimeout(r,800));
  return (await chrome.scripting.getRegisteredContentScripts()).map(s=>s.id) })()`);
ok("the old second-look-auto script is unregistered and tirekick-auto is registered", eq(b), b);
function eq(ids: string[]) { return ids.length === 1 && ids[0] === "tirekick-auto"; }
c.close();
