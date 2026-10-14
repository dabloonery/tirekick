// Accessibility pass: the browser's own accessibility tree (unnamed controls), the keyboard tab order
// (every stop shows a focus ring), forced colours (Windows high contrast) and 200% zoom.
// Writes screenshots and a11y.json to A11Y_OUT. Usage: A11Y_OUT=/tmp/x tests/e2e/run.sh a11y.ts
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const OUT = Deno.env.get("A11Y_OUT")!;
const o = await open(`chrome-extension://${EXT}/options/options.html`);
const setStore = (js: string) => o.ev(`chrome.storage.local.set(${js})`);
const R = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);
const media = (p: any, features: any[]) => c.send("Emulation.setEmulatedMedia", { features }, p.sessionId);
const report: any = {};
const front = (p: any) => c.send("Target.activateTarget", { targetId: p.targetId });
const step = (m: string) => console.error(new Date().toISOString().slice(11, 19), m);

const CONTROLS = new Set(["button", "link", "textbox", "searchbox", "combobox", "checkbox", "radio", "tab", "menuitem", "slider", "spinbutton", "switch", "listbox", "option", "img", "image"]);
// Controls the browser exposes with no name: what a screen reader would announce as just "button".
async function unnamed(p: any) {
  await c.send("Accessibility.enable", {}, p.sessionId);
  const { nodes } = await c.send("Accessibility.getFullAXTree", {}, p.sessionId);
  const out: string[] = [];
  for (const n of nodes) {
    if (n.ignored) continue;
    const role = n.role?.value; if (!CONTROLS.has(role)) continue;
    const name = (n.name?.value || "").trim();
    if (!name) {
      let hint = "";
      if (n.backendDOMNodeId) {
        const d = await c.send("DOM.describeNode", { backendNodeId: n.backendDOMNodeId }, p.sessionId).catch(() => null);
        const a = d?.node?.attributes || []; const at: any = {}; for (let i = 0; i < a.length; i += 2) at[a[i]] = a[i + 1];
        hint = `${d?.node?.localName}${at.class ? "." + at.class.split(" ")[0] : ""}${at["data-act"] ? "[" + at["data-act"] + "]" : ""}`;
      }
      out.push(`${role} ${hint}`);
    }
  }
  return out;
}
// Tab through the panel; note each stop and whether it shows a visible focus indicator.
async function tabWalk(p: any, max = 60) {
  await R(p, `r.querySelector('.drawer')?.focus?.(); (r.querySelector('.drawer [tabindex],.drawer button')||{}).focus?.()`);
  const stops: string[] = []; const noRing: string[] = [];
  for (let i = 0; i < max; i++) {
    const s = await R(p, `const e=r.activeElement; if(!e) return null; const cs=getComputedStyle(e);
      const ring=(cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>0)||/rgb/.test(cs.boxShadow);
      const lbl=(e.getAttribute('aria-label')||e.textContent||e.value||e.placeholder||'').trim().replace(/\\s+/g,' ').slice(0,30);
      return [e.tagName.toLowerCase()+(e.dataset.act?'['+e.dataset.act+']':e.className?'.'+String(e.className).split(' ')[0]:''), lbl, ring]`);
    if (!s) break;
    const id = `${s[0]} "${s[1]}"`; if (stops.includes(id) && stops.length > 3 && stops[0] === id) break;
    stops.push(id); if (!s[2]) noRing.push(id);
    await p.key("Tab");
    await sleep(60);
  }
  return { count: stops.length, stops, noRing };
}
const panel = (p: any, name: string) => front(p).then(() => p.ev(`[innerWidth, innerHeight]`).then(([vw, vh]: number[]) =>
  p.shot(`${OUT}/${name}.png`, { x: Math.max(0, vw - 440), y: 0, width: Math.min(440, vw), height: vh })));

await setStore(`{anthropicKey:'sk-ant-test', anthropicUrl:'http://localhost:1234', useSoldComps:false, introDone:true}`);
await o.ev(`chrome.storage.local.remove(['scans','listingMemory','saved','savedSearches','notInterested','usage','scoreCache','panelBox'])`);

// ---- names and keyboard, normal display ----
let p = await open(`https://www.ebay.com/sch/i.html?_nkw=pentax+k1000`); await sleep(1500);
await R(p, `r.querySelector('[data-act=tab]').click()`); await sleep(400);
await R(p, `r.querySelector('[data-act=scan]').click()`); await sleep(2600);
report.page_unnamed = await unnamed(p);
report.page_tabs = await tabWalk(p);
await R(p, `r.querySelector('[data-view=saved]').click()`); await sleep(400);
report.saved_unnamed = await unnamed(p);
await R(p, `r.querySelector('[data-view=home]').click()`); await sleep(800);
report.home_unnamed = await unnamed(p);
report.home_tabs = await tabWalk(p);
const s = await open(`chrome-extension://${EXT}/options/options.html`); await sleep(800);
report.settings_unnamed = await unnamed(s);

await Deno.writeTextFile(`${OUT}/a11y.json`, JSON.stringify(report, null, 1)); step('names and tabs done');
step('zoom');
// ---- 200% zoom: a 1400x900 window at 200% is a 700x450 CSS viewport ----
const z = await open(`https://www.ebay.com/sch/i.html?_nkw=pentax+k1000`);
await c.send("Emulation.setDeviceMetricsOverride", { width: 700, height: 450, deviceScaleFactor: 2, mobile: false }, z.sessionId); await sleep(1500);
await R(z, `r.querySelector('[data-act=tab]').click()`); await sleep(500);
report.zoom = await R(z, `const d=r.querySelector('.drawer').getBoundingClientRect(); const b=r.querySelector('.body');
  const over=[...r.querySelectorAll('button,select,input,a')].filter(e=>{const x=e.getBoundingClientRect(); return x.width && (x.right>innerWidth+1||x.left<-1)}).map(e=>e.className||e.tagName);
  return {drawer:[Math.round(d.left),Math.round(d.width),Math.round(d.height)], vw:innerWidth, bodyScrolls:b.scrollHeight>b.clientHeight, hScroll:b.scrollWidth>b.clientWidth+1, offscreen:over}`);
await z.shot(`${OUT}/zoom_page.png`, { x: 0, y: 0, width: 700, height: 450 });
await R(z, `r.querySelector('[data-view=home]').click()`); await sleep(700);
await z.shot(`${OUT}/zoom_home.png`, { x: 0, y: 0, width: 700, height: 450 });
const zs = await open(`chrome-extension://${EXT}/options/options.html`);
await c.send("Emulation.setDeviceMetricsOverride", { width: 700, height: 450, deviceScaleFactor: 2, mobile: false }, zs.sessionId); await sleep(800);
report.zoom_settings = await zs.ev(`({hScroll: document.documentElement.scrollWidth > innerWidth + 1})`);
await zs.shot(`${OUT}/zoom_settings.png`, { x: 0, y: 0, width: 700, height: 450 });

await Deno.writeTextFile(`${OUT}/a11y.json`, JSON.stringify(report, null, 1));
// ---- forced colours (Windows high contrast), dark and light ----
for (const scheme of ["dark", "light"]) {
  step('forced colours ' + scheme);
  await media(p, [{ name: "forced-colors", value: "active" }, { name: "prefers-color-scheme", value: scheme }]);
  await R(p, `r.querySelector('[data-view=page]').click()`); await sleep(500);
  await panel(p, `fc_${scheme}_page`);
  await front(p); await p.shot(`${OUT}/fc_${scheme}_cards.png`, { x: 0, y: 0, width: 960, height: 700 });
  await R(p, `r.querySelector('[data-view=home]').click()`); await sleep(600);
  await panel(p, `fc_${scheme}_home`);
  await R(p, `r.querySelector('.qf-toggle')?.click()`); await sleep(300);
  await front(s); await media(s, [{ name: "forced-colors", value: "active" }, { name: "prefers-color-scheme", value: scheme }]); await sleep(300);
  await s.shot(`${OUT}/fc_${scheme}_settings.png`, { x: 300, y: 0, width: 800, height: 1400 });
}
await media(p, []); await media(s, []);

await Deno.writeTextFile(`${OUT}/a11y.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
c.close();
