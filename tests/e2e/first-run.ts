// First run: the welcome card opens the panel by itself on the first search, once. Got it puts it away for good
// (introDone), and the ? button brings it back.   tests/e2e/run.sh first-run.ts
import { start, sleep } from "./lib.ts";
const { open, c } = await start();
const ok = (name: string, cond: boolean, why: unknown = "") => console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ": " + JSON.stringify(why)}`);
const url = `https://www.ebay.com/sch/i.html?_nkw=pentax+k1000`;
const state = (p: any) => p.ev(`(()=>{const r=document.getElementById('second-look-host')?.shadowRoot; const w=r?.querySelector('.welcome');
  return { welcome: !!w && !w.hidden, open: !!r?.querySelector('.open'), focusInPanel: document.activeElement?.id === 'second-look-host' }})()`);
const act = (p: any, a: string) => p.ev(`document.getElementById('second-look-host').shadowRoot.querySelector('[data-act="${a}"]').click()`);

let p = await open(url); await sleep(2000);
let s = await state(p);
ok("first search: the welcome shows and the panel opens by itself", s.welcome && s.open, s);
ok("…without taking focus from the page", !s.focusInPanel, s);
await act(p, "intro-done"); await sleep(500);
s = await state(p);
ok("Got it puts the welcome away", !s.welcome, s);
await p.close();

p = await open(url); await sleep(2000);
s = await state(p);
ok("next search: no welcome, and the panel stays closed", !s.welcome && !s.open, s);
await act(p, "help"); await sleep(300);
ok("the ? button brings the welcome back", (await state(p)).welcome);
c.close();
