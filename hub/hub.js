// Second Look's own page: useful from anywhere, not only on eBay and Marketplace.
// - Look something up: what it sells for on eBay (free: the sold-listings search, no AI), and a search
//   on eBay, on Marketplace, or both.
// - Saved: your saved listings and searches, each marked eBay or Marketplace, ready to open.
// - Home: the same alerts, numbers and spending as the panel's Home tab.
// Opened by the toolbar icon on any other site, by right-clicking selected text ("Look up … on eBay and
// Marketplace"), and by "Open Second Look home". hub.html?q=words starts with a lookup.
(() => {
  const SL = window.SecondLook;
  const S = window.SLShared;
  const $ = (sel) => document.querySelector(sel);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v != null && v !== false) el.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((k) => k != null && k !== false && el.append(k instanceof Node ? k : document.createTextNode(String(k))));
    return el;
  };
  const send = (type, payload) =>
    new Promise((resolve, reject) =>
      chrome.runtime.sendMessage({ type, payload }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        res?.ok ? resolve(res.data) : reject(new Error(res?.error || "Unknown error"));
      })
    );
  const money = (n) => `$${Math.round(n)}`;
  const siteName = (k) => (k.startsWith("fb:") || k === "facebook" ? "Marketplace" : "eBay");

  // the theme from settings, like the panel
  const applyTheme = (t) => (t === "dark" || t === "light" ? (document.documentElement.dataset.theme = t) : delete document.documentElement.dataset.theme);
  chrome.storage.local.get("theme").then(({ theme }) => applyTheme(theme));
  chrome.storage.onChanged.addListener((c) => c.theme && applyTheme(c.theme.newValue));

  // ---------- look something up ----------
  const qEl = $("#q");
  const answer = $("#answer");
  const goBtn = $("#go");
  const ebayUrl = (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`;
  const fbUrl = (q) => `https://www.facebook.com/marketplace/search?query=${encodeURIComponent(q)}`;
  const syncLinks = () => {
    const q = qEl.value.trim();
    $("#on-ebay").href = q ? ebayUrl(q) : "https://www.ebay.com/";
    $("#on-fb").href = q ? fbUrl(q) : "https://www.facebook.com/marketplace/";
  };
  qEl.addEventListener("input", syncLinks);
  $("#on-both").addEventListener("click", () => {
    const q = qEl.value.trim();
    if (!q) return qEl.focus();
    chrome.tabs.create({ url: ebayUrl(q), active: true });
    chrome.tabs.create({ url: fbUrl(q), active: false });
  });

  // The same lookups as the panel's, with the same pace and cache: through an eBay tab you have open if
  // there is one, otherwise from the background script.
  const soldMarket = SLSold.create({ fetchHtml: (query, condition) => send("fetchSoldHtml", { url: SL.soldUrl(query, SL.SOLD_CONDITION[condition]) }), send });
  const cell = (label, m) => h("div", { class: "mcell" }, h("span", {}, label), h("b", {}, `${m.confidence === "rough" ? "~" : ""}${money(m.median)}`), h("span", {}, `${money(m.p25)}–${money(m.p75)} · ${m.n} sales${m.confidence === "rough" ? " · a rough guide" : ""}`));
  const leftOut = (d) => (d ? [d.offers && `${d.offers} best-offer sales (their real price isn't shown)`, d.lots && `${d.lots} lots`, d.parts && `${d.parts} for parts`, d.unrelated && `${d.unrelated} without the model number`, d.outliers && `${d.outliers} far-off prices`].filter(Boolean) : []);
  const say = (text, err = false) => answer.replaceChildren(h("div", { class: err ? "status err" : "status", role: err ? "alert" : null }, text));
  const lookUp = async () => {
    const q = qEl.value.trim();
    if (!q) return qEl.focus();
    syncLinks();
    goBtn.disabled = true;
    say(`Looking up eBay sales of “${q}”…`);
    try {
      // Used ones first (what most people mean by "what it sells for"); any condition if there are too few.
      let market = await soldMarket(q, "used");
      let any = false;
      if (!market) {
        market = await soldMarket(q, "any");
        any = true;
      }
      chrome.storage.local.get("stats").then(({ stats = {} }) => chrome.storage.local.set({ stats: { ...stats, soldLookups: (stats.soldLookups || 0) + 1, since: stats.since || Date.now() } }));
      if (!market) return say(`Not enough eBay sales of “${q}” to give a price. Try fewer or more general words.`);
      answer.replaceChildren(
        h("div", { class: "mgrid" }, cell(any ? "Sold, any condition" : "Sold, used", market)),
        h(
          "details",
          { class: "comps" },
          h("summary", {}, "The sales closest to the middle"),
          h("ul", {}, market.samples.map((x) => h("li", {}, h("a", { href: x.url, target: "_blank", rel: "noopener" }, h("span", { class: "cp" }, money(x.total)), h("span", { class: "ct" }, x.title)))))
        ),
        // Honest about what the number is: matching words, not a verified identical item.
        h("p", { class: "hint caveat" }, `The middle of ${market.n} recent eBay sales whose titles match these words, with shipping where shown.${leftOut(market.dropped).length ? ` Left out: ${leftOut(market.dropped).join(", ")}.` : ""} Check a few: a kit or a bundle can still share the words. It's what sold, not what's listed.`)
      );
    } catch (e) {
      say(e.message, true);
    } finally {
      goBtn.disabled = false;
    }
  };
  $("#look-form").addEventListener("submit", (e) => {
    e.preventDefault();
    lookUp();
  });

  // ---------- saved: listings and searches, each marked with its site ----------
  const drawSaved = async () => {
    const { saved = {}, savedSearches = {} } = await chrome.storage.local.get(["saved", "savedSearches"]);
    const items = Object.entries(saved).sort((a, b) => (b[1].a0 || 0) - (a[1].a0 || 0));
    const searches = Object.entries(savedSearches).sort((a, b) => (b[1].v || 0) - (a[1].v || 0));
    const body = $("#saved-body");
    if (!items.length && !searches.length) {
      return body.replaceChildren(h("p", { class: "empty" }, "Nothing saved yet. On eBay or Marketplace, point at a listing's tag and press Save, or save a search from the panel."));
    }
    const listRows = items.map(([k, r]) => {
      const cheaper = S.dropped(r);
      return h(
        "div",
        { class: "row" },
        h("span", { class: "tag" }, siteName(k)),
        h("div", { class: "t" }, h("a", { href: S.savedItemUrl(k, r), target: "_blank", rel: "noopener" }, r.t || S.savedItemUrl(k, r)), cheaper ? h("small", {}, `↓ ${money(r.p0 - r.p)} since you saved it`) : null),
        r.p != null ? h("div", { class: "pr" }, money(r.p)) : null
      );
    });
    const searchRows = searches.map(([, r]) =>
      h(
        "div",
        { class: "row" },
        h("span", { class: "tag" }, siteName(r.site || "")),
        h("div", { class: "t" }, h("a", { href: S.searchUrl(r), target: "_blank", rel: "noopener" }, `“${r.q}”`), r.deal ? h("small", {}, `${r.deals || "none"} at your $${r.deal} last time`) : null)
      )
    );
    const openAll = (rows) => () => rows.forEach(([, r], i) => chrome.tabs.create({ url: S.searchUrl(r), active: i === 0 }));
    body.replaceChildren(
      ...(items.length ? [h("h3", { class: "hint" }, `Listings · ${items.length}`), h("div", { class: "rows" }, listRows)] : []),
      ...(searches.length
        ? [
            h("h3", { class: "hint" }, `Searches · ${searches.length}`),
            h("div", { class: "rows" }, searchRows),
            searches.length > 1 ? h("div", { class: "acts" }, h("button", { type: "button", onclick: openAll(searches) }, `Open all ${searches.length} searches`)) : null,
          ]
        : [])
    );
  };
  drawSaved();
  chrome.storage.onChanged.addListener((c) => (c.saved || c.savedSearches) && drawSaved());

  // ---------- Home, as in the panel ----------
  $("#home-css").textContent = SLHome.CSS;
  let mode = "buyer";
  chrome.storage.local.get("lens").then(({ lens }) => (mode = lens === "project" ? "reseller" : "buyer"));
  const home = SLHome.mount($("#home"), {
    send,
    go: () => $("#saved").scrollIntoView({ behavior: "smooth", block: "start" }),
    showSpend: () => chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html#sec-spending") }),
    getMode: () => mode,
    isShown: () => document.visibilityState === "visible",
    onAlerts: () => {},
  });
  home.refresh().then(home.seen).catch(() => {});
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && home.wake().catch(() => {}));

  // ---------- started with words (right-click "Look up …", or a link) ----------
  const start = new URLSearchParams(location.search).get("q");
  if (start) {
    qEl.value = start.slice(0, 200);
    syncLinks();
    lookUp();
  } else qEl.focus();
})();
