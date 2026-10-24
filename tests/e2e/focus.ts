// What should Tirekick do (settings): the three focuses set the switches, open tabs follow, and changing a
// switch by hand reads as Custom.
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const API = "http://localhost:1234";
const o = await open(`chrome-extension://${EXT}/options/options.html`);
await sleep(800);
// A fresh install: the AI is opt-in, so it starts on Without the AI with the AI switch off and nothing to set up.
const fresh = await o.ev(`({focus:document.querySelector('input[name=focus]:checked')?.value, ai:document.getElementById('useAI').checked, folded:document.getElementById('sec-model').classList.contains('off'), title:document.getElementById('statusTitle').textContent, text:document.getElementById('statusText').textContent})`);
console.log((fresh.focus === "noai" && !fresh.ai && fresh.folded ? "PASS " : "FAIL ") + "a fresh install starts on Without the AI, with Use an AI off: " + JSON.stringify(fresh));
console.log((/^Ready: price checks and scam marks$/.test(fresh.title) && /off: to add them, turn on Use an AI/.test(fresh.text) ? "PASS " : "FAIL ") + "the banner says the free checks are ready and the AI is off until you turn it on: " + fresh.title);
if (fresh.focus !== "noai" || fresh.ai || !fresh.folded || !/^Ready: price checks and scam marks$/.test(fresh.title)) Deno.exitCode = 1;
await o.ev(`chrome.storage.local.set({useAI:true, anthropicKey:'sk-ant-test', anthropicUrl:'${API}', useSoldComps:false, introDone:true})`);
await o.ev(`location.reload()`); await sleep(1000);
const ok = (n: string, v: boolean, why = "") => { console.log((v ? "PASS " : "FAIL ") + n + (v ? "" : ": " + why)); if (!v) Deno.exitCode = 1; };
const sh = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);
const picked = () => o.ev(`document.querySelector('input[name=focus]:checked')?.value || (document.getElementById('focusCustom').hidden ? '' : 'custom')`);
const pick = async (v: string) => { await o.ev(`document.querySelector('input[name=focus][value=${v}]').click()`); await sleep(1200); };

ok("with the price lookups off, the focus reads Custom", (await picked()) === "custom", await picked());
await pick("everything");
ok("Everything turns the lookups back on and is picked", (await picked()) === "everything" && (await o.ev(`chrome.storage.local.get('useSoldComps').then(s=>s.useSoldComps)`)) === true);
await o.ev(`chrome.storage.local.set({useSoldComps:false})`); await sleep(300); // keep the test off eBay's sold pages

const a = await open(`https://www.facebook.com/marketplace/albuquerque/search?query=film+camera`); await sleep(2000);
await pick("scams");
const st = await o.ev(`({sw:['markScams','markPrices','markOther','useAI'].map(id=>document.getElementById(id).checked), title:document.getElementById('statusTitle').textContent})`);
ok("Scam check only: scam marks on, price words, other marks and the AI off", JSON.stringify(st.sw) === "[true,false,false,false]", JSON.stringify(st));
ok("Scam check only: the banner says so", /scam check only/.test(st.title), st.title);
const marks = await a.ev(`[...document.querySelectorAll('.tirekick-marks .tk-chip')].map(x=>x.textContent)`);
ok("Scam check only: the page's cards carry only scam marks", marks.length > 0 && marks.every((t: string) => /Scam|Code in title|Same photo|Same title|Likely scam|Too cheap|Contact/.test(t)), JSON.stringify(marks));
await sh(a, `r.querySelector('[data-act=tab]').click()`); await sleep(500);
ok("Scam check only: no Scan button in the panel", (await sh(a, `const n=r.querySelector('[data-act=scan]'); return !n || !n.getClientRects().length`)) === true);

await o.ev(`document.getElementById('markOther').click()`); await sleep(800);
ok("a switch changed by hand reads as Custom", (await picked()) === "custom", await picked());
await pick("noai");
ok("Without the AI: every mark on, the AI off", JSON.stringify(await o.ev(`['markScams','markPrices','markOther','useAI'].map(id=>document.getElementById(id).checked)`)) === "[true,true,true,false]");
c.close();
