import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const o = await open(`chrome-extension://${EXT}/options/options.html`);
await o.ev(`chrome.storage.local.set({anthropicKey:'sk-ant-test', anthropicUrl:'http://localhost:1234', useSoldComps:false, introDone:true})`);
for (const scheme of ["dark", "light"]) {
  const p = await open(`https://www.ebay.com/sch/i.html?_nkw=pentax+k1000`);
  await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] }, p.sessionId);
  await sleep(1200);
  const r = (js: string) => p.ev(`(()=>{const r=document.getElementById('second-look-host').shadowRoot; ${js}})()`);
  await r(`r.querySelector('[data-act=tab]').click()`); await sleep(500);
  await r(`r.querySelector('[data-act=scan]').click()`); await sleep(2500);
  await p.shot(`look_${scheme}.png`, { x: 980, y: 20, width: 420, height: 870 });
}
c.close();
