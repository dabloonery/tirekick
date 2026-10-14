// Marketplace look check: the tags on a dark, Marketplace-shaped grid, and the hover card on a card at the
// grid's left edge (Facebook clips anything past it). Writes PNGs to $LOOK_OUT.  tests/e2e/run.sh look-fb.ts
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const OUT = Deno.env.get("LOOK_OUT") || ".";
const o = await open(`chrome-extension://${EXT}/options/options.html`);
await o.ev(`chrome.storage.local.set({anthropicKey:'sk-ant-test', anthropicUrl:'http://localhost:1234', useSoldComps:true, introDone:true})`);
const sh = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);
const a = await open(`https://www.facebook.com/marketplace/albuquerque/search?query=film+camera&dark`);
await c.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 960, deviceScaleFactor: 1, mobile: false }, a.sessionId);
await sleep(2000);
await sh(a, `r.querySelector('[data-act=tab]').click()`); await sleep(400);
await sh(a, `r.querySelector('[data-act=scan]').click()`); await sleep(2800);
await sh(a, `r.querySelector('[data-act=tab]')?.click()`); await sleep(400);
await a.shot(`${OUT}/fb_cards.png`, { x: 360, y: 0, width: 1100, height: 700 });
// hover the first card's tag (at the grid's left edge)
const at = await a.ev(`(()=>{const b=document.querySelector('.tirekick-sticker .tk-score').getBoundingClientRect(); return [b.x+b.width/2,b.y+b.height/2]})()`);
await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at[0], y: at[1] }, a.sessionId); await sleep(400);
const pop = await a.ev(`(()=>{const p=document.querySelector('.tirekick-sticker:hover .tk-pop'); if(!p) return null; const r=p.getBoundingClientRect(); const g=document.querySelector('div[role=main]').getBoundingClientRect(); return {left:Math.round(r.left), right:Math.round(r.right), gridLeft:Math.round(g.left), width:Math.round(r.width)}})()`);
console.log("pop:", JSON.stringify(pop));
const ok = (n: string, v: boolean) => { console.log((v ? "PASS " : "FAIL ") + n); if (!v) Deno.exitCode = 1; };
ok("hover card stays inside the grid", !!pop && pop.left >= pop.gridLeft);
await a.shot(`${OUT}/fb_hover.png`, { x: 300, y: 0, width: 800, height: 700 });
c.close();
