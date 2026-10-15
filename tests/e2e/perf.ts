// How much the extension costs on a busy Marketplace page: 240 cards nested like Facebook's, scored, then ten
// seconds of scrolling (more cards load) while the page rewrites class names. Prints the main thread's time
// in script, style and layout, for the page with the extension and without it (the slim tab off).
//   tests/e2e/run.sh perf.ts
import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const o = await open(`chrome-extension://${EXT}/options/options.html`);
const URL_ = `https://www.facebook.com/marketplace/albuquerque/search?query=camera&bench=240${Deno.env.get("PERF_CHURN") === "0" ? "&churn=0" : ""}`;
const R = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);
const metrics = async (p: any) => Object.fromEntries((await c.send("Performance.getMetrics", {}, p.sessionId)).metrics.map((m: any) => [m.name, m.value]));

async function run(label: string, withExtension: boolean) {
  await o.ev(`chrome.storage.local.clear()`);
  await o.ev(`chrome.storage.local.set({anthropicKey:'sk-ant-test', anthropicUrl:'http://localhost:1234', useSoldComps:false, introDone:true, showTab:${withExtension}, autoMarks:${Deno.env.get("PERF_MARKS") !== "0"}})`);
  // PERF_MEMORY=n: a browser that has already seen n listings (the memory of seen listings is that big).
  const nMem = +(Deno.env.get("PERF_MEMORY") || 0);
  if (nMem) await o.ev(`(() => { const m = {}; const now = Date.now(); for (let i = 0; i < ${nMem}; i++) m["fb:" + (900000000 + i)] = { p: 20 + (i % 300), pa: now - i * 6e4, f: now - i * 6e4, a: now - i * 6e4 }; return chrome.storage.local.set({ listingMemory: m }); })()`);
  await sleep(1500); // the page scripts are registered (or not) for the next page load
  const p = await open(URL_);
  await c.send("Performance.enable", {}, p.sessionId);
  await sleep(2500);
  if (withExtension && Deno.env.get("PERF_SCAN") !== "0") {
    await R(p, `r.querySelector('[data-act=tab]').click()`);
    await sleep(500);
    await R(p, `r.querySelector('[data-act=scan]').click()`);
    for (let i = 0; i < 60 && (await R(p, `return r.querySelector('[data-act=scan]').disabled`)); i++) await sleep(250);
    await R(p, `r.querySelector('[data-act=toggle]').click()`); // tucked away, like browsing
    await sleep(1500);
  }
  // PERF_CSS: extra page CSS for an experiment (e.g. turning the filters off), applied before measuring.
  if (Deno.env.get("PERF_CSS") && withExtension) await p.ev(`document.head.append(Object.assign(document.createElement('style'), { textContent: ${JSON.stringify(Deno.env.get("PERF_CSS"))} }))`);
  if (Deno.env.get("PERF_JS") && withExtension) await p.ev(Deno.env.get("PERF_JS")!);
  const profile = Deno.env.get("PROFILE_OUT") && (withExtension || Deno.env.get("PROFILE_BASE"));
  if (profile) { await c.send("Profiler.enable", {}, p.sessionId); await c.send("Profiler.setSamplingInterval", { interval: 200 }, p.sessionId); await c.send("Profiler.start", {}, p.sessionId); }
  // TRACE_OUT: a timeline trace of the scrolling, totaled by event type (Paint, Layout, style, …) for the page's main thread.
  const tracing = Deno.env.get("TRACE_OUT") && withExtension;
  const traceEvents: any[] = [];
  if (tracing) {
    c.on((m: any) => m.method === "Tracing.dataCollected" && traceEvents.push(...m.params.value));
    await c.send("Tracing.start", { traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline"] } });
  }
  const before = await metrics(p);
  const t0 = Date.now();
  // A frame-gap monitor: the longest gap between animation frames is what feels like lag.
  await p.ev(`window.__gaps = []; (() => { let last = performance.now(); const f = (t) => { window.__gaps.push(t - last); last = t; if (window.__run) requestAnimationFrame(f); }; window.__run = true; requestAnimationFrame(f); })()`);
  while (Date.now() - t0 < 10000) {
    await p.ev(`scrollBy(0, 350)`);
    await sleep(200);
  }
  const gaps = await p.ev(`(window.__run = false, window.__gaps.slice().sort((a,b)=>b-a))`);
  const after = await metrics(p);
  if (tracing) {
    const done = new Promise((r) => c.on((m: any) => m.method === "Tracing.tracingComplete" && r(null)));
    await c.send("Tracing.end");
    await done;
    // the renderer main thread: the thread with the most RunTask time inside the page's process
    const complete = traceEvents.filter((e) => e.ph === "X" && e.dur);
    const byThread = new Map<string, number>();
    for (const e of complete) if (e.name === "RunTask") byThread.set(`${e.pid}:${e.tid}`, (byThread.get(`${e.pid}:${e.tid}`) || 0) + e.dur);
    const main = [...byThread].sort((a, b) => b[1] - a[1])[0]?.[0];
    const sums = new Map<string, number>();
    for (const e of complete) if (`${e.pid}:${e.tid}` === main && e.name !== "RunTask") sums.set(e.name, (sums.get(e.name) || 0) + e.dur);
    // each style recalculation: how many elements, and what was running when it happened
    const mainEv = complete.filter((e) => `${e.pid}:${e.tid}` === main).sort((a, b) => a.ts - b.ts);
    const recalcs = mainEv.filter((e) => e.name === "UpdateLayoutTree");
    const within = (e: any) => mainEv.filter((x) => x !== e && x.ts <= e.ts && x.ts + x.dur >= e.ts + e.dur && /TimerFire|FunctionCall|FireAnimationFrame|EventDispatch|ParseHTML|ScrollLayer|HitTest|Layerize|Paint/.test(x.name)).map((x) => x.name + (x.args?.data?.functionName ? `(${x.args.data.functionName})` : x.args?.data?.url ? `(${String(x.args.data.url).split("/").pop()}:${x.args.data.lineNumber})` : "")).join(" > ");
    const groups = new Map<string, { n: number; us: number; els: number }>();
    for (const e of recalcs) { const k = within(e) || "(top level: rendering a frame)"; const g = groups.get(k) || { n: 0, us: 0, els: 0 }; g.n++; g.us += e.dur; g.els += e.args?.elementCount || 0; groups.set(k, g); }
    // the longest tasks, and what took the time inside each
    const tasks = complete.filter((e) => `${e.pid}:${e.tid}` === main && e.name === "RunTask").sort((a, b) => b.dur - a.dur).slice(0, 6);
    for (const [i, t] of tasks.entries()) {
      const kids = mainEv.filter((x) => x.ts >= t.ts && x.ts + x.dur <= t.ts + t.dur && x !== t);
      const top = new Map<string, number>();
      for (const k of kids) if (/TimerFire|FunctionCall|UpdateLayoutTree|Layout|Paint|Layerize|Commit|PrePaint|ParseHTML|EvaluateScript|FireAnimationFrame|EventDispatch|MinorGC/.test(k.name)) {
        const n = k.name + (k.args?.data?.url ? `(${String(k.args.data.url).split("/").pop()?.slice(0, 30)}:${k.args.data.lineNumber})` : "");
        top.set(n, Math.max(top.get(n) || 0, k.dur));
      }
      sums.set(`=== long task ${i + 1}: ${Math.round(t.dur / 1000)} ms :: ` + [...top].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, us]) => `${n} ${Math.round(us / 1000)}`).join(", "), 1e9 - i);
    }
    sums.set("--- style recalcs by cause ---", 0);
    for (const [k, g] of [...groups].sort((a, b) => b[1].us - a[1].us).slice(0, 8)) sums.set(`${k}: ${g.n} recalcs, ${Math.round(g.els / g.n)} elements each`, g.us);
    await Deno.writeTextFile(Deno.env.get("TRACE_OUT")!, [...sums].sort((a, b) => b[1] - a[1]).slice(0, 34).map(([n, us]) => `${String(Math.round(us / 1000)).padStart(6)} ms  ${n}`).join("\n"));
  }
  if (profile) {
    // Self time per function, from the samples: where the main thread actually went.
    const { profile: pr } = await c.send("Profiler.stop", {}, p.sessionId);
    const byId = new Map(pr.nodes.map((n: any) => [n.id, n]));
    const self = new Map<number, number>();
    for (let i = 0; i < pr.samples.length; i++) self.set(pr.samples[i], (self.get(pr.samples[i]) || 0) + (pr.timeDeltas[i] || 0));
    const totals = new Map<string, number>();
    for (const [id, us] of self) {
      const f = (byId.get(id) as any).callFrame;
      const name = `${f.functionName || "(anonymous)"} ${f.url.split("/").slice(-1)[0]}:${f.lineNumber + 1}`;
      totals.set(name, (totals.get(name) || 0) + us);
    }
    // …and who calls the browser's own expensive ones
    const parent = new Map<number, any>();
    for (const n of pr.nodes) for (const ch of n.children || []) parent.set(ch, n);
    for (const [id, us] of self) {
      const f = (byId.get(id) as any).callFrame;
      if (!/getBoundingClientRect|querySelectorAll|getComputedStyle/.test(f.functionName)) continue;
      const up = parent.get(id)?.callFrame;
      const name = `  ${f.functionName} <- ${up?.functionName || "?"} ${up?.url.split("/").slice(-1)[0]}:${(up?.lineNumber ?? 0) + 1}`;
      totals.set(name, (totals.get(name) || 0) + us);
    }
    // inclusive time for our own functions: each one with everything it calls
    const incl = new Map<string, number>();
    const walk = (id: number, stack: Set<string>): number => {
      const n: any = byId.get(id);
      let t = self.get(id) || 0;
      for (const ch of n.children || []) t += walk(ch, stack);
      const f = n.callFrame;
      if (/panel\.js|adapters\.js|rules\.js|shared\.js|home\.js/.test(f.url) && f.functionName) {
        const name = `[incl] ${f.functionName} ${f.url.split("/").pop()}:${f.lineNumber + 1}`;
        incl.set(name, (incl.get(name) || 0) + t);
      }
      return t;
    };
    walk(pr.nodes[0].id, new Set());
    for (const [k, v] of incl) totals.set(k, v);
    const top = [...totals].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([n, us]) => `${String(Math.round(us / 1000)).padStart(6)} ms  ${n}`);
    await Deno.writeTextFile(Deno.env.get("PROFILE_OUT")!, top.join("\n"));
  }
  const d = (k: string) => Math.round((after[k] - before[k]) * 1000);
  const cards = await p.ev(`document.querySelectorAll('a[href*="/marketplace/item/"]').length`);
  const tags = await p.ev(`document.querySelectorAll('.tirekick-sticker, .tirekick-marks').length`);
  if (withExtension && Deno.env.get("PERF_GUARD")) {
    // A guard for the test run, generous for slower machines: the :has() freeze this caught was 60 seconds.
    const busy = d("TaskDuration");
    console.log(`${busy < 5000 && gaps[0] < 1000 ? "PASS" : "FAIL"} a long Marketplace feed scrolls without freezing (busy ${busy} ms of 10000, worst frame gap ${Math.round(gaps[0])} ms; limits 5000 and 1000)`);
  }
  console.log(`${label.padEnd(22)} script ${String(d("ScriptDuration")).padStart(5)} ms  style ${String(d("RecalcStyleDuration")).padStart(5)} ms  layout ${String(d("LayoutDuration")).padStart(5)} ms  busy ${String(d("TaskDuration")).padStart(5)} ms of 10000  worst frame gap ${Math.round(gaps[0])} ms, frames over 50 ms: ${gaps.filter((g: number) => g > 50).length}  (${cards} cards, ${tags} tagged)`);
  if (withExtension) {
    // Opening the panel on a long feed: the list is drawn then (it isn't while tucked away), so time the click.
    const openMs = await p.ev(`(() => { const r = document.getElementById('tirekick-host').shadowRoot; const t = performance.now(); r.querySelector('[data-act=tab]').click(); r.querySelector('.list').getBoundingClientRect(); return Math.round(performance.now() - t); })()`);
    const rows = await R(p, `return r.querySelectorAll('.list .row').length`);
    const sortMs = await p.ev(`(() => { const r = document.getElementById('tirekick-host').shadowRoot; const s = r.querySelector('.sort'); const t = performance.now(); s.value = 'price'; s.dispatchEvent(new Event('change')); r.querySelector('.list').getBoundingClientRect(); return Math.round(performance.now() - t); })()`);
    console.log(`${"".padEnd(22)} opening the panel: ${openMs} ms for ${rows} rows; re-sorting: ${sortMs} ms`);
  }
  await p.close();
}
if (!Deno.env.get("PERF_GUARD")) await run("page alone", false);
await run("with Tirekick", true);
c.close();
