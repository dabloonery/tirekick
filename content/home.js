// Tirekick: the Home tab in the panel. What's been kept in this browser (alerts on saved things,
// a few numbers, paid AI spending when there is any), plus a short checklist for a first visit.
// It reads storage and draws; nothing is sent anywhere. Everything from storage goes in through
// textContent (titles come from web pages and from restored backups).
//
//   const home = TKHome.mount(box, { send, getMode, isShown, onAlerts });
//   home.refresh()  draws it again from storage
//   home.seen()     marks the alerts as seen, when Home is what's on screen (isShown())

(() => {
  const TKShared = window.TKShared;
  if (!TKShared || window.TKHome) return;
  const { itemUrl, searchUrl, dropped, alerts: alertsOf } = TKShared;

  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    if (tag === "input" || tag === "textarea") el.autocomplete = "off"; // no browser box of past entries over ours
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v != null && v !== false) el.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((k) => k != null && k !== false && el.append(k instanceof Node ? k : document.createTextNode(String(k))));
    return el;
  };

  const money = (n) => (n == null ? "" : `$${Number.isInteger(n) || Math.abs(n) >= 100 ? Math.round(n) : n.toFixed(2)}`);
  const spendMoney = (n) => (n > 0 && n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`);
  // An axis label keeps the digits the value needs: half of $0.05 is $0.025, not "$0.03".
  const tickMoney = (n) => `$${n >= 1 ? +n.toFixed(2) : +n.toFixed(3)}`;
  const dayFmt = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const ago = (t) => {
    if (!t) return "never";
    const d = Math.floor((Date.now() - t) / 864e5);
    return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 30 ? `${d} days ago` : dayFmt(t);
  };
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const MODEL_NAMES = { "claude-opus-5-5": "Opus 5.5", "claude-sonnet-5-5": "Sonnet 5.5", "claude-haiku-5-5": "Haiku 5.5", "claude-haiku-4-5": "Haiku 4.5" };
  const modelName = (id) => MODEL_NAMES[id] || id;

  function mount(box, { send, go = () => {}, isShown = () => true, onAlerts = () => {} }) {
    let D = null; // the stored data last drawn
    let lastAlerts = [];
    const root = h("div", { class: "hm" });
    box.append(root);

    // ---------- chart tooltip: one, shared by the columns; the table view carries the same numbers ----------
    const tip = h("div", { class: "hm-tip", "aria-hidden": "true" });
    const showTip = (col, value, label) => {
      const chart = col.closest(".hm-chart");
      tip.replaceChildren(h("b", {}, value), label);
      const c = chart.getBoundingClientRect();
      const r = col.getBoundingClientRect();
      tip.style.left = `${Math.min(Math.max(r.left - c.left + r.width / 2, 50), c.width - 50)}px`;
      tip.style.top = `${r.top - c.top - 4}px`;
      chart.append(tip);
      tip.classList.add("show");
    };
    const hideTip = () => tip.classList.remove("show");

    // ---------- sections ----------
    const link = (href, text, extra = {}) => h("a", { href, target: "_blank", rel: "noopener", ...extra }, text);
    const itemHref = (k) => TKShared.savedItemUrl(k, D.saved[k]);

    function start(d) {
      const keyed = d.provider === "ollama" || (d.provider === "openai" && !!d.oaiModel) || (d.provider === "anthropic" && !!d.hasKey);
      const steps = [
        { done: Object.keys(d.listingMemory).length > 0, title: "Look at a search", text: `Search ${TKSites.all.map((s) => s.name).join(" or ")}. Tirekick marks likely scams and odd prices on the cards as they load.`, acts: TKSites.all.map((s) => link(s.home, s.name, { class: "hm-btn" })) },
        { done: (d.stats.scans || 0) + (d.stats.soldLookups || 0) > 0, title: "Check the typical price", text: "“Typical price” in the panel compares every listing with recent eBay sales. It's free." },
        { done: Object.keys(d.saved).length + Object.keys(d.savedSearches).length > 0, title: "Save a listing or a search", text: "Hover a card and press Save, or use Save search in the panel. Price drops show up here and as a number on the toolbar icon." },
        { done: keyed, title: "Add an AI, if you like", text: "Optional, and off until you turn it on. With any AI service you have a key for, or a free model on your own computer, Scan scores each listing and says why.", acts: [h("button", { class: "hm-btn", onclick: () => send("openOptions", { section: "model" }).catch(() => {}) }, "Open settings")] },
      ];
      const n = steps.filter((s) => s.done).length;
      const show = !d.startHidden && n < steps.length;
      if (!show) {
        return n === steps.length || !d.startHidden ? null : h("div", { class: "hm-foot" }, h("button", { class: "hm-btn", onclick: () => chrome.storage.local.set({ startHidden: false }) }, "Show getting started"));
      }
      return h("section", { class: "hm-sec" },
        h("h3", {}, "Getting started", h("span", { class: "hm-grow" }), h("span", { class: "hm-count" }, `${n} of ${steps.length}`), h("button", { class: "hm-btn small", onclick: () => chrome.storage.local.set({ startHidden: true }) }, "Hide")),
        h("div", { class: "hm-bar", "aria-hidden": "true" }, h("i", { style: `width:${(n / steps.length) * 100}%` })),
        h("ol", { class: "hm-steps" }, ...steps.map((s, i) =>
          h("li", { class: s.done ? "done" : "" }, h("span", { class: "num" }, s.done ? "✓" : String(i + 1)), h("div", {}, h("b", {}, s.title), s.done ? null : h("span", { class: "hm-hint" }, s.text), s.done || !s.acts ? null : h("div", { class: "acts" }, s.acts)))
        ))
      );
    }

    // A site whose pages Tirekick last couldn't read (it changed its layout), until a page of it reads fine
    // again. Kept for a week: after that it's old news either way.
    function health(d) {
      const bad = Object.entries(d.siteHealth || {}).filter(([, r]) => r?.bad > (r.ok || 0) && Date.now() - r.bad < 7 * 864e5 && typeof r.note === "string");
      if (!bad.length) return null;
      return h("section", { class: "hm-sec" }, h("h3", {}, "A site changed"),
        ...bad.map(([, r]) => h("p", { class: "hm-empty" }, `${r.note} Seen ${ago(r.bad)}. Updating Tirekick usually fixes this; if it doesn't, use Check this page in the panel on that page and send what it copies.`)));
    }

    // Once, after the update that split "Mark cards before you scan": it was off here, which also took the scam
    // marks off the cards while likely scams stayed grayed out, so the scam marks came back on.
    function marksBack(d) {
      if (!d.marksBack) return null;
      return h("section", { class: "hm-sec" }, h("h3", {}, "Scam marks are back on cards"),
        h("p", { class: "hm-empty" }, "You had turned off marks on cards. Scam warnings show on them again, so a grayed-out listing says why. Price words and the other marks stay off; settings has a switch for each."),
        h("div", { class: "acts" },
          h("button", { class: "hm-btn", onclick: () => chrome.storage.local.remove("marksBack") }, "Got it"),
          h("button", { class: "hm-btn", onclick: () => send("openOptions", { section: "filters" }).catch(() => {}) }, "Open settings")));
    }

    function alertsSection(list) {
      const rows = list.length
        ? list.map((a) =>
            a.kind === "drop"
              ? h("div", { class: `hm-alert${a.isNew ? " new" : ""}` }, h("span", { class: "hm-tag" }, a.isNew ? "New" : "Cheaper"), h("div", { class: "t" }, link(itemHref(a.key), D.saved[a.key]?.t || itemHref(a.key)), h("small", {}, h("span", { class: "down" }, `↓ ${money(a.from - a.now)}`), ` since you saved it: ${money(a.from)} → ${money(a.now)}`)))
              : h("div", { class: `hm-alert${a.isNew ? " new" : ""}` }, h("span", { class: "hm-tag" }, a.isNew ? "New" : "At your price"), h("div", { class: "t" }, link(searchUrl(D.savedSearches[a.key] || {}), `“${a.title}”`), h("small", {}, `${plural(a.n, "listing")} at your ${money(a.deal)} when you last looked, ${ago(a.when)}`)))
          )
        : [h("div", { class: "hm-empty", title: "Checked when those listings are on your screen, never in the background" }, "Nothing new. Saved listings that get cheaper, and saved searches with listings at your price, show up here.")];
      return h("section", { class: "hm-sec" }, h("h3", {}, "Worth another look"), h("div", { class: "hm-alerts" }, rows));
    }

    function numbers(d) {
      const savedRows = Object.values(d.saved);
      const cheaper = savedRows.filter(dropped);
      const off = cheaper.reduce((s, r) => s + (r.p0 - r.p), 0);
      const searches = Object.values(d.savedSearches);
      const atPrice = searches.reduce((s, r) => s + (r?.deals > 0 ? r.deals : 0), 0);
      const tiles = [
        ["Saved listings", savedRows.length],
        ["Price drops", cheaper.length ? money(off) : "$0", cheaper.length ? `across ${plural(cheaper.length, "saved listing")}` : "since you saved them"],
        ["Saved searches", searches.length],
        ["At your price", atPrice, "across your saved searches, last time you looked"],
      ];
      const nodes = tiles.map(([label, value, note]) => h("button", { class: "hm-tile", onclick: () => go("saved"), title: "Open Saved" }, h("span", {}, label), h("b", {}, String(value)), note ? h("small", {}, note) : null));
      return h("section", { class: "hm-sec" }, h("h3", {}, "At a glance"), h("div", { class: "hm-tiles" }, nodes));
    }

    function spend(d) {
      const days = [];
      for (let i = 29; i >= 0; i--) {
        const t = new Date(Date.now() - i * 864e5);
        const key = TKShared.localDay(t);
        days.push({ key, t: t.getTime(), usd: d.usage.days?.[key]?.usd || 0, calls: d.usage.days?.[key]?.calls || 0 });
      }
      const total = days.reduce((s, x) => s + x.usd, 0);
      const head = h("h3", {}, "Spent on paid AI, 30 days", h("span", { class: "hm-grow" }), total > 0 ? h("span", { class: "hm-count" }, spendMoney(total)) : null);
      if (!total) return null; // nothing to show; the footer and settings say what's free
      const max = Math.max(...days.map((x) => x.usd));
      const nice = (m) => { const p = 10 ** Math.floor(Math.log10(m)); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
      const top = nice(max);
      const peak = days.findIndex((x) => x.usd === max);
      const cols = days.map((x, i) => {
        // A column per day shows its numbers on hover; the keyboard and screen readers get them from Table view.
        const col = h("span", { class: `col${i === peak ? " peak" : ""}`, "aria-hidden": "true" }, h("i", { style: `height:${(x.usd / top) * 100}%` }));
        col.addEventListener("pointerenter", () => showTip(col, spendMoney(x.usd), `${dayFmt(x.t)}, ${plural(x.calls, "call")}`));
        col.addEventListener("pointerleave", hideTip);
        return col;
      });
      const grid = [0.5, 1].map((f) => h("div", { class: "grid", style: `bottom:${f * 100}%` }));
      const ticks = [0.5, 1].map((f) => h("span", { class: "ylab", style: `bottom:${f * 100}%`, "aria-hidden": "true" }, tickMoney(top * f)));
      const models = {};
      for (const [day, v] of Object.entries(d.usage.days || {})) if (days.some((x) => x.key === day)) for (const [id, mv] of Object.entries(v.models || {})) (models[id] ||= { usd: 0, calls: 0 }), (models[id].usd += mv.usd), (models[id].calls += mv.calls);
      return h("details", { class: "hm-sec hm-fold" },
        h("summary", {}, head),
        h("div", { class: "hm-chart" }, h("div", { class: "plot", role: "img", "aria-label": `Spend per day for the last 30 days: ${spendMoney(total)} in all, the most ${spendMoney(max)} on ${dayFmt(days[peak].t)}. Table view below lists each day.` }, ...grid, ...ticks, ...cols), h("div", { class: "xaxis", "aria-hidden": "true" }, h("span", {}, dayFmt(days[0].t)), h("span", {}, `Peak ${spendMoney(max)}, ${dayFmt(days[peak].t)}`), h("span", {}, "Today"))),
        h("details", { class: "hm-table" }, h("summary", {}, "Table view"), h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Day"), h("th", { class: "n" }, "Calls"), h("th", { class: "n" }, "Estimated cost"))), h("tbody", {}, ...days.filter((x) => x.usd > 0 || x.calls > 0).reverse().map((x) => h("tr", {}, h("td", {}, dayFmt(x.t)), h("td", { class: "n" }, String(x.calls)), h("td", { class: "n" }, spendMoney(x.usd))))))),
        h("p", { class: "hm-hint" }, Object.entries(models).sort((a, b) => b[1].usd - a[1].usd).map(([id, v]) => `${modelName(id)} ${spendMoney(v.usd)} (${plural(v.calls, "call")})`).join(" · "), " · estimated from token counts at list price, not your real balance.")
      );
    }

    function footer() {
      return h("div", { class: "hm-foot" }, h("span", {}, `Version ${chrome.runtime.getManifest().version}`), h("button", { class: "hm-btn small", onclick: () => send("openOptions").catch(() => {}) }, "Settings, backup and restore"));
    }

    // ---------- load and draw ----------
    let refresh = async function () {
      const d = await chrome.storage.local.get({
        provider: "anthropic", oaiModel: "",
        saved: {}, savedSearches: {}, listingMemory: {}, usage: { days: {} }, stats: {}, alertsAck: {}, startHidden: false, siteHealth: {}, marksBack: false, useAI: false,
      });
      // The API key stays in the background script; the page only learns whether there is one.
      d.hasKey = await send("getSettings").then((s) => !!s.hasKey).catch(() => false);
      D = d;
      const list = alertsOf(d.saved, d.savedSearches, d.alertsAck);
      lastAlerts = list;
      onAlerts(list.filter((a) => a.isNew).length);
      // What's new comes first: it's why you'd come back. Getting started follows while you're new to it;
      // the numbers lead to the lists behind them; paid AI spending, if any, folds away at the end.
      const first = list.length ? [alertsSection(list), start(d)] : [start(d), alertsSection(list)];
      root.replaceChildren(...[health(d), marksBack(d), ...first, numbers(d), spend(d), footer()].filter(Boolean));
      return list;
    }

    // Looking at Home is how you see the alerts, so it marks them seen (the toolbar number goes away).
    // Only while Home is what's on screen: a panel left open on another page doesn't count as looking.
    // What you were shown stays marked "New" until the next change.
    async function seen() {
      if (!isShown() || !lastAlerts.some((a) => a.isNew)) return;
      const alertsAck = Object.fromEntries(lastAlerts.map((a) => [a.id, a.value]));
      await chrome.storage.local.set({ alertsAck });
    }

    // The number on the Home tab, from the three small records it depends on (not the whole of storage).
    async function count() {
      const d = await chrome.storage.local.get({ saved: {}, savedSearches: {}, alertsAck: {} });
      onAlerts(alertsOf(d.saved, d.savedSearches, d.alertsAck).filter((a) => a.isNew).length);
    }

    // Stay current while it's on screen (a scan or a save in another tab changes these), without marking anything
    // new as seen. Out of sight it only keeps the tab's number current and is drawn again when it's next shown:
    // the listing memory changes every time a page loads more listings, and reading and drawing everything then
    // made long Marketplace feeds lag.
    let stale = true;
    let timer = 0;
    let countTimer = 0;
    chrome.storage.onChanged.addListener((c) => {
      if (!chrome.runtime?.id) return;
      if (c.saved || c.savedSearches || c.alertsAck) {
        clearTimeout(countTimer);
        countTimer = setTimeout(() => count().catch(() => {}), 300);
      }
      if (c.alertsAck && Object.keys(c).length === 1) return;
      if (!["saved", "savedSearches", "listingMemory", "usage", "stats", "startHidden", "provider", "anthropicKey", "oaiModel"].some((k) => c[k])) return;
      if (!isShown()) return void (stale = true);
      clearTimeout(timer);
      timer = setTimeout(() => refresh().then(seen).catch(() => {}), 400);
    });
    const drawn = refresh;
    refresh = async () => {
      stale = false;
      return drawn();
    };

    return {
      refresh: () => refresh(),
      seen,
      count,
      markStale: () => (stale = true),
      // Shown again: draw it if anything changed while it was out of sight, then count what's been seen.
      wake: () => (stale ? refresh() : Promise.resolve()).then(seen),
    };
  }

  // Home's look, in the panel's tokens (--paper, --ink, --display…): the panel and the hub page both use it.
  const CSS = `
    .hm { display:grid; gap:2px; }
    .hm-sec { padding:14px 0 8px; border-top:var(--bw) solid var(--rule); }
    .hm-sec:first-child { border-top:0; padding-top:10px; }
    .hm h3 { margin:0 0 10px; display:flex; align-items:baseline; gap:8px; color:var(--ink); font:600 17px/1.3 var(--display); letter-spacing:-.01em; }
    .hm h3 .hm-count, .hm h3 .hm-btn { font-family:var(--ui); letter-spacing:normal; }
    .hm .hm-grow { flex:1; }
    .hm .hm-count { font-size:13px; font-weight:400; font-variant-numeric:tabular-nums; }
    .hm .hm-hint { display:block; color:var(--muted); font-size:13px; }
    .hm p.hm-hint { margin:8px 0 0; }
    .hm .hm-empty { color:var(--muted); font-size:14px; padding:2px 0 8px; }
    .hm a { color:var(--ink); text-underline-offset:3px; text-decoration-color:var(--line); }
    .hm a:hover { text-decoration-color:currentColor; }
    .hm-btn { display:inline-block; min-height:24px; font:600 13px/1.2 var(--ui); padding:5px 10px; border:var(--bw) solid var(--line); border-radius:var(--r-sm); background:none; color:var(--ink); cursor:pointer; text-decoration:none; }
    .hm-btn:hover { border-color:var(--ink); }
    .hm-btn.primary { background:var(--btn); color:var(--on-btn); border-color:var(--btn); }
    .hm-btn.small { padding:4px 8px; }
    .hm-btn:focus-visible, .hm a:focus-visible, .hm .col:focus-visible, .hm summary:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    .hm-bar { height:3px; border-radius:2px; background:var(--rule); overflow:hidden; margin:0 0 10px; }
    .hm-bar i { display:block; height:100%; background:var(--v-great); }
    .hm-steps { list-style:none; margin:0 0 8px; padding:0; display:grid; gap:8px; }
    .hm-steps li { display:grid; grid-template-columns:22px 1fr; gap:10px; align-items:start; padding:10px 12px; border:var(--bw) solid var(--rule); border-radius:var(--r-sm); font-size:13px; }
    .hm-steps li:not(.done) { background:var(--raise); }
    .hm-steps .num { width:22px; height:22px; border-radius:50%; display:grid; place-items:center; font:600 13px/1 var(--ui); box-shadow:inset 0 0 0 1px var(--line); color:var(--muted); }
    .hm-steps li.done .num { background:var(--v-great); box-shadow:none; color:var(--on-v); }
    .hm-steps li.done b { color:var(--muted); font-weight:400; text-decoration:line-through; text-decoration-color:var(--line); }
    .hm-steps b { display:block; font-weight:600; }
    .hm-steps .acts { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
    .hm-alerts { display:grid; gap:8px; }
    .hm-alert { display:grid; grid-template-columns:auto 1fr; gap:10px; align-items:start; padding:9px 11px; border:var(--bw) solid var(--rule); border-radius:var(--r-sm); font-size:13px; }
    .hm-alert.new { border-color:var(--rule); background:var(--raise); }
    .hm-tag { font-size:13px; font-weight:600; padding:1px 8px; border-radius:999px; background:var(--paper-2); color:var(--muted); white-space:nowrap; }
    .hm-alert.new .hm-tag { background:var(--new-bg); color:var(--new-fg); }
    .hm-alert .t { min-width:0; overflow-wrap:anywhere; }
    .hm-alert .t a { font-weight:600; }
    .hm-alert .t small { display:block; color:var(--muted); font-size:13px; }
    .hm .down { color:var(--v-great); font-weight:600; }
    .hm-tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(128px, 1fr)); gap:14px 16px; }
    .hm-tile { padding:2px 0 0 12px; border-left:2px solid var(--rule); }
    /* a number you can act on is a button: it goes to the list behind it */
    button.hm-tile { all:unset; box-sizing:border-box; display:flex; flex-direction:column; justify-content:flex-start; padding:2px 0 0 12px; border-left:2px solid var(--rule); cursor:pointer; transition:border-color .15s; }
    button.hm-tile:hover { border-left-color:var(--ink); }
    button.hm-tile:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    /* the detail sections fold: a heading you can open */
    .hm-fold > summary { list-style:none; cursor:pointer; min-height:24px; }
    .hm-fold > summary::-webkit-details-marker { display:none; }
    .hm-fold > summary h3 { margin-bottom:0; }
    .hm-fold > summary h3::after { content:"+"; margin-left:auto; padding-left:10px; color:var(--muted); font:400 16px/1 var(--ui); }
    .hm-fold[open] > summary h3::after { content:"\\2212"; }
    .hm-fold[open] > summary { margin-bottom:10px; }
    .hm-fold > summary:focus-visible { outline:2px solid var(--ink); outline-offset:2px; }
    .hm-tile span { display:block; color:var(--muted); font-size:13px; }
    .hm-tile b { display:block; font:600 24px/1.2 var(--display); font-variant-numeric:lining-nums; letter-spacing:-.01em; }
    .hm-tile small { display:block; color:var(--muted); font-size:13px; line-height:1.35; }
    .hm-chart { position:relative; padding:20px 0 0 44px; }
    .hm .plot { position:relative; height:96px; display:flex; align-items:flex-end; gap:2px; border-bottom:var(--bw) solid var(--rule); }
    .hm .grid { position:absolute; left:0; right:0; height:0; border-top:var(--bw) solid var(--rule); pointer-events:none; }
    .hm .ylab { position:absolute; left:-44px; width:38px; text-align:right; font-size:13px; color:var(--muted); transform:translateY(-50%); font-variant-numeric:tabular-nums; }
    .hm .col { flex:1; min-width:0; height:100%; display:flex; align-items:flex-end; justify-content:center; background:none; border:0; padding:0; cursor:default; position:relative; }
    .hm .col i { display:block; width:100%; max-width:14px; border-radius:3px 3px 0 0; background:var(--muted); opacity:.45; transition:opacity .12s; }
    .hm .col.peak i, .hm .col:hover i, .hm .col:focus-visible i { opacity:1; background:var(--accent); }
    .hm .xaxis { display:flex; justify-content:space-between; gap:6px; font-size:13px; color:var(--muted); margin-top:5px; }
    .hm-tip { position:absolute; z-index:5; pointer-events:none; background:var(--ink); color:var(--on-ink); padding:5px 9px; border-radius:var(--r-sm); font-size:13px; opacity:0; transform:translate(-50%, -100%); transition:opacity .1s; white-space:nowrap; }
    .hm-tip b { font:600 15px/1.2 var(--display); display:block; }
    .hm-tip.show { opacity:1; }
    .hm-table { margin-top:10px; }
    .hm-table summary { cursor:pointer; color:var(--muted); font-size:13px; padding:3px 0; }
    .hm table { border-collapse:collapse; width:100%; font-size:13px; margin-top:6px; }
    .hm th, .hm td { text-align:left; padding:4px 6px; border-bottom:var(--bw) solid var(--rule); }
    .hm td.n, .hm th.n { text-align:right; font-variant-numeric:tabular-nums; }
    .hm-foot { margin-top:14px; padding-top:12px; border-top:var(--bw) solid var(--rule); color:var(--muted); font-size:13px; display:flex; gap:6px 14px; flex-wrap:wrap; align-items:center; }
    @media (prefers-reduced-motion: reduce) { .hm .col i, .hm-tip { transition:none; } }
`;

  window.TKHome = { mount, CSS };
})();
