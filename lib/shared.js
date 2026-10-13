// Second Look: small pieces shared by the background worker, the on-page panel (and its Home tab) and the settings page.
// No page access and no network: pure functions over what's kept in this browser.

(() => {
  const S = (self.SLShared ||= {});

  // Addresses kept in storage (saved listings and searches, which a restored backup can also fill) only
  // become links, or get opened, when they point at the two sites this works on. Anything else
  // ("javascript:", another host) gives the fallback.
  S.safeUrl = (u, fallback = "") => {
    try {
      const x = new URL(u);
      if (x.protocol === "https:" && (x.hostname === "www.ebay.com" || x.hostname === "www.facebook.com") && !x.port && !x.username && !x.password) return x.href;
    } catch {}
    return fallback;
  };

  // Where a saved listing or search leads. A stored address is checked first (a restored backup can hold
  // anything); a bad or missing one is rebuilt from the listing's key or the search words.
  S.itemUrl = (key) => (key.startsWith("fb:") ? `https://www.facebook.com/marketplace/item/${key.slice(3)}/` : `https://www.ebay.com/itm/${key.slice(5)}`);
  S.savedItemUrl = (key, r) => S.safeUrl(r?.u, S.itemUrl(key));
  S.searchUrl = (r) => {
    const q = encodeURIComponent(r?.q || "");
    return S.safeUrl(r?.url, r?.site === "facebook" ? `https://www.facebook.com/marketplace/search?query=${q}` : `https://www.ebay.com/sch/i.html?_nkw=${q}`);
  };

  // What the paid AI has cost (estimated, per day and model): today, this month and last month, and the
  // calls and models behind this month. `usage` is { days: { "2026-10-08": { usd, calls, models } } }.
  S.usageSummary = (usage, now = new Date()) => {
    const day = now.toLocaleDateString("en-CA");
    const month = day.slice(0, 7);
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 15).toLocaleDateString("en-CA").slice(0, 7);
    const sum = { today: 0, month: 0, last: 0, calls: 0, models: {} };
    for (const [d, v] of Object.entries(usage?.days || {})) {
      if (d === day) sum.today += v.usd;
      if (d.startsWith(last)) sum.last += v.usd;
      if (!d.startsWith(month)) continue;
      sum.month += v.usd;
      sum.calls += v.calls;
      for (const [m, mv] of Object.entries(v.models || {})) {
        const t = (sum.models[m] ||= { usd: 0, calls: 0 });
        t.usd += mv.usd;
        t.calls += mv.calls;
      }
    }
    return sum;
  };

  // Photos worth sending to a model come from the two sites' own image hosts. A listing page can point an
  // image anywhere (even at a service on this computer), so nothing else is fetched on its say-so.
  S.isListingImage = (u) => {
    try {
      const x = new URL(u);
      return x.protocol === "https:" && !x.port && !x.username && !x.password && /(^|\.)(ebayimg\.com|ebaystatic\.com|ebay\.com|fbcdn\.net|facebook\.com)$/.test(x.hostname);
    } catch {
      return false;
    }
  };

  // Settings: what each one may hold. The settings page limits what you type with these, and a restored
  // backup (a file that can say anything) goes through the same limits: a value that doesn't fit is
  // left out instead of stored.
  const LIMITS = { // [lowest, highest, whole numbers only, value when it's not a number]
    feePct: [0, 50, false, 0], monthlyBudget: [0, 100000, false, 0], minSellerPct: [0, 100, false, 0], minSellerRatings: [0, 100000, true, 0],
    oaiPriceIn: [0, 1000, false, 0], oaiPriceOut: [0, 1000, false, 0], batchSize: [1, 30, true, 10],
  };
  const CHOICES = {
    provider: ["anthropic", "openai", "ollama"],
    oaiPreset: ["openrouter", "openai", "gemini", "deepseek", "mistral", "xai", "lmstudio", "custom"],
    theme: ["match", "dark", "light"],
  };
  const FLAGS = ["useSoldComps", "autoMarks", "showTab", "autoScan"];
  const LONG = { interests: 4000, filterWords: 2000 };
  S.clampSetting = (f, n) => {
    const [lo, hi, whole, other] = LIMITS[f];
    return Math.min(hi, Math.max(lo, (whole ? Math.round(n) : n) || other));
  };
  S.isNumberSetting = (f) => f in LIMITS;
  S.cleanSetting = (f, raw) => {
    if (FLAGS.includes(f)) return typeof raw === "boolean" ? raw : undefined;
    if (f in LIMITS) return typeof raw === "number" && Number.isFinite(raw) ? S.clampSetting(f, raw) : undefined;
    if (f in CHOICES) return CHOICES[f].includes(raw) ? raw : undefined;
    if (typeof raw !== "string") return undefined;
    const v = raw.trim();
    if (f === "ollamaUrl" || f === "oaiUrl") {
      try {
        const u = new URL(v);
        return /^https?:$/.test(u.protocol) && !u.username && !u.password ? v.replace(/\/+$/, "") : undefined;
      } catch {
        return undefined;
      }
    }
    return v.slice(0, LONG[f] || 300);
  };

  // The old "always hide" and "only show" lists (comma-separated) as one line in the filter bar's words:
  // each hide word becomes -word, each required word stays plain, and a phrase gets its quotes.
  S.filterFromLists = (hide = "", need = "") => {
    const words = (list, not) =>
      list.split(/[,\n]/).map((w) => w.trim()).filter(Boolean).map((w) => `${not ? "-" : ""}${/\s/.test(w) ? `"${w}"` : w}`);
    return [...words(hide, true), ...words(need, false)].join(" ");
  };

  // A saved listing now costs less than when it was saved (by at least 3%, or a dollar).
  S.dropped = (r) => r?.p != null && r?.p0 != null && r.p < r.p0 - Math.max(1, r.p0 * 0.03);

  // What's worth another look: saved listings that got cheaper, and saved searches that had listings at
  // your price when you last looked. Nothing here checks anything: it only reads what the panel
  // recorded the last time you had those listings on screen. `ack` holds what you've already seen
  // (the price, or the count), so an alert is new until you look at Home.
  S.alerts = (saved = {}, searches = {}, ack = {}) => {
    const out = [];
    for (const [key, r] of Object.entries(saved)) {
      if (!S.dropped(r)) continue;
      const id = `l:${key}`;
      out.push({ id, kind: "drop", key, title: r.t || "", from: r.p0, now: r.p, when: r.a, value: r.p, isNew: ack[id] !== r.p });
    }
    for (const [key, r] of Object.entries(searches)) {
      if (!(r?.deals > 0)) continue;
      const id = `s:${key}`;
      out.push({ id, kind: "deal", key, title: r.q || "", deal: r.deal, n: r.deals, when: r.v, value: r.deals, isNew: ack[id] !== r.deals });
    }
    return out.sort((a, b) => b.isNew - a.isNew || (b.when || 0) - (a.when || 0));
  };

  // One sentence for the toolbar icon's tooltip.
  S.alertSummary = (alerts) => {
    const drops = alerts.filter((a) => a.kind === "drop").length;
    const deals = alerts.filter((a) => a.kind === "deal").length;
    const bits = [drops && `${drops} saved listing${drops === 1 ? "" : "s"} got cheaper`, deals && `${deals} saved search${deals === 1 ? "" : "es"} had listings at your price`].filter(Boolean);
    return bits.join("; ");
  };

  // A small line of prices over time, with the latest one marked. points: [{ v: price, t: time }].
  // Drawn as an SVG element (never markup from a string) in whatever colours the page sets as
  // --ink, --muted, --accent and --paper. Returns null with fewer than two points.
  const SVGNS = "http://www.w3.org/2000/svg";
  S.spark = (points, { w = 132, h = 30, label = "" } = {}) => {
    const pts = (points || []).filter((p) => p && Number.isFinite(p.v));
    if (pts.length < 2) return null;
    const pad = 6; // room for the end dot and its ring
    const vs = pts.map((p) => p.v);
    const lo = Math.min(...vs);
    const hi = Math.max(...vs);
    const ts = pts.map((p) => p.t);
    const byTime = ts.every(Number.isFinite) && Math.max(...ts) > Math.min(...ts);
    const x = (p, i) => pad + ((w - 2 * pad) * (byTime ? (p.t - Math.min(...ts)) / (Math.max(...ts) - Math.min(...ts)) : i / (pts.length - 1)));
    const y = (p) => (hi === lo ? h / 2 : pad + (h - 2 * pad) * (1 - (p.v - lo) / (hi - lo)));
    const el = (name, attrs, css) => {
      const n = document.createElementNS(SVGNS, name);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      for (const [k, v] of Object.entries(css || {})) n.style.setProperty(k, v);
      return n;
    };
    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: "img", "aria-label": label || `Price from ${vs[0]} to ${vs[vs.length - 1]}` });
    svg.style.display = "block";
    svg.append(
      el("polyline", { points: pts.map((p, i) => `${x(p, i).toFixed(1)},${y(p).toFixed(1)}`).join(" "), fill: "none", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }, { stroke: "var(--muted, #6B675F)" })
    );
    const last = pts[pts.length - 1];
    svg.append(el("circle", { cx: x(last, pts.length - 1).toFixed(1), cy: y(last).toFixed(1), r: 4, "stroke-width": 2 }, { fill: "var(--accent, #C8461F)", stroke: "var(--paper, #FBFAF7)" }));
    return svg;
  };
})();
