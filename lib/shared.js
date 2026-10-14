// Tirekick: small pieces shared by the background worker, the on-page panel (and its Home tab) and the settings page.
// No page access and no network: pure functions over what's kept in this browser.

(() => {
  const S = (self.TKShared ||= {});

  // Addresses kept in storage (saved listings and searches, which a restored backup can also fill) only
  // become links, or get opened, when they point at a site this works on (lib/sites.js). Anything else
  // ("javascript:", another host) gives the fallback.
  S.safeUrl = (u, fallback = "") => {
    try {
      const x = new URL(u);
      if (x.protocol === "https:" && TKSites.isSiteHost(x.hostname) && !x.port && !x.username && !x.password) return x.href;
    } catch {}
    return fallback;
  };

  // Where a saved listing or search leads. A stored address is checked first (a restored backup can hold
  // anything); a bad or missing one is rebuilt from the listing's key or the search words.
  S.itemUrl = (key) => TKSites.itemUrl(key);
  S.savedItemUrl = (key, r) => S.safeUrl(r?.u, S.itemUrl(key));
  S.searchUrl = (r) => S.safeUrl(r?.url, (TKSites.get(r?.site) || TKSites.get("ebay")).searchUrl(r?.q || ""));

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

  // A photo's fingerprint for spotting the same picture on other listings: a 64-bit difference hash of its
  // 9×8 grayscale pixels (72 brightness values, row by row). Each bit says whether a pixel is brighter than
  // the one to its right, so a resized or recompressed copy differs in a few bits at most. 16 hex digits,
  // or "" for a picture with almost no detail (a blank or placeholder), which would match every other one.
  S.dHash = (gray) => {
    if (!gray || gray.length < 72) return "";
    let hex = "";
    let ones = 0;
    for (let y = 0; y < 8; y++) {
      let byte = 0;
      for (let x = 0; x < 8; x++) {
        const bit = gray[y * 9 + x] > gray[y * 9 + x + 1] ? 1 : 0;
        byte = (byte << 1) | bit;
        ones += bit;
      }
      hex += byte.toString(16).padStart(2, "0");
    }
    return ones < 4 || ones > 60 ? "" : hex;
  };

  // Photos worth sending to a model come from the sites' own image hosts (lib/sites.js). A listing page can point an
  // image anywhere (even at a service on this computer), so nothing else is fetched on its say-so.
  S.isListingImage = (u) => {
    try {
      const x = new URL(u);
      return x.protocol === "https:" && !x.port && !x.username && !x.password && TKSites.isImageHost(x.hostname);
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

  // ---------- changes to what several tabs share ----------
  // Saved listings and searches, hidden listings, filters, scam codes, counters and the sold-price cache are
  // each one record in storage that any tab may change. A tab that read it, changed it and wrote it back
  // could undo another tab's change made in between, so tabs describe the change instead and the
  // background script applies them one at a time (storeEdit in background.js). An edit:
  //   set:    { key: value }   replace (null removes it)
  //   add:    { key: value }   only if there's nothing under that key yet
  //   patch:  { key: fields }  change some fields of an entry that's there (a removed entry stays removed)
  //   upsert: { key: fields }  the same, making the entry if needed; a field that is itself an object
  //                            is merged one level down too (a scam code's listings from two tabs)
  //   inc:    { key: n }       add to a counter
  //   cap:    { max, by, maxAge }  keep the newest max entries by their `by` field, none older than maxAge ms
  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  S.applyEdit = (stored, edit = {}, now = Date.now()) => {
    const out = isObj(stored) ? { ...stored } : {};
    for (const [k, v] of Object.entries(edit.set || {})) v == null ? delete out[k] : (out[k] = v);
    for (const [k, v] of Object.entries(edit.add || {})) if (!(k in out)) out[k] = v;
    for (const [k, v] of Object.entries(edit.patch || {})) if (isObj(out[k]) && isObj(v)) out[k] = { ...out[k], ...v };
    for (const [k, v] of Object.entries(edit.upsert || {})) {
      if (!isObj(v)) continue;
      const old = isObj(out[k]) ? out[k] : {};
      out[k] = { ...old, ...Object.fromEntries(Object.entries(v).map(([f, x]) => [f, isObj(x) && isObj(old[f]) ? { ...old[f], ...x } : x])) };
    }
    for (const [k, n] of Object.entries(edit.inc || {})) if (Number.isFinite(n)) out[k] = (Number.isFinite(out[k]) ? out[k] : 0) + n;
    if (!edit.cap) return out;
    const { max = Infinity, by = "a", maxAge = 0 } = edit.cap;
    const at = (r) => (isObj(r) && Number.isFinite(r[by]) ? r[by] : 0);
    let rows = Object.entries(out);
    if (maxAge > 0) rows = rows.filter(([, r]) => now - at(r) < maxAge);
    if (rows.length > max) rows = rows.sort((a, b) => at(a[1]) - at(b[1])).slice(-max);
    return Object.fromEntries(rows);
  };

  // A turn at an eBay sold-price lookup, across every tab: none while eBay's browser check is cooling off,
  // at most perHour an hour, and gap ms apart. The turn is booked when it's given (log gets its time,
  // which may be a little ahead), so two tabs asking at once get two different turns.
  // Returns { pausedUntil } | { full: true } | { wait, log }.
  S.soldSlot = ({ log = [], cooldownUntil = 0 } = {}, now = Date.now(), { perHour = 8, gap = 5000 } = {}) => {
    if (now < cooldownUntil) return { pausedUntil: cooldownUntil };
    const recent = (Array.isArray(log) ? log : []).filter((t) => Number.isFinite(t) && now - t < 60 * 60 * 1000);
    if (recent.length >= perHour) return { full: true };
    const at = Math.max(now, recent.length ? Math.max(...recent) + gap : now);
    return { wait: at - now, log: [...recent, at] };
  };

  // ---------- a backup file, cleaned before anything in it is kept ----------
  // A backup is a file anyone can edit (or that got damaged), and what it holds is read by every page the
  // panel opens on. Each record goes through the shape the panel expects: the fields it uses, of the type
  // it uses, at a sensible length; anything else is left out and counted. Links go through safeUrl and
  // photos through isListingImage, as everywhere else.
  // Returns { sets: { name: cleaned record }, dropped: entries left out, links: addresses replaced }.
  S.BACKUP_SETS = ["saved", "savedSearches", "quickFilters", "notInterested", "listingMemory", "codeStems", "usage", "stats", "modePrefs", "searchWants"];
  S.cleanBackup = (data) => {
    const num = (v, dflt = 0) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : dflt);
    const numOrNull = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
    const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
    const LISTING_KEY = new RegExp(`^(?:${(self.TKSites?.all || []).map((x) => x.key).join("|") || "ebay|fb"}):\\d{1,24}$`); // "ebay:123…", "fb:456…"
    const tally = { dropped: 0, links: 0 };
    // One record: keep the entries clean() returns something for.
    const each = (rec, keyOk, clean) => {
      const out = {};
      for (const [k, v] of Object.entries(isObj(rec) ? rec : {})) {
        const c = typeof k === "string" && k.length <= 400 && keyOk(k) && isObj(v) ? clean(v, k) : undefined;
        if (c === undefined) tally.dropped++;
        else out[k] = c;
      }
      return out;
    };
    const sets = {};
    const d = isObj(data) ? data : {};
    if (isObj(d.saved)) sets.saved = each(d.saved, (k) => LISTING_KEY.test(k), (r, k) => {
      const u = S.savedItemUrl(k, r);
      if (r.u && u !== r.u) tally.links++;
      return { t: str(r.t, 300), u, img: typeof r.img === "string" && S.isListingImage(r.img) ? r.img : "", p0: numOrNull(r.p0), a0: num(r.a0), p: numOrNull(r.p), a: num(r.a) };
    });
    if (isObj(d.savedSearches)) sets.savedSearches = each(d.savedSearches, () => true, (r) => {
      if (typeof r.q !== "string" || !r.q.trim()) return undefined;
      const site = self.TKSites?.get(r.site) ? r.site : "ebay";
      const url = S.searchUrl({ ...r, site });
      if (url !== r.url) tally.links++;
      return { site, q: r.q.slice(0, 300), url, a0: num(r.a0), v: num(r.v), n: num(r.n), fresh: num(r.fresh), deal: num(r.deal), deals: num(r.deals) };
    });
    if (isObj(d.quickFilters)) sets.quickFilters = each(d.quickFilters, () => true, (r) => ({
      words: str(r.words, 500), min: num(r.min), max: num(r.max), fresh: r.fresh === true, broken: ["hide", "only"].includes(r.broken) ? r.broken : r.projects === true ? "only" : "", deal: num(r.deal), a: num(r.a),
    }));
    if (isObj(d.notInterested)) sets.notInterested = each(d.notInterested, (k) => LISTING_KEY.test(k), (r) => ({ t: str(r.t, 300), a: num(r.a) }));
    if (isObj(d.listingMemory)) sets.listingMemory = each(d.listingMemory, (k) => LISTING_KEY.test(k), (r) => {
      if (!num(r.a)) return undefined;
      const h = Array.isArray(r.h) ? r.h.filter((x) => Array.isArray(x) && numOrNull(x[0]) != null && numOrNull(x[1]) != null).map((x) => [x[0], x[1]]).slice(-5) : [];
      return { p: numOrNull(r.p), pa: num(r.pa), f: num(r.f), a: r.a, ...(num(r.o) && { o: r.o }), ...(h.length && { h }) };
    });
    if (isObj(d.codeStems)) sets.codeStems = each(d.codeStems, () => true, (r) => {
      const c = Object.fromEntries(Object.entries(isObj(r.c) ? r.c : {}).filter(([code, key]) => /^[A-Z0-9]{4,8}$/.test(code) && typeof key === "string" && LISTING_KEY.test(key)));
      return Object.keys(c).length ? { c, a: num(r.a) } : undefined;
    });
    if (isObj(d.modePrefs)) sets.modePrefs = each(d.modePrefs, (k) => ["use", "project"].includes(k), (r) => ({
      ...(typeof r.sort === "string" && /^[a-z]{1,20}$/.test(r.sort) && { sort: r.sort }), ...(["show", "dim", "hide"].includes(r.skip) && { skip: r.skip }),
    }));
    if (isObj(d.searchWants)) {
      sets.searchWants = {};
      for (const [k, v] of Object.entries(d.searchWants)) {
        if (typeof v === "string" && v.length <= 300 && k.length <= 400) sets.searchWants[k] = v.trim();
        else tally.dropped++;
      }
    }
    // Spending per day: the budget adds these up, so a day that isn't plainly a day of spending is left out.
    if (isObj(d.usage)) {
      sets.usage = { days: {} };
      for (const [day, v] of Object.entries(isObj(d.usage.days) ? d.usage.days : {})) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !isObj(v) || !Number.isFinite(v.usd) || v.usd < 0 || !Number.isFinite(v.calls) || v.calls < 0) {
          tally.dropped++;
          continue;
        }
        const models = Object.fromEntries(Object.entries(isObj(v.models) ? v.models : {}).filter(([m, mv]) => m.length <= 80 && isObj(mv) && Number.isFinite(mv.usd) && mv.usd >= 0 && Number.isFinite(mv.calls) && mv.calls >= 0).map(([m, mv]) => [m, { usd: mv.usd, calls: mv.calls }]));
        sets.usage.days[day] = { usd: v.usd, calls: v.calls, models };
      }
    }
    if (isObj(d.stats)) sets.stats = Object.fromEntries(Object.entries(d.stats).filter(([k, n]) => k.length <= 40 && typeof n === "number" && Number.isFinite(n) && n >= 0));
    return { sets, ...tally };
  };

  // ---------- bringing older storage up to date ----------
  // What an update changes in storage, from everything stored (`all`). Older shapes are carried over, and
  // every shared record goes through cleanBackup's checks once, so something an older version (or an older
  // restore) left behind can't break the panel. Only what changes is written.
  // Returns { set, remove, changed: [what changed] }.
  S.STORAGE_VERSION = 1;
  // The same record whatever order its fields come in (storage hands them back sorted).
  const same = (v) => JSON.stringify(v, (_, x) => (isObj(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));
  S.upgradeStorage = (all = {}) => {
    const set = {};
    const remove = [];
    const changed = [];
    // 0.32: the always-hide and only-show lists became one line of filter words.
    if (all.filterWords === undefined && (all.hideWords !== undefined || all.needWords !== undefined)) {
      set.filterWords = S.filterFromLists(String(all.hideWords ?? ""), String(all.needWords ?? ""));
      changed.push("filter words");
    }
    if (all.hideWords !== undefined || all.needWords !== undefined) remove.push("hideWords", "needWords");
    // The old retro themes are gone.
    if (all.theme !== undefined && !["match", "dark", "light"].includes(all.theme)) remove.push("theme");
    // Fix and Flip are one mode now.
    if (all.lens === "fix" || all.lens === "flip") set.lens = "project";
    // Sold prices from before 0.35 were summed up differently and are never read again.
    if (isObj(all.soldCache) && Object.keys(all.soldCache).some((k) => !k.startsWith("v2:"))) {
      set.soldCache = Object.fromEntries(Object.entries(all.soldCache).filter(([k]) => k.startsWith("v2:")));
      changed.push("old sold prices");
    }
    const present = Object.fromEntries(S.BACKUP_SETS.filter((k) => all[k] !== undefined).map((k) => [k, all[k]]));
    const { sets } = S.cleanBackup(present);
    for (const k of Object.keys(present)) {
      if (!sets[k]) {
        remove.push(k); // not a record at all
        changed.push(k);
      } else if (same(sets[k]) !== same(present[k])) {
        set[k] = sets[k];
        changed.push(k);
      }
    }
    return { set, remove: [...new Set(remove)], changed };
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
  // Drawn as an SVG element (never markup from a string) in whatever colors the page sets as
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
      el("polyline", { points: pts.map((p, i) => `${x(p, i).toFixed(1)},${y(p).toFixed(1)}`).join(" "), fill: "none", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }, { stroke: "var(--muted, #5B6780)" })
    );
    const last = pts[pts.length - 1];
    svg.append(el("circle", { cx: x(last, pts.length - 1).toFixed(1), cy: y(last).toFixed(1), r: 4, "stroke-width": 2 }, { fill: "var(--accent, #B04E0E)", stroke: "var(--paper, #FFFFFF)" }));
    return svg;
  };

  // ---------- spreadsheet export ----------
  // CSV that every spreadsheet opens the same way: every field quoted, inner quotes doubled, CRLF lines, and a
  // byte-order mark so Excel reads UTF-8. Titles come from web pages, so a field that starts like a formula
  // (= + - @, tab, return) gets a leading ' and stays text.
  S.csvField = (v) => {
    let t = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t)) t = `'${t}`;
    return `"${t.replace(/"/g, '""')}"`;
  };
  S.toCsv = (rows, columns) => "\ufeff" + [columns.map((c) => S.csvField(c.label)), ...rows.map((r) => columns.map((c) => S.csvField(r[c.key])))].map((l) => l.join(",")).join("\r\n") + "\r\n";
  const ymd = (ts) => (ts ? new Date(ts).toISOString().slice(0, 10) : "");
  // Saved listings as spreadsheet rows, newest first, with the latest score kept for each (scans:
  // { key: { use|flip: snapshot } }, Buyer's first). Prices are what you've seen; nothing is looked up.
  S.SAVED_COLUMNS = [
    { key: "store", label: "Store" }, { key: "title", label: "Title" }, { key: "link", label: "Link" },
    { key: "p0", label: "Price when saved" }, { key: "p", label: "Price now" }, { key: "change", label: "Change" },
    { key: "saved", label: "Saved on" }, { key: "seen", label: "Last seen" },
    { key: "score", label: "Score" }, { key: "verdict", label: "Verdict" }, { key: "sold", label: "Sold median" },
    { key: "margin", label: "Margin (Reseller)" }, { key: "key", label: "Listing key" },
  ];
  S.savedRows = (saved = {}, scans = {}) =>
    Object.entries(saved || {})
      .filter(([, r]) => r && typeof r === "object")
      .sort((a, b) => (b[1].a0 || 0) - (a[1].a0 || 0))
      .map(([key, r]) => {
        const snaps = scans?.[key] || {};
        const use = snaps.use, flip = snaps.flip;
        const sc = use || flip || null;
        const num = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : "");
        return {
          store: TKSites.nameOf(key),
          title: r.t || "",
          link: S.savedItemUrl(key, r),
          p0: num(r.p0),
          p: num(r.p),
          change: Number.isFinite(r.p) && Number.isFinite(r.p0) ? num(r.p - r.p0) : "",
          saved: ymd(r.a0),
          seen: ymd(r.a),
          score: sc?.score ?? "",
          verdict: sc?.verdict ?? "",
          sold: num(sc?.refWorking),
          margin: num(flip?.margin),
          key,
        };
      });
})();
