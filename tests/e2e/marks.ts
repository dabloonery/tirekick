// Which marks show (settings, Filters and marks): each kind follows its own switch on open tabs, a likely
// scam keeps its warning unless scam marks are turned off, and then it isn't grayed out with no reason.
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const o = await open(`chrome-extension://${EXT}/options/options.html`);
await o.ev(`chrome.storage.local.set({useAI:true, anthropicKey:'sk-ant-test', anthropicUrl:'http://localhost:1234', useSoldComps:false, introDone:true})`);
const ok = (n: string, v: boolean, why = "") => { console.log((v ? "PASS " : "FAIL ") + n + (v ? "" : ": " + why)); if (!v) Deno.exitCode = 1; };
const sh = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);
const a = await open(`https://www.facebook.com/marketplace/albuquerque/search?query=film+camera`); await sleep(2000);
const card = (id: string) => a.ev(`(()=>{const cell=document.querySelector('a[href*="/item/${id}/"]').closest('[data-tk-cell]'); return {chips:[...cell.querySelectorAll('.tirekick-marks .tk-chip')].map(x=>x.textContent), v:cell.getAttribute('data-tk-v')||'', faded:!!cell.querySelector('[data-tk-faded]'), btns:cell.querySelectorAll('.tirekick-marks button').length}})()`);
const set = async (s: string) => { await o.ev(`chrome.storage.local.set(${s})`); await sleep(1200); };

let scam = await card("222"), down = await card("555");
ok("by default a reposted scam is marked and grayed", scam.chips.some((t: string) => /^Scam\? Reposted/.test(t)) && scam.v === "suspicious", JSON.stringify(scam));
ok("by default a marked-down card says it was $75", down.chips.some((t: string) => /was \$75/.test(t)), JSON.stringify(down));

await set(`{markPrices:false, markOther:false}`);
scam = await card("222"); down = await card("555");
ok("scam check only: the scam mark stays", scam.chips.some((t: string) => /^Scam\? Reposted/.test(t)) && scam.v === "suspicious", JSON.stringify(scam));
ok("scam check only: the price drop goes, Save and Hide stay", !down.chips.length && down.btns >= 2, JSON.stringify(down));

await set(`{markPrices:true, markOther:true, markLimit:1}`);
const counts = await a.ev(`[...document.querySelectorAll('[data-tk-cell]')].map(cell=>cell.querySelectorAll('.tirekick-marks .tk-chip').length)`);
ok("one mark per listing", counts.every((n: number) => n <= 1), JSON.stringify(counts));
ok("with one mark, the scam mark is the one", (await card("222")).chips[0]?.startsWith("Scam? Reposted"), JSON.stringify(await card("222")));

await set(`{markLimit:3, markScams:false}`);
scam = await card("222");
ok("scam marks off: no scam chip, and the card isn't gray with no reason", !scam.chips.some((t: string) => /Scam/.test(t)) && !scam.v && !scam.faded, JSON.stringify(scam));
await sh(a, `r.querySelector('[data-act=tab]').click()`); await sleep(500);
ok("scam marks off: the panel's list still warns", /Likely scam/.test(await sh(a, `return [...r.querySelectorAll('.list .row')].map(x=>x.textContent).join(' | ')`)));

// The settings page: the switch asks before scam marks go, and saying no leaves them on
await o.ev(`chrome.storage.local.set({markScams:true})`); await o.ev(`location.reload()`); await sleep(800);
await o.ev(`window.confirm = () => false; document.getElementById('markScams').click()`); await sleep(400);
ok("turning scam marks off asks first; no leaves them on", (await o.ev(`chrome.storage.local.get('markScams').then(s=>s.markScams)`)) === true && (await o.ev(`document.getElementById('markScams').checked`)));
await o.ev(`window.confirm = () => true; document.getElementById('markScams').click()`); await sleep(400);
ok("and yes turns them off", (await o.ev(`chrome.storage.local.get('markScams').then(s=>s.markScams)`)) === false);
c.close();
