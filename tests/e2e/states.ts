// Every state the panel can be in when things don't go to plan, on the real extension: what it says,
// and whether it offers the way out. Rejected key, rate limit, an answer cut off, no connection, the
// budget used up, a scan under way and stopped, a page with nothing to scan, and Delete everything in
// settings. Prints PASS/FAIL lines; with STATES_OUT=dir it also saves a screenshot of each.
//   tests/e2e/run.sh states.ts
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const API = "http://localhost:1234";
const OUT = Deno.env.get("STATES_OUT");
let fails = 0;
const ok = (name: string, cond: unknown, why: unknown = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ": " + (typeof why === "string" ? why : JSON.stringify(why))}`);
};
const o = await open(`chrome-extension://${EXT}/options/options.html`);
const store = (js: string) => o.ev(`chrome.storage.local.set(${js})`);
const R = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('second-look-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);
const closeAll = async () => {
  const { targetInfos } = await c.send("Target.getTargets");
  for (const t of targetInfos) if (t.type === "page" && /www\.(ebay|facebook)\.com/.test(t.url)) await c.send("Target.closeTarget", { targetId: t.targetId }).catch(() => {});
};
const reset = async (extra: string) => {
  await closeAll();
  await o.ev(`chrome.storage.local.clear()`);
  await store(`{anthropicUrl:'${API}', useSoldComps:false, introDone:true, ...${extra}}`);
};
const shot = async (p: any, name: string) => {
  if (!OUT) return;
  await c.send("Target.activateTarget", { targetId: p.targetId });
  const [vw, vh] = await p.ev(`[innerWidth, innerHeight]`);
  // not a full-page capture: that resizes the page for a moment, which moves the panel's scroll
  const r = await c.send("Page.captureScreenshot", { format: "png", clip: { x: vw - 440, y: 0, width: 440, height: vh, scale: 1 } }, p.sessionId);
  await Deno.writeFile(`${OUT}/${name}.png`, Uint8Array.from(atob(r.data), (x) => x.charCodeAt(0)));
};
const SEARCH = "https://www.ebay.com/sch/i.html?_nkw=pentax+k1000";
const openPanel = async (url: string) => {
  const p = await open(url);
  await c.send("Target.activateTarget", { targetId: p.targetId }); // as you'd see it: the tab in front
  await sleep(1200);
  await R(p, `r.querySelector('[data-act=tab]').click()`);
  await sleep(400);
  return p;
};
const inView = (p: any, sel: string) => R(p, `const b=r.querySelector('.body').getBoundingClientRect(), e=r.querySelector('${sel}').getBoundingClientRect(); return e.height > 0 && e.top >= b.top && e.bottom <= b.bottom ? true : JSON.stringify({body:[b.top, b.bottom], el:[e.top, e.bottom]})`);
// What the status line says, and the label of its button if it has one.
const status = (p: any) => R(p, `const s=r.querySelector('.view-page .status'); return [s.textContent, s.classList.contains('err'), s.querySelector('button')?.textContent || '']`);
// Scan, then wait for the panel to finish (a 429 is retried twice, quietly, before it's reported).
const scanAndRead = async (p: any) => {
  await R(p, `r.querySelector('[data-act=scan]').click()`);
  await sleep(600);
  for (let i = 0; i < 40 && (await R(p, `return r.querySelector('.wrap').classList.contains('busy')`)); i++) await sleep(500);
  await sleep(300);
  return status(p);
};

// ---- errors from the model's service ----
const cases: [string, string, RegExp, string][] = [
  ["a rejected key", `{anthropicKey:'bad'}`, /key was rejected/, "Open settings"],
  ["a rate limit", `{anthropicKey:'ratelimit'}`, /rate limit/, ""],
  ["an answer cut off", `{anthropicKey:'cutoff'}`, /cut off/, "Open settings"],
  ["no connection", `{anthropicKey:'sk-ant-test', anthropicUrl:'http://localhost:9'}`, /Can't reach/, ""],
];
for (const [name, extra, says, fix] of cases) {
  await reset(extra);
  const p = await openPanel(SEARCH);
  const [text, err, btn] = await scanAndRead(p);
  await shot(p, `error_${name.replace(/\W+/g, "_")}`);
  ok(`${name}: says so plainly`, says.test(text) && err, text);
  const seen = await inView(p, ".view-page .statusrow");
  ok(`${name}: the message is in view, not scrolled away`, seen === true, seen);
  ok(`${name}: ${fix ? `offers ${fix}` : "no fix button (Scan again is the retry)"}`, btn === fix, btn || "none");
  ok(`${name}: Scan is still there to try again`, await R(p, `return !r.querySelector('[data-act=scan]').hidden`));
}

// ---- the budget used up ----
await reset(`{anthropicKey:'sk-ant-test', monthlyBudget:0.0001, usage:{days:{[new Date().toLocaleDateString('en-CA')]:{usd:0.01}}}}`); // usage is kept by local day
{
  const p = await openPanel(SEARCH);
  const [text, err, btn] = await scanAndRead(p);
  await shot(p, "error_budget");
  ok("the budget used up: says how much and what to do", /budget of \$0\.0001 is used up/.test(text) && err, text);
  ok("the budget used up: offers Open settings", btn === "Open settings", btn || "none");
  ok("the budget used up: the message is in view", await inView(p, ".view-page .statusrow"));
}

// ---- a scan under way, then Stop ----
await reset(`{anthropicKey:'slow'}`);
{
  const p = await openPanel(SEARCH);
  await R(p, `r.querySelector('[data-act=scan]').click()`);
  await sleep(1200);
  const busy = await R(p, `return [r.querySelector('.wrap').classList.contains('busy'), !r.querySelector('.stopbtn').hidden, !r.querySelector('.progress').hidden, r.querySelector('.view-page .status').textContent]`);
  await shot(p, "busy_scanning");
  ok("scanning: says what it's doing, with Stop and the progress line", busy[0] && busy[1] && busy[2] && busy[3].length > 0, busy);
  await R(p, `r.querySelector('.stopbtn').click()`);
  await sleep(1500);
  const after = await R(p, `return [r.querySelector('.wrap').classList.contains('busy'), r.querySelector('.stopbtn').hidden, r.querySelector('.view-page .status').textContent]`);
  await shot(p, "busy_stopped");
  ok("Stop: the work stops and the panel says so", !after[0] && after[1] && /stop/i.test(after[2]), after);
}

// ---- a page with nothing to scan ----
await reset(`{anthropicKey:'sk-ant-test'}`);
{
  const p = await openPanel("https://www.ebay.com/help/nothing-here");
  const s = await R(p, `return [r.querySelector('[data-view=home]').getAttribute('aria-selected'), r.querySelector('[data-act=scan]').hidden]`);
  await shot(p, "empty_other_page");
  ok("a page that isn't a search or a listing: opens on Home, with no Scan", s[0] === "true" && s[1], s);
  await R(p, `r.querySelector('[data-view=page]').click()`);
  await sleep(300);
  const note = await R(p, `const n=r.querySelector('.other-note'); return n.offsetHeight > 0 && /Open a search/.test(n.textContent)`);
  ok("…and This page says what to open", note);
}

// ---- empty Saved and Home ----
{
  const p = await openPanel(SEARCH);
  await R(p, `r.querySelector('[data-view=saved]').click()`);
  await sleep(400);
  const saved = await R(p, `return r.querySelector('.saved-body').textContent`);
  await shot(p, "empty_saved");
  ok("Saved, empty: says how things get there", /press Save/.test(saved), saved.slice(0, 80));
  await R(p, `r.querySelector('[data-view=home]').click()`);
  await sleep(700);
  const home = await R(p, `return r.querySelector('.view-home').textContent`);
  await shot(p, "empty_home");
  ok("Home, empty: says what will show up", /Nothing yet/.test(home), home.slice(0, 80));
}

// ---- Delete everything ----
await store(`{anthropicKey:'sk-ant-test', saved:{'ebay:1':{t:'x',u:'https://www.ebay.com/itm/1',p:1,p0:1,a:1,a0:1}}}`);
{
  const s = await open(`chrome-extension://${EXT}/options/options.html`);
  await sleep(600);
  await s.ev(`window.confirm = () => false; document.getElementById('wipeAll').click()`);
  await sleep(400);
  const kept = await s.ev(`chrome.storage.local.get(null).then(v=>Object.keys(v).length)`);
  ok("Delete everything: cancelling the question keeps everything", kept > 0, kept);
  await s.ev(`window.confirm = () => true; document.getElementById('wipeAll').click()`);
  await sleep(1200);
  const left = await o.ev(`chrome.storage.local.get(null).then(v=>Object.keys(v))`);
  ok("Delete everything: nothing is left, keys included", Array.isArray(left) && !left.length, left);
}

console.log(fails ? `${fails} FAILED` : "all passed");
c.close();
