import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const o = await open(`chrome-extension://${EXT}/options/options.html`);
await o.ev(`chrome.storage.local.set({anthropicKey:'sk-ant-test', anthropicUrl:'http://localhost:1234', introDone:true})`);
const sh = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host').shadowRoot; ${js}})()`);
const e = await open(`https://www.ebay.com/sch/i.html?_nkw=nothing&empty=1`); await sleep(1500);
await sh(e, `r.querySelector('[data-act=scan]').click()`); await sleep(800);
console.log("empty status:", await sh(e, `return r.querySelector('.status').textContent`));
await sh(e, `r.querySelector('.status button').click()`); await sleep(500);
console.log("report:\n" + await sh(e, `return r.querySelector('.status').textContent`));
// scan on the normal page: model, caching header in request
const p = await open(`https://www.ebay.com/sch/i.html?_nkw=pentax+k1000`); await sleep(1500);
await sh(p, `r.querySelector('[data-act=scan]').click()`); await sleep(2500);
console.log("model used:", JSON.stringify((await (await fetch("http://localhost:1234/calls")).json()).at(-1)));
c.close();
