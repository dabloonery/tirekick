// Tirekick's own page: useful from anywhere, not only on eBay and Marketplace.
// - Look something up: what it sells for on eBay (free: the sold-listings search, no AI), and a search
//   on eBay, on Marketplace, or both.
// - Saved: your saved listings and searches, each marked eBay or Marketplace, ready to open.
// - Home: the same alerts, numbers and spending as the panel's Home tab.
// The toolbar icon's popup on any other site (hub.html?popup: narrower, Settings in a tab), and a tab from
// right-clicking selected text ("Look up … on eBay and Marketplace") or the icon ("Open Tirekick in a tab").
// hub.html?q=words starts with a lookup.
(() => {
  const TK = window.Tirekick;
  const S = window.TKShared;
  const $ = (sel) => document.querySelector(sel);
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
  const send = (type, payload) =>
    new Promise((resolve, reject) =>
      chrome.runtime.sendMessage({ type, payload }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        res?.ok ? resolve(res.data) : reject(new Error(res?.error || "Unknown error"));
      })
    );
  const money = (n) => `$${Math.round(n)}`;
  const siteName = (k) => (TKSites.get(k) ? TKSites.get(k).name : TKSites.nameOf(k));

  // In the popup, Settings opens in its own tab rather than inside the popup.
  const isPopup = document.documentElement.classList.contains("popup");
  if (isPopup)
    $("#settings-link").addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
      window.close();
    });

  // the theme from settings, like the panel
  const applyTheme = (t) => (t === "dark" || t === "light" ? (document.documentElement.dataset.theme = t) : delete document.documentElement.dataset.theme);
  chrome.storage.local.get("theme").then(({ theme }) => applyTheme(theme));
  chrome.storage.onChanged.addListener((c) => c.theme && applyTheme(c.theme.newValue));

  // ---------- look something up ----------
  const qEl = $("#q");
  const answer = $("#answer");
  const goBtn = $("#go");
  // A search button per site (lib/sites.js), then one for all of them ("Both" while there are two).
  const sitesBox = $(".sites");
  sitesBox.replaceChildren(
    ...TKSites.all.map((s) => h("a", { class: "btn", id: `on-${s.key}`, target: "_blank", rel: "noopener", href: s.home }, `Search ${s.name} \u2197`)),
    h("button", { type: "button", id: "on-both" }, TKSites.all.length === 2 ? "Both" : "All")
  );
  const syncLinks = () => {
    const q = qEl.value.trim();
    for (const s of TKSites.all) $(`#on-${s.key}`).href = q ? s.searchUrl(q) : s.home;
  };
  qEl.addEventListener("input", syncLinks);
  $("#on-both").addEventListener("click", () => {
    const q = qEl.value.trim();
    if (!q) return qEl.focus();
    TKSites.all.forEach((s, i) => chrome.tabs.create({ url: s.searchUrl(q), active: i === 0 }));
  });

  // The same lookups as the panel's, with the same pace and cache: through an eBay tab you have open if
  // there is one, otherwise from the background script.
  const soldMarket = TKSold.create({ fetchHtml: (query, condition) => send("fetchSoldHtml", { url: TK.soldUrl(query, TK.SOLD_CONDITION[condition]) }), send });
  const cell = (label, m) => h("div", { class: "mcell" }, h("span", {}, label), h("b", {}, `${m.confidence === "rough" ? "~" : ""}${money(m.median)}`), h("span", {}, `${money(m.p25)}–${money(m.p75)} · ${m.n} sales${m.confidence === "rough" ? " · a rough guide" : ""}`));
  const leftOut = TK.leftOutSold;
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
      send("storeEdit", { name: "stats", edit: { inc: { soldLookups: 1 }, add: { since: Date.now() } } }).catch(() => {});
      if (!market) return say(`Not enough eBay sales of “${q}” to give a price. Try fewer or more general words.`);
      answer.replaceChildren(
        h("div", { class: "mgrid" }, cell(any ? "Typical price, any condition" : "Typical price, used", market)),
        h(
          "details",
          { class: "comps" },
          h("summary", {}, "The sales closest to the middle"),
          h("ul", {}, market.samples.map((x) => h("li", {}, h("a", { href: S.safeUrl(x.url, "#"), target: "_blank", rel: "noopener" }, h("span", { class: "cp" }, money(x.total)), h("span", { class: "ct" }, x.title)))))
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
      return body.replaceChildren(h("p", { class: "empty" }, `Nothing saved yet. On ${TKSites.all.map((s) => s.name).join(" or ")}, point at a listing's tag and press Save, or save a search from the panel.`));
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
          ].filter(Boolean) // replaceChildren would print a null as the word "null"
        : [])
    );
  };
  drawSaved();
  chrome.storage.onChanged.addListener((c) => (c.saved || c.savedSearches) && drawSaved());

  // ---------- Home, as in the panel ----------
  $("#home-css").textContent = TKHome.CSS;
  let mode = "buyer";
  chrome.storage.local.get("lens").then(({ lens }) => (mode = lens === "project" ? "reseller" : "buyer"));
  const home = TKHome.mount($("#home"), {
    send,
    go: () => $("#saved").scrollIntoView({ behavior: "smooth", block: "start" }),
    showSpend: () => chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html#sec-spending") }),
    getMode: () => mode,
    isShown: () => document.visibilityState === "visible",
    onAlerts: () => {},
  });
  home.refresh().then(home.seen).catch(() => {});
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && home.wake().catch(() => {}));

  // Not affiliated with any of the sites (named from lib/sites.js)
  const owners = [...new Set(TKSites.all.map((s) => s.owner))];
  $("#not-affiliated").textContent = `Not affiliated with or endorsed by ${owners.join(" or ")}. ${owners.join(" and ")} are trademarks of their owners.`;

  // ---------- started with words (right-click "Look up …", or a link) ----------
  const start = new URLSearchParams(location.search).get("q");
  if (start) {
    qEl.value = start.slice(0, 200);
    syncLinks();
    lookUp();
  } else qEl.focus();
})();
