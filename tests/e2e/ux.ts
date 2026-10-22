// Interaction checks for the quieter panel: Filter folds on Enter/Esc, row links show on hover only,
// "Scan again" steps back, the spend popover closes on Esc without closing the panel.
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const o = await open(`chrome-extension://${EXT}/options/options.html`);
await o.ev(`chrome.storage.local.set({anthropicKey:'sk-ant-test', anthropicUrl:'http://localhost:1234', useSoldComps:false, introDone:true})`);
const p = await open(`https://www.ebay.com/sch/i.html?_nkw=pentax+k1000`); await sleep(1500);
const R = (js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host').shadowRoot; ${js}})()`);
const ok = (name: string, cond: boolean, why = "") => console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ": " + why}`);
await R(`r.querySelector('[data-act=tab]').click()`); await sleep(400);
await R(`r.querySelector('[data-act=scan]').click()`); await sleep(2600);

// row links: hidden until the row is pointed at
const vis = () => R(`return getComputedStyle(r.querySelector('.list .row .row-acts > button:not(.on)')).visibility`);
await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5 }, p.sessionId); await sleep(150);
ok("row links hidden at rest", (await vis()) === "hidden", await vis());
const at = await R(`const b=r.querySelector('.list .row').getBoundingClientRect(); return [b.x+b.width/2, b.y+10]`);
await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at[0], y: at[1] }, p.sessionId); await sleep(150);
ok("row links show on hover", (await vis()) === "visible", await vis());
ok("Open is under every price, at rest too", await R(`const rows=[...r.querySelectorAll('.list .row')]; return rows.length > 0 && rows.every((x)=>{const o=x.querySelector('.pr .open'); return o && getComputedStyle(o).visibility==='visible' && /\\/itm\\//.test(o.href)})`));
ok("a title shows the card on the page (it's a button, not a link)", await R(`return r.querySelector('.list .row .title').tagName === 'BUTTON'`));

// a scored card's tag: on hover, Save / Sold / Not interested are chips (a fill of their own), not bare text over the photo
const tagAt = await p.ev(`(()=>{const b=document.querySelector('.tirekick-sticker .tk-score').getBoundingClientRect(); return [b.x+b.width/2, b.y+b.height/2]})()`);
await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: tagAt[0], y: tagAt[1] }, p.sessionId); await sleep(250);
const chipLook = await p.ev(`(()=>{const b=[...document.querySelectorAll('.tirekick-sticker .tk-under .tk-acts button')].find(x=>x.textContent==='Save'); if(!b) return 'none'; const cs=getComputedStyle(b); return cs.backgroundColor+' '+cs.borderRadius})()`);
ok("hover chips on a tag keep their chip look", !/rgba\(0, 0, 0, 0\)|^none/.test(chipLook) && chipLook.endsWith("999px"), chipLook);

// nothing new: Scan again is secondary
ok("Scan again is secondary", (await R(`const b=r.querySelector('[data-act=scan]'); return b.className+'|'+b.textContent`)).startsWith("ghost|Scan again"), await R(`return r.querySelector('[data-act=scan]').className`));

// Filter: Enter folds the box, keeps the count, panel stays open
await R(`r.querySelector('.qf-toggle').click()`); await sleep(100);
await R(`const i=r.querySelector('.qf-words'); i.focus(); i.value='k1000'; i.dispatchEvent(new Event('input',{bubbles:true}))`); await sleep(300);
await p.key("Enter"); await sleep(200);
ok("Enter folds the filter", await R(`return r.querySelector('.qf').hidden`));
ok("button keeps the count", /Filter \(1\)/.test(await R(`return r.querySelector('.qf-toggle').textContent`)), await R(`return r.querySelector('.qf-toggle').textContent`));
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
// clicking off: the Sort menu and the spend popover both close
const so = await R(`const b=r.querySelector('.sort').getBoundingClientRect(); return [b.x+b.width/2, b.y+b.height/2]`);
await p.click(so[0], so[1]); await sleep(300);
ok("Sort menu opens", await R(`return r.querySelector('.sort').matches(':open')`));
await p.click(300, 400); await sleep(300);
ok("a click on the page closes the Sort menu", !(await R(`return r.querySelector('.sort').matches(':open')`)));
await R(`r.querySelector('[data-act=tab]').click()`); await sleep(400); // that click tucked nothing? make sure it's open
if (!(await R(`return r.querySelector('.wrap').classList.contains('open')`))) { await R(`r.querySelector('[data-act=tab]').click()`); await sleep(400); }
await R(`r.querySelector('.spend').click()`); await sleep(150);
await p.click(300, 400); await sleep(200);
ok("a click on the page closes the spend popover", await R(`return r.querySelector('.spend-detail').hidden`));

// moving: drag the header to the left half, it docks left; resizing: the inner edge snaps to a width
if (!(await R(`return r.querySelector('.wrap').classList.contains('open')`))) { await R(`r.querySelector('[data-act=tab]').click()`); await sleep(400); }
const hd = await R(`const b=r.querySelector('.head .grow').getBoundingClientRect(); return [b.x+20, b.y+8]`);
const drag = async (from: number[], to: number[]) => {
  await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from[0], y: from[1] }, p.sessionId);
  await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: from[0], y: from[1], button: "left", buttons: 1, clickCount: 1 }, p.sessionId);
  for (let i = 1; i <= 8; i++) await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from[0] + ((to[0] - from[0]) * i) / 8, y: from[1], button: "left", buttons: 1 }, p.sessionId);
  await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: to[0], y: to[1], button: "left", buttons: 0, clickCount: 1 }, p.sessionId);
  await sleep(500);
};
await drag(hd, [200, hd[1]]);
ok("drag the header left: it docks left", (await R(`return r.querySelector('.wrap').dataset.side`)) === "left" && (await R(`return Math.round(r.querySelector('.panel').getBoundingClientRect().left)`)) < 40, await R(`return r.querySelector('.wrap').dataset.side+' '+r.querySelector('.panel').getBoundingClientRect().left`));
const edge = await R(`const b=r.querySelector('.rz-e').getBoundingClientRect(); return [b.x+b.width/2, b.y+b.height/2]`);
await drag(edge, [edge[0] + 95, edge[1]]);
ok("pull the inner edge: it settles on the wide size", (await R(`return Math.round(r.querySelector('.panel').getBoundingClientRect().width)`)) === 480, String(await R(`return r.querySelector('.panel').getBoundingClientRect().width`)));
await R(`r.querySelector('.head').focus()`); await p.key("ArrowRight"); await sleep(400); await p.key("ArrowDown"); await sleep(400);
ok("keyboard: right arrow docks right, down narrows", (await R(`return r.querySelector('.wrap').dataset.side`)) === "right" && (await R(`return Math.round(r.querySelector('.panel').getBoundingClientRect().width)`)) === 380);
await sleep(500);
ok("the place is remembered per site", JSON.stringify((await o.ev(`chrome.storage.local.get('panelBox')`)).panelBox || {}) === "{}" , JSON.stringify(await o.ev(`chrome.storage.local.get('panelBox')`)));
await p.key("ArrowLeft"); await sleep(800);
ok("…and saved when it's not the default", (await o.ev(`chrome.storage.local.get('panelBox')`)).panelBox?.ebay?.side === "left", JSON.stringify(await o.ev(`chrome.storage.local.get('panelBox')`)));
c.close();
