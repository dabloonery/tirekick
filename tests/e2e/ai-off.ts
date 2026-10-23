// The AI turned off in settings (useAI): the panel shows no AI buttons, the free price check leads, and
// nothing reaches the AI service, even when a page asks the background for a scan directly.
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const API = "http://localhost:1234";
const calls = async () => (await fetch(`${API}/calls`)).json();
const o = await open(`chrome-extension://${EXT}/options/options.html`);
await o.ev(`chrome.storage.local.set({useAI:true, anthropicKey:'sk-ant-test', anthropicUrl:'${API}', useSoldComps:false, introDone:true, autoScan:true, useAI:false})`);
await fetch(`${API}/calls`, { method: "DELETE" });
const ok = (n: string, v: boolean, why = "") => { console.log((v ? "PASS " : "FAIL ") + n + (v ? "" : ": " + why)); if (!v) Deno.exitCode = 1; };
const sh = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);
const shown = (sel: string) => `(()=>{const n=r.querySelector('${sel}'); return !!n && n.getClientRects().length>0})()`;

const a = await open(`https://www.ebay.com/sch/i.html?_nkw=film+camera`); await sleep(2000);
await sh(a, `r.querySelector('[data-act=tab]').click()`); await sleep(600);
ok("no Scan, Search ideas, auto-scan switch or model menu", (await sh(a, `return [${["[data-act=scan]", "[data-act=ideas]", ".autoscan", ".model-pick", ".spend"].map(shown).join(",")}].every(v=>!v)`)) === true);
ok("no card inviting you to add an AI", (await sh(a, `return ${shown(".setup")}`)) === false);
ok("the free typical price is the main button", (await sh(a, `return r.querySelector('[data-act=prices]').classList.contains('scan')`)) === true);
await sleep(5000); // auto-scan is on in settings, but stays off with the AI
const res = await o.ev(`new Promise(ok=>chrome.runtime.sendMessage({type:'rankBatch', payload:{items:[{title:'x', url:'https://www.ebay.com/itm/1'}], query:'x'}}, ok))`).catch((e: Error) => ({ ok: false, error: String(e) }));
ok("the background refuses an AI call", res?.ok === false && /turned off/.test(res.error || ""), JSON.stringify(res));
ok("nothing reached the AI service", (await calls()).length === 0, JSON.stringify(await calls()));

await o.ev(`location.reload()`); await sleep(1200);
const title = await o.ev(`document.getElementById('statusTitle').textContent`);
ok("settings say the free checks are ready and the AI is off, and fold the AI section to its switch", /^Ready: price checks and scam marks$/.test(title) && /AI scores are optional and off/.test(await o.ev(`document.getElementById('statusText').textContent`)) && !(await o.ev(`document.getElementById('service').closest('.field').getClientRects().length`)) && !!(await o.ev(`document.getElementById('useAI').getClientRects().length`)), title);
ok("…and hide Scan automatically, which is an AI scan", !(await o.ev(`document.getElementById('autoScan').getClientRects().length`)));
await o.ev(`chrome.storage.local.set({useSoldComps:true})`); await sleep(800);
await sh(a, `r.querySelector('[data-act=prices]').click()`); await sleep(3000);
const said = await sh(a, `return r.querySelector('.status')?.textContent || ''`);
ok("the price check doesn't mention an AI the user has off", /^Compared/.test(said) && !/your AI/.test(said), said);
await o.ev(`chrome.storage.local.set({useSoldComps:false})`);

await o.ev(`chrome.storage.local.set({useAI:true, autoScan:false})`); await sleep(1200);
ok("turned back on, Scan is back with the setup kept", (await sh(a, `return ${shown("[data-act=scan]")}`)) === true);
c.close();
