import { start, sleep } from "./lib.ts";
const { open, c } = await start();
const p = await open(`https://www.ebay.com/sch/i.html?_nkw=pentax+k1000`); await sleep(2000);
const r = (js: string) => p.ev(`(()=>{const r=document.getElementById('second-look-host').shadowRoot; ${js}})()`);
console.log("first control:", await r(`return r.querySelector('.controls').children[1].className+' | '+r.querySelector('.controls').children[2].className`));
console.log("off-site chip on card 4:", await p.ev(`[...document.querySelectorAll('.second-look-marks')].map(m=>m.textContent).filter(t=>/off-site|Contact/i.test(t)).length`));
await p.shot("first_run.png");
c.close();
