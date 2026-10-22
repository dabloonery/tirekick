// Not a test: what a long session costs. A Marketplace feed with a photo on every card, scrolled for a minute
// (about 1,500 cards load), then left open and idle for a minute. Prints, per ten seconds of scrolling, the main
// thread's busy time and how many cards are on the page; the messages the page sent the background worker, by
// type, scrolling and idle; and what each stored record weighs at the end. PERF_FULL=1 starts from a browser
// whose memory of seen listings, kept scores and photo fingerprints are already at their caps; PERF_ALONE=1 measures
// the page without the extension (its tab off).
//   tests/e2e/run.sh perf-long.ts
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const o = await open(`chrome-extension://${EXT}/options/options.html`);
const SCROLL_S = +(Deno.env.get("PERF_SECONDS") || 60);
const metrics = async (p: any) => Object.fromEntries((await c.send("Performance.getMetrics", {}, p.sessionId)).metrics.map((m: any) => [m.name, m.value]));

await o.ev(`chrome.storage.local.clear()`);
await o.ev(`chrome.storage.local.set({anthropicKey:'sk-ant-test', anthropicUrl:'http://localhost:1234', useSoldComps:false, introDone:true, showTab:${!Deno.env.get("PERF_ALONE")}})`);
if (Deno.env.get("PERF_FULL")) {
  await o.ev(`(() => {
    const now = Date.now(), mem = {}, scans = {}, photos = {};
    for (let i = 0; i < 6000; i++) mem["fb:" + (900000000 + i)] = { p: 20 + (i % 300), pa: now - i * 6e4, f: now - i * 6e4, a: now - i * 6e4 };
    for (let i = 0; i < 3000; i++) scans["fb:" + (800000000 + i)] = { buyer: { kind: "scan", at: now - i * 6e4, m: "claude-haiku-4-5", p: 50, t: "Nintendo Game Boy Advance SP with charger and two games", lens: "buyer", score: 60, verdict: "good", related: true, flags: [], reason: "A fair price for a working one with games; check the screen for scratches." } };
    for (let i = 0; i < 20000; i++) photos["fb:" + (700000000 + i)] = { h: (0x1234567890abcdef + i).toString(16).padStart(16, "0"), f: "4567" + i + "_n.jpg", t: "nintendo game boy advance sp with charger", a: now - i * 3e5 };
    return chrome.storage.local.set({ listingMemory: mem, scans, photoSeen: photos });
  })()`);
}
// The worker: count each message the pages send it, and time each storage write it makes.
const sw = async () => {
  for (let i = 0; i < 20; i++) {
    const { targetInfos } = await c.send("Target.getTargets");
    const t = targetInfos.find((t: any) => t.type === "service_worker" && t.url.includes(EXT));
    if (t) {
      const { sessionId } = await c.send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
      return async (expression: string) => (await c.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId)).result.value;
    }
    await sleep(250);
  }
  throw new Error("no service worker");
};
const w = await sw();
await w(`self.__msgs = {}; self.__writes = { n: 0, ms: 0, bytes: 0 };
chrome.runtime.onMessage.addListener((m) => { const k = m?.type === "storeEdit" ? "storeEdit:" + m.payload?.name : m?.type; __msgs[k] = (__msgs[k] || 0) + 1; });
const set0 = chrome.storage.local.set.bind(chrome.storage.local);
chrome.storage.local.set = async (v) => { const t = performance.now(); await set0(v); __writes.n++; __writes.ms += performance.now() - t; __writes.bytes += JSON.stringify(v).length; };
true`);
// …and in the page's own storage writes (the memory of seen listings and kept scores are written by the tab).
await sleep(1500);
const p = await open(`https://www.facebook.com/marketplace/albuquerque/search?query=camera&bench=240&img=1`);
await c.send("Performance.enable", {}, p.sessionId);
await sleep(3000);
const take = async () => w(`(() => { const m = __msgs, s = __writes; self.__msgs = {}; self.__writes = { n: 0, ms: 0, bytes: 0 }; return { m, s }; })()`);
await take();
// PROFILE_OUT=file: where the idle minute's main-thread time went (self and inclusive time per function);
// with PROFILE_SCROLL=1, the scrolling's instead.
const prof = Deno.env.get("PROFILE_OUT");
const PROFILE_SCROLL = !!Deno.env.get("PROFILE_SCROLL");
const startProfile = async () => { await c.send("Profiler.enable", {}, p.sessionId); await c.send("Profiler.setSamplingInterval", { interval: 500 }, p.sessionId); await c.send("Profiler.start", {}, p.sessionId); };
async function dumpProfile(file: string) {
  const { profile: pr } = await c.send("Profiler.stop", {}, p.sessionId);
  const byId = new Map(pr.nodes.map((n: any) => [n.id, n]));
  const self = new Map<number, number>();
  for (let i = 0; i < pr.samples.length; i++) self.set(pr.samples[i], (self.get(pr.samples[i]) || 0) + (pr.timeDeltas[i] || 0));
  const totals = new Map<string, number>();
  const name = (f: any) => `${f.functionName || "(anonymous)"} ${f.url.split("/").pop()}:${f.lineNumber + 1}`;
  for (const [id, us] of self) totals.set(name((byId.get(id) as any).callFrame), (totals.get(name((byId.get(id) as any).callFrame)) || 0) + us);
  const walk = (id: number): number => {
    const n: any = byId.get(id);
    let t = self.get(id) || 0;
    for (const ch of n.children || []) t += walk(ch);
    if (/\.js$/.test(n.callFrame.url) && n.callFrame.functionName) totals.set("[incl] " + name(n.callFrame), (totals.get("[incl] " + name(n.callFrame)) || 0) + t);
    return t;
  };
  walk(pr.nodes[0].id);
  await Deno.writeTextFile(file, [...totals].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([n, us]) => `${String(Math.round(us / 1000)).padStart(6)} ms  ${n}`).join("\n"));
}
if (prof && PROFILE_SCROLL) await startProfile();
let last = await metrics(p);
const t0 = Date.now();
let mark = t0;
console.log(`scrolling for ${SCROLL_S} s${Deno.env.get("PERF_FULL") ? ", storage full" : ""}:`);
while (Date.now() - t0 < SCROLL_S * 1000) {
  await p.ev(`scrollBy(0, 350)`);
  await sleep(200);
  if (Date.now() - mark >= 10000) {
    mark = Date.now();
    const now = await metrics(p);
    const cards = await p.ev(`document.querySelectorAll('a[href*="/marketplace/item/"]').length`);
    console.log(`  ${String(Math.round((mark - t0) / 1000)).padStart(3)} s  busy ${String(Math.round((now.TaskDuration - last.TaskDuration) * 1000)).padStart(5)} ms of 10000  script ${String(Math.round((now.ScriptDuration - last.ScriptDuration) * 1000)).padStart(5)} ms  ${cards} cards`);
    last = now;
  }
}
const scroll = await take();
if (prof && PROFILE_SCROLL) await dumpProfile(prof);
const fmt = ({ m, s }: any, secs: number) => `${Object.entries(m).sort((a: any, b: any) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}\n    ${Object.values(m).reduce((a: any, b: any) => a + b, 0)} messages in ${secs} s; worker storage writes: ${s.n}, ${Math.round(s.ms)} ms, ${(s.bytes / 1e6).toFixed(1)} MB written`;
console.log(`  messages while scrolling: ${fmt(scroll, SCROLL_S)}`);
if (prof && !PROFILE_SCROLL) await startProfile();
const idleStart = await metrics(p);
await sleep(60000);
const idleEnd = await metrics(p);
if (prof && !PROFILE_SCROLL) await dumpProfile(prof);
console.log(`left open, idle for 60 s: busy ${Math.round((idleEnd.TaskDuration - idleStart.TaskDuration) * 1000)} ms\n  messages: ${fmt(await take(), 60)}`);
const sizes = await o.ev(`(async () => { const all = await chrome.storage.local.get(null); const out = {}; for (const [k, v] of Object.entries(all)) out[k] = [JSON.stringify(v).length, v && typeof v === "object" ? Object.keys(v).length : 0]; return out; })()`);
const total = Object.values(sizes).reduce((a: number, [b]: any) => a + b, 0);
console.log(`storage: ${(total / 1e6).toFixed(2)} MB in all; ` + Object.entries(sizes).sort((a: any, b: any) => b[1][0] - a[1][0]).slice(0, 8).map(([k, [b, n]]: any) => `${k} ${(b / 1e3).toFixed(0)} kB (${n})`).join(", "));
await p.close();
c.close();
