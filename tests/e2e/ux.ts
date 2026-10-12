// Interaction checks for the quieter panel: Filter folds on Enter/Esc, row links show on hover only,
// "Scan again" steps back, the spend popover closes on Esc without closing the panel.
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const o = await open(`chrome-extension://${EXT}/options/options.html`);
await o.ev(`chrome.storage.local.set({anthropicKey:'sk-ant-test', anthropicUrl:'http://localhost:1234', useSoldComps:false, introDone:true})`);
const p = await open(`https://www.ebay.com/sch/i.html?_nkw=pentax+k1000`); await sleep(1500);
const R = (js: string) => p.ev(`(()=>{const r=document.getElementById('second-look-host').shadowRoot; ${js}})()`);
const ok = (name: string, cond: boolean, why = "") => console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ": " + why}`);
await R(`r.querySelector('[data-act=tab]').click()`); await sleep(400);
await R(`r.querySelector('[data-act=scan]').click()`); await sleep(2600);

// row links: hidden until the row is pointed at
const vis = () => R(`return getComputedStyle(r.querySelector('.list .row .row-acts > a')).visibility`);
await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5 }, p.sessionId); await sleep(150);
ok("row links hidden at rest", (await vis()) === "hidden", await vis());
const at = await R(`const b=r.querySelector('.list .row').getBoundingClientRect(); return [b.x+b.width/2, b.y+10]`);
await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at[0], y: at[1] }, p.sessionId); await sleep(150);
ok("row links show on hover", (await vis()) === "visible", await vis());

// nothing new: Scan again is secondary
ok("Scan again is secondary", (await R(`const b=r.querySelector('[data-act=scan]'); return b.className+'|'+b.textContent`)).startsWith("ghost|Scan again"), await R(`return r.querySelector('[data-act=scan]').className`));

// Filter: Enter folds the box, keeps the count, panel stays open
await R(`r.querySelector('.qf-toggle').click()`); await sleep(100);
await R(`const i=r.querySelector('.qf-words'); i.focus(); i.value='k1000'; i.dispatchEvent(new Event('input',{bubbles:true}))`); await sleep(300);
await p.key("Enter"); await sleep(200);
ok("Enter folds the filter", await R(`return r.querySelector('.qf').hidden`));
ok("button keeps the count", /Filter · 1/.test(await R(`return r.querySelector('.qf-toggle').textContent`)), await R(`return r.querySelector('.qf-toggle').textContent`));
await R(`r.querySelector('.qf-toggle').click()`); await sleep(100);
await R(`r.querySelector('.qf-words').focus()`);
await p.key("Escape"); await sleep(200);
ok("Esc folds the filter", await R(`return r.querySelector('.qf').hidden`));
ok("Esc in the filter keeps the panel open", await R(`return r.querySelector('.wrap').classList.contains('open')`));
ok("focus returns to Filter", await R(`return r.activeElement === r.querySelector('.qf-toggle')`));

// spend popover
await R(`r.querySelector('.spend').click()`); await sleep(150);
ok("spend popover opens", !(await R(`return r.querySelector('.spend-detail').hidden`)));
await p.key("Escape"); await sleep(150);
ok("Esc closes the popover first", (await R(`return r.querySelector('.spend-detail').hidden`)) && (await R(`return r.querySelector('.wrap').classList.contains('open')`)));
await R(`r.querySelector('.spend').click(); r.querySelector('.list .row .title').click()`); await sleep(150);
ok("a click elsewhere closes it", await R(`return r.querySelector('.spend-detail').hidden`));
c.close();
