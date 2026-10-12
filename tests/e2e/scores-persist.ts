import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const o = await open(`chrome-extension://${EXT}/options/options.html`);
await o.ev(`chrome.storage.local.set({anthropicKey:'sk-ant-test', anthropicUrl:'http://localhost:1234', useSoldComps:false, introDone:true})`);
const q = `https://www.ebay.com/sch/i.html?_nkw=pentax+k1000`;
const sh = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('second-look-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);
// 1. scan in tab A
const a = await open(q); await sleep(1500);
await sh(a, `r.querySelector('[data-act=scan]').click()`); await sleep(3000);
console.log("A stickers:", await a.ev(`document.querySelectorAll('.second-look-sticker').length`));
console.log("stored:", await o.ev(`chrome.storage.local.get('scans').then(x=>Object.keys(x.scans||{}).length)`));
const nCalls = async () => (await (await fetch("http://localhost:1234/calls")).json()).length;
console.log("api calls after scan:", await nCalls());
// 2. a brand-new tab on the same search: scores should be there with no scan
const b = await open(q); await sleep(2000);
console.log("B stickers (no scan pressed):", await b.ev(`document.querySelectorAll('.second-look-sticker').length`), "calls", await nCalls());
console.log("B scan button:", await sh(b, `return r.querySelector('[data-act=scan]').textContent`));
await sh(b, `r.querySelector('[data-act=tab]').click()`); await sleep(500); await b.shot("s1_restored.png");
// 3. different search page containing same listings (other context): still restored
const d = await open(`https://www.ebay.com/sch/i.html?_nkw=film+camera`); await sleep(2000);
console.log("D (other search) stickers:", await d.ev(`document.querySelectorAll('.second-look-sticker').length`));
// 4. listing page shows the stored score
const i = await open(`https://www.ebay.com/itm/1111111111`); await sleep(2500);
console.log("item page line:", await sh(i, `return r.querySelector('.pi-line').textContent.slice(0,160)`));
// 5. analyze a listing, then the results page card is updated
const i2 = await open(`https://www.ebay.com/itm/184891897312`); await sleep(2000);
await sh(i2, `r.querySelector('[data-act=analyze]').click()`); await sleep(2500);
const st = await o.ev(`chrome.storage.local.get('scans').then(x=>JSON.stringify(x.scans['ebay:184891897312']))`);
console.log("analysis stored:", st.slice(0,160));
await i2.ev(`location.reload()`); await sleep(3000);
console.log("after reload line:", await sh(i2, `return r.querySelector('.pi-line').textContent.slice(0,200)`));
// 6. rescan with changed wants must re-judge (not restore)
const before = await nCalls();
await sh(b, `const w=r.querySelector('#want'); w.value='with charger'; w.dispatchEvent(new Event('input',{bubbles:true})); r.querySelector('[data-act=scan]').click()`); await sleep(3000);
console.log("rescan calls:", (await nCalls()) - before, "status:", await sh(b, `return r.querySelector('.status').textContent`));
// 7. theme survives
console.log("theme default kept:", await o.ev(`chrome.storage.local.set({theme:'light'}).then(()=>chrome.storage.local.get('theme'))`));
c.close();
