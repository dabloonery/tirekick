// Tirekick's own page: useful from anywhere, not only on eBay and Marketplace.
// - Look something up: what it sells for on eBay (free: the sold-listings search, no AI), and a search
//   on eBay, on Marketplace, or both.
// - Sell something: what to ask for a thing you're selling, from its eBay sales (TKRules.sellPrices).
// - Saved: your saved listings and searches, each marked eBay or Marketplace, ready to open.
// - Home: the same alerts, numbers and spending as the panel's Home tab.
// The toolbar icon's popup on any other site (hub.html?popup: narrower, Settings in a tab), and a tab from
// right-clicking selected text ("Look up … with Tirekick") or the icon ("Open Tirekick in a tab").
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

  // ---------- the pause switch ----------
  // On: the panel, tags and scans on store pages. Off (paused): nothing shows there and open store tabs clear
  // right away; everything on this page still works. The same switch as "Pause Tirekick on store pages" in settings.
  const pauseBtn = $("#pause-switch");
  const showPause = (paused) => {
    pauseBtn.setAttribute("aria-checked", String(!paused));
    $("#pause-hint").textContent = paused ? "Paused. Nothing shows on store pages until you turn this back on." : "The panel, tags and scans on store pages. Turn off to pause them.";
  };
  chrome.storage.local.get("paused").then(({ paused }) => showPause(paused === true));
  chrome.storage.onChanged.addListener((c) => c.paused && showPause(c.paused.newValue === true));
  pauseBtn.addEventListener("click", () => {
    const paused = pauseBtn.getAttribute("aria-checked") === "true";
    showPause(paused);
    chrome.storage.local.set({ paused }).catch(() => showPause(!paused));
  });

  // ---------- look something up ----------
  const qEl = $("#q");
  const answer = $("#answer");
  const goBtn = $("#go");
  // A search button per site in use (lib/sites.js: an opt-in store once it's turned on), then one for all of them
  // ("Both" while there are two).
  const sitesBox = $(".sites");
  let sites = TKSites.inUse();
  const drawSites = () => {
    sitesBox.replaceChildren(
      ...sites.map((s) => h("a", { class: "btn", id: `on-${s.key}`, target: "_blank", rel: "noopener", href: s.home }, `Search ${s.name} \u2197`)),
      h("button", { type: "button", id: "on-both" }, sites.length === 2 ? "Both" : "All")
    );
    syncLinks();
  };
  const syncLinks = () => {
    const q = qEl.value.trim();
    for (const s of sites) $(`#on-${s.key}`).href = q ? s.searchUrl(q) : s.home;
  };
  drawSites();
  chrome.storage.local.get(TKSites.all.map((s) => s.setting).filter(Boolean)).then((on) => (sites = TKSites.inUse(on)).length > 2 && drawSites());
  qEl.addEventListener("input", syncLinks);
  sitesBox.addEventListener("click", (e) => {
    if (!e.target.closest("#on-both")) return;
    const q = qEl.value.trim();
    if (!q) return qEl.focus();
    sites.forEach((s, i) => chrome.tabs.create({ url: s.searchUrl(q), active: i === 0 }));
  });

  // The same lookups as the panel's, with the same pace and cache: through an eBay tab you have open if
  // there is one, otherwise from the background script.
  const soldMarket = TKSold.create({ fetchHtml: (query, condition) => send("fetchSoldHtml", { url: TK.soldUrl(query, TK.SOLD_CONDITION[condition]) }), send });
  const cell = (label, m) => h("div", { class: "mcell" }, h("span", {}, label), h("b", {}, `${m.confidence === "rough" ? "~" : ""}${money(m.median)}`), h("span", {}, `${money(m.p25)}–${money(m.p75)}, ${m.n} sales${m.confidence === "rough" ? ", a rough guide" : ""}`));
  const leftOut = TK.leftOutSold;
  const say = (text, err = false) => answer.replaceChildren(h("div", { class: err ? "status err" : "status", role: err ? "alert" : null }, text));
  const lookUp = async () => {
    const q = qEl.value.trim();
    if (!q) return qEl.focus();
    syncLinks();
    lastLook = null;
    showRead();
    goBtn.disabled = true;
    if (TKRules.vehicleQuery(q)) return say(TKRules.VEHICLE_NOTE), (goBtn.disabled = false);
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
      lastLook = market ? { q, market } : null;
      showRead();
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
  // ---------- an asking price against it (a thrift shelf, a yard sale, a listing elsewhere) ----------
  // Worked out from the last lookup as you type: no new lookup. The buyer's word, as on a card, then what it would
  // leave after reselling on eBay (the panel's Fix & flip margin: fees, 40 cents, the shipping buyers paid).
  const priceEl = $("#look-price");
  const readEl = $("#price-read");
  let lastLook = null; // { q, market } from the last lookup that found one
  let lastFee = 13.6; // background.js DEFAULTS, until settings say otherwise
  chrome.storage.local.get("feePct").then(({ feePct }) => Number.isFinite(feePct) && (lastFee = feePct));
  const showRead = () => {
    const asking = parseFloat(priceEl.value);
    // Version words added after a lookup ("lite", "2nd gen", "128gb") read against those sales, still with no new
    // lookup; any other change of words is for a lookup of its own, so the read goes.
    const words = qEl.value.trim();
    const same = lastLook && (words === lastLook.q || (lastLook.q.toLowerCase().split(/\s+/).every((w) => words.toLowerCase().includes(w)) &&
      TKRules.forVariant(lastLook.market, { title: words }).variantWords?.length));
    showFlip(same ? words : null, priceEl.value.trim() === "" ? null : asking);
    if (!same || !(asking >= 0) || priceEl.value.trim() === "") {
      delete readEl.dataset.v;
      return readEl.replaceChildren();
    }
    const r = TKRules.askingRead(asking, lastLook.market, { title: words, feePct: lastFee });
    if (!r) return readEl.replaceChildren();
    readEl.dataset.v = r.v;
    // the buyer's word; what reselling would leave is the flip check's, below
    readEl.replaceChildren(h("b", {}, r.word), h("span", {}, r.buyer));
  };
  priceEl.addEventListener("input", showRead);
  qEl.addEventListener("input", showRead);

  // ---------- the flip check (the reseller workbench) ----------
  // After a lookup: the most to pay to keep the profit you want once it resells on eBay at the typical price, and
  // with an asking price, a plain Buy, Offer or Pass (TKRules.flipCall). The profit is the "flipProfit" setting,
  // changed here or in settings; parts are for this one find and aren't kept.
  const flipBox = $("#flip");
  const flipOut = $("#flip-out");
  const profitEl = $("#flip-profit");
  const partsEl = $("#flip-parts");
  let profit = 20; // background.js DEFAULTS
  chrome.storage.local.get("flipProfit").then(({ flipProfit }) => {
    if (Number.isFinite(flipProfit)) profit = flipProfit;
    profitEl.value = String(profit);
    showRead();
  });
  chrome.storage.onChanged.addListener((c) => {
    if (c.flipProfit && Number.isFinite(c.flipProfit.newValue) && document.activeElement !== profitEl) {
      profit = c.flipProfit.newValue;
      profitEl.value = String(profit);
      showRead();
    }
    if (c.feePct && Number.isFinite(c.feePct.newValue)) (lastFee = c.feePct.newValue), showRead();
  });
  profitEl.value = String(profit);
  const showFlip = (words, asking) => {
    const f = words != null && lastLook && TKRules.flipCall(asking, lastLook.market, { title: words, feePct: lastFee, profit, parts: parseFloat(partsEl.value) || 0 });
    flipBox.hidden = !f;
    keptEl.textContent = "";
    if (!f) return;
    $("#ask-q").textContent = TKRules.sellerQuestions(words);
    if (f.call) flipOut.dataset.call = f.call;
    else delete flipOut.dataset.call;
    flipOut.replaceChildren(
      ...[
        f.call ? h("b", { class: "call" }, f.word) : null,
        h("b", { class: "pay" }, f.maxPay > 0 ? `Pay up to ${money(f.maxPay)} for a ${money(profit)} profit` : `No price leaves a ${money(profit)} profit`),
        f.why ? h("span", {}, f.why) : null,
        h("span", {}, `${f.basis} Before sales tax and your time.${f.rough ? " Few sales: a rough guide." : ""}`),
        f.call ? null : h("span", {}, "Type the asking price above for Buy, Offer or Pass."),
      ].filter(Boolean) // replaceChildren would print a null as the word "null"
    );
  };
  profitEl.addEventListener("input", () => {
    const n = parseFloat(profitEl.value);
    profit = n >= 0 ? n : 0;
    showRead();
  });
  profitEl.addEventListener("change", () => chrome.storage.local.set({ flipProfit: S.clampSetting("flipProfit", profit) }).catch(() => {}));
  partsEl.addEventListener("input", showRead);

  // ---------- questions for the seller and a safety checklist ----------
  // Templates (TKRules.sellerQuestions, TKRules.SAFETY): copied as they are, so nothing is sent anywhere.
  const copyText = async (btn, text, done = "Copied") => {
    const was = btn.dataset.label || (btn.dataset.label = btn.textContent);
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = done;
    } catch {
      btn.textContent = "Couldn't copy";
    }
    setTimeout(() => (btn.textContent = was), 2000);
  };
  $("#ask-s").textContent = TKRules.safetyText();
  $("#ask-q-copy").addEventListener("click", (e) => copyText(e.currentTarget, $("#ask-q").textContent));
  $("#ask-s-copy").addEventListener("click", (e) => copyText(e.currentTarget, $("#ask-s").textContent));

  // ---------- the workbench: your own finds ----------
  // "Add to workbench" keeps the words, the asking price, the parts and the typical price then (for that version,
  // TKRules.forVariant) as a find (TKShared.cleanFind), in the shared "finds" record through storeEdit, so the
  // panel's tabs and this page never undo each other. The same words again update that find instead of adding one.
  // Each find is checked again from what it kept: no new lookup until you press its words.
  const keepBtn = $("#flip-keep");
  const keptEl = $("#flip-kept");
  const edit = (edit) => send("storeEdit", { name: "finds", edit });
  let finds = {};
  keepBtn.addEventListener("click", async () => {
    const words = qEl.value.trim();
    if (!lastLook || !words) return;
    const m = TKRules.forVariant(lastLook.market, { title: words });
    const ask = priceEl.value.trim() === "" ? null : parseFloat(priceEl.value);
    const parts = parseFloat(partsEl.value);
    const was = Object.entries(finds).find(([, r]) => r.t.toLowerCase() === words.toLowerCase());
    const find = S.cleanFind({ ...(was ? was[1] : {}), t: words, ask: ask >= 0 ? ask : null, parts: parts >= 0 ? parts : (was?.[1].parts ?? null), sold: m.median, ship: m.ship, sa: Date.now(), n: m.n, r: m.confidence === "rough", a0: was?.[1].a0 || Date.now() });
    if (!find) return;
    if (!(ask >= 0)) delete find.ask;
    try {
      await edit({ set: { [was ? was[0] : S.newFindKey()]: find }, cap: { max: S.FIND_MAX, by: "a0" } });
      keptEl.textContent = was ? "Updated on the workbench" : "Added to the workbench";
    } catch (e) {
      keptEl.textContent = e.message;
    }
  });
  // ---------- the sell helper: what to ask for something you're selling ----------
  // The details that move the price as you type (TKRules.sellAsks), then on Price it the same eBay sold lookup as
  // above (pace, cache and stats), and from it three prices with what each leaves you, where to sell, a title and
  // what to show (TKRules.sellPrices, sellWhere, sellTitle, sellTips). Every price is from real sales: with too few
  // it says so and shows none. Add to workbench keeps it as Bought, with what you paid and the typical price.
  const sellQ = $("#sell-q");
  const sellPaid = $("#sell-paid");
  const sellBroken = $("#sell-broken");
  const sellLocal = $("#sell-local");
  const sellGo = $("#sell-go");
  const sellAsks = $("#sell-asks");
  const sellOut = $("#sell-out");
  let sellLook = null; // { q, market } from the last Price it that found one
  const drawAsks = () => {
    const q = sellQ.value.trim();
    if (!q) return sellAsks.replaceChildren();
    sellAsks.replaceChildren(h("span", {}, "Put these in the words if they apply, as the price depends on them:"), h("ul", {}, TKRules.sellAsks(q).map((a) => h("li", {}, a))));
  };
  const drawSell = () => {
    if (!sellLook) return;
    const { q, market } = sellLook;
    const paidRaw = sellPaid.value.trim();
    const paid = paidRaw === "" ? null : Math.max(0, parseFloat(paidRaw)) || 0;
    const p = TKRules.sellPrices(market, { title: q, feePct: lastFee, paid, profit, broken: sellBroken.checked, local: sellLocal.checked || null });
    if (!p) return sellOut.replaceChildren(h("div", { class: "status" }, `Not enough eBay sales of “${q}” to price it. Try fewer or more general words.`));
    const keepLine = (x) => (x.keep >= 0 ? `you keep ~${money(x.keep)}` : `a ~${money(-x.keep)} loss`);
    const cellOf = (label, x, sub) => h("div", { class: "mcell" }, h("span", {}, label), h("b", {}, money(x.price)), h("span", {}, `${keepLine(x)}${sub ? `. ${sub}` : ""}`));
    const where = TKRules.sellWhere(q, p.typical, { local: p.local });
    const title = TKRules.sellTitle(q);
    const copyBtn = h("button", { type: "button" }, "Copy the title");
    copyBtn.addEventListener("click", () => copyText(copyBtn, title));
    const keepBtn2 = h("button", { type: "button" }, "Add to workbench");
    const keptSay = h("span", { class: "hint", role: "status" });
    keepBtn2.addEventListener("click", async () => {
      const m = p.broken ? { median: market.parts.median, ship: market.parts.ship ?? market.ship, n: market.parts.n, confidence: "rough" } : TKRules.forVariant(market, { title: q });
      const was = Object.entries(finds).find(([, r]) => r.t.toLowerCase() === q.toLowerCase());
      const find = S.cleanFind({ ...(was ? was[1] : {}), t: q, st: "bought", paid: paid ?? was?.[1].paid ?? null, bt: was?.[1].bt || Date.now(), sold: m.median, ship: m.ship, sa: Date.now(), n: m.n, r: m.confidence === "rough", a0: was?.[1].a0 || Date.now() });
      if (!find) return;
      try {
        await edit({ set: { [was ? was[0] : S.newFindKey()]: find }, cap: { max: S.FIND_MAX, by: "a0" } });
        keptSay.textContent = was ? "Updated on the workbench" : "Added to the workbench, as Bought";
      } catch (e) {
        keptSay.textContent = e.message;
      }
    });
    sellOut.replaceChildren(
      ...[
        sellBroken.checked && !p.broken ? h("p", { class: "warn" }, "Too few sales of broken ones to price it as it is: these are for a working one.") : null,
        h(
          "div",
          { class: "mgrid" },
          cellOf("List at", p.listAt, "Room for offers"),
          cellOf("Sell fast", p.fast),
          p.floor ? cellOf("Your lowest", p.floor, `Keeps your ${money(profit)} profit`) : h("div", { class: "mcell" }, h("span", {}, "Your lowest"), h("span", {}, "Type what you paid to see the least to take."))
        ),
        p.under ? h("p", { class: "warn" }, `To keep your ${money(profit)} you'd need ${money(p.floor.price)}, more than it usually sells for.`) : null,
        h("p", { class: "hint caveat" }, `${p.basis}${p.rough ? " Few sales: a rough guide." : ""} Prices include shipping, as sold prices do.`),
        h("p", {}, h("b", {}, "Where: "), where.why),
        h("div", { class: "sell-title" }, h("b", {}, "Title:"), h("code", {}, title), copyBtn),
        h("div", { class: "sell-tips" }, h("b", {}, "Photos and what to say:"), h("ul", {}, TKRules.sellTips(q).map((t) => h("li", {}, t)))),
        h("div", { class: "acts" }, keepBtn2, keptSay),
      ].filter(Boolean)
    );
  };
  // What broken ones sold for: a lookup of its own (the same pace and cache), only once it doesn't fully work.
  const addParts = async () => {
    const look = sellLook;
    if (!look || look.partsTried) return;
    look.partsTried = true;
    const parts = await soldMarket(look.q, "parts").catch(() => null);
    if (parts?.median > 0) look.market.parts = parts;
  };
  const priceIt = async () => {
    const q = sellQ.value.trim();
    if (!q) return sellQ.focus();
    sellLook = null;
    if (TKRules.vehicleQuery(q)) return sellOut.replaceChildren(h("div", { class: "status" }, TKRules.VEHICLE_NOTE));
    sellGo.disabled = true;
    sellOut.replaceChildren(h("div", { class: "status" }, `Looking up eBay sales of “${q}”…`));
    try {
      let market = await soldMarket(q, "used");
      if (!market) market = await soldMarket(q, "any");
      send("storeEdit", { name: "stats", edit: { inc: { soldLookups: 1 }, add: { since: Date.now() } } }).catch(() => {});
      if (!market) return sellOut.replaceChildren(h("div", { class: "status" }, `Not enough eBay sales of “${q}” to price it. Try fewer or more general words.`));
      sellLook = { q, market: { ...market } };
      if (sellBroken.checked) await addParts();
      drawSell();
    } catch (e) {
      sellOut.replaceChildren(h("div", { class: "status err", role: "alert" }, e.message));
    } finally {
      sellGo.disabled = false;
    }
  };
  $("#sell-form").addEventListener("submit", (e) => {
    e.preventDefault();
    priceIt();
  });
  sellQ.addEventListener("input", () => {
    drawAsks();
    // other words are for a lookup of their own
    if (sellLook && sellQ.value.trim() !== sellLook.q) (sellLook = null), sellOut.replaceChildren();
  });
  for (const el of [sellPaid, sellLocal]) el.addEventListener(el.type === "checkbox" ? "change" : "input", drawSell);
  sellBroken.addEventListener("change", async () => {
    if (sellBroken.checked && sellLook && !sellLook.partsTried) {
      sellBroken.disabled = true;
      await addParts();
      sellBroken.disabled = false;
    }
    drawSell();
  });

  const benchBody = $("#bench-body");
  // One find: its call (Buy, Offer or Pass) while you weigh it up, then Bought and Sold with what you paid and what it
  // sold for, and the profit (TKShared.findProfit). Every box is kept when you leave it (storeEdit patch).
  const STATES = [["", "Weighing up"], ["bought", "Bought"], ["sold", "Sold"]];
  const findRow = (k, r) => {
    const st = r.st === "bought" || r.st === "sold" ? r.st : "";
    const name = r.t.slice(0, 60);
    const f = st ? null : TKRules.flipCall(r.ask ?? null, S.findMarket(r), { title: "", feePct: lastFee, profit, parts: r.parts || 0 });
    const numIn = (label, v, placeholder = "") => h("input", { type: "number", min: "0", step: "any", inputmode: "decimal", placeholder, value: Number.isFinite(v) ? String(v) : null, "aria-label": `${label} for ${name}` });
    const askIn = numIn("Asking price", r.ask, "$");
    const paidIn = numIn("Price paid", r.paid, "$");
    const outIn = numIn("Sold for", r.out, "$");
    const partsIn = numIn("Parts cost", r.parts, "0");
    const noteIn = h("input", { class: "note", type: "text", maxlength: String(S.NOTE_MAX), placeholder: "Notes: where, condition, fault…", value: r.note || null, "aria-label": `Notes for ${name}` });
    const stateIn = h("select", { "aria-label": `Where ${name} stands` }, STATES.map(([v, label]) => h("option", { value: v, ...(v === st && { selected: true }) }, label)));
    const num = (el) => (el.value.trim() === "" ? null : Math.max(0, parseFloat(el.value)) || 0);
    const boxes = { ask: askIn, paid: paidIn, out: outIn, parts: partsIn };
    const keep = () => {
      const patch = { note: noteIn.value.trim().slice(0, S.NOTE_MAX) };
      for (const [f2, el] of Object.entries(boxes)) if (el.isConnected) patch[f2] = num(el);
      if (Object.entries(patch).every(([f2, v]) => (f2 === "note" ? v === (r.note || "") : v === (r[f2] ?? null)))) return;
      edit({ patch: { [k]: patch } }).catch(() => {});
    };
    for (const el of [...Object.values(boxes), noteIn]) {
      el.addEventListener("change", keep);
      el.addEventListener("keydown", (e) => e.key === "Enter" && el.blur());
    }
    // Bought: what you paid starts at the asking price. Sold: what it sold for starts empty, for you to type.
    stateIn.addEventListener("change", () => {
      const to = stateIn.value;
      const paid = r.paid ?? r.ask ?? null;
      const patch = to === "" ? { st: null } : { st: to, paid, ...(to === "bought" ? { bt: r.bt || Date.now() } : { bt: r.bt || Date.now(), so: Date.now() }) };
      edit({ patch: { [k]: patch } }).catch(() => {});
      stateIn.blur(); // the list redraws with the new boxes
    });
    const again = h("button", { type: "button", class: "again", title: "Look it up again" }, r.t);
    again.addEventListener("click", () => {
      qEl.value = r.t;
      priceEl.value = Number.isFinite(r.ask) ? String(r.ask) : "";
      partsEl.value = Number.isFinite(r.parts) && r.parts > 0 ? String(r.parts) : "";
      syncLinks();
      $(".look").scrollIntoView({ behavior: "smooth", block: "start" });
      lookUp();
    });
    const when = r.sa ? new Date(r.sa).toLocaleDateString() : "";
    const typical = r.sold > 0 ? `typical ${r.r ? "~" : ""}${money(r.sold)}${when ? ` (${when})` : ""}` : "";
    const made = S.findProfit(r, lastFee);
    const line = st === "sold"
      ? made == null ? "Type what it sold for to see the profit." : `${money(Math.abs(made))} ${made >= 0 ? "profit" : "loss"} after ${lastFee}% fees${r.ship ? `, ~${money(r.ship)} shipping` : ""}${r.parts ? ` and ${money(r.parts)} parts` : ""}`
      : st === "bought"
        ? made == null ? (r.sold > 0 ? "Type what you paid to see what it should leave." : "No typical price kept for it.") : `Should leave ~${money(Math.abs(made))} ${made >= 0 ? "profit" : "loss"} at the ${typical}`
        : f ? `${f.maxPay > 0 ? `Pay up to ${money(f.maxPay)}` : `No price leaves ${money(profit)}`} · ${typical}` : "No typical price: press it to look it up again.";
    const shown = st === "sold" ? r.out : st === "bought" ? r.paid : r.ask;
    const link = r.k && r.u ? h("a", { href: S.safeUrl(r.u, S.itemUrl(r.k)), target: "_blank", rel: "noopener", class: "open" }, `${siteName(r.k)} ↗`) : null;
    return h(
      "div",
      { class: "find", "data-call": st || f?.call || "" },
      h("span", { class: "call" }, st ? (st === "sold" ? "Sold" : "Bought") : f?.call ? f.word : "No price"),
      h("div", { class: "ft" }, again, link ? [" ", link] : null, h("small", {}, line)),
      Number.isFinite(shown) ? h("div", { class: "pr" }, money(shown)) : h("span", {}),
      h(
        "div",
        { class: "fx" },
        stateIn,
        st ? h("label", {}, "Paid $", paidIn) : h("label", {}, "Asking $", askIn),
        st === "sold" ? h("label", {}, "Sold for $", outIn) : null,
        h("label", {}, "Parts $", partsIn),
        noteIn,
        st ? null : h("button", { type: "button", title: "Questions for the seller, ready to paste into a message", onclick: (e) => copyText(e.currentTarget, TKRules.sellerQuestions(r.t), "Questions copied") }, "Copy questions"),
        h("button", { type: "button", title: "Take it off the workbench", onclick: () => edit({ set: { [k]: null } }).catch(() => {}) }, "Remove")
      )
    );
  };
  // Totals over the top: what's sold and the profit it made, and what's bought and waiting to sell.
  const benchSum = $("#bench-sum");
  const drawBench = () => {
    const list = Object.entries(finds).sort((a, b) => (b[1].a0 || 0) - (a[1].a0 || 0));
    $("#bench").hidden = !list.length;
    const t = S.benchTotals(finds, lastFee);
    const bits = [
      t.sold ? `${t.sold} sold, ${money(Math.abs(t.profit))} ${t.profit >= 0 ? "profit" : "loss"}` : null,
      t.held ? `${t.held} bought and not sold yet: ${money(t.inHeld)} in ${t.held === 1 ? "it" : "them"}, ~${money(Math.abs(t.heldProfit))} ${t.heldProfit >= 0 ? "to come" : "loss"} at typical prices` : null,
      t.weighing ? `${t.weighing} you're weighing up` : null,
    ].filter(Boolean);
    benchSum.textContent = bits.join(" · ");
    benchBody.replaceChildren(...list.map(([k, r]) => findRow(k, r)));
    drawSaved(); // each saved listing says whether it's on the workbench
  };
  chrome.storage.local.get("finds").then(({ finds: f }) => {
    finds = f && typeof f === "object" ? f : {};
    drawBench();
  });
  chrome.storage.onChanged.addListener((c) => {
    if (c.finds) {
      finds = c.finds.newValue || {};
      // a box you're typing in isn't redrawn under you; it's kept when you leave it
      if (!benchBody.contains(document.activeElement)) drawBench();
    }
    if (c.flipProfit || c.feePct) drawBench();
  });
  benchBody.addEventListener("focusout", () => setTimeout(() => !benchBody.contains(document.activeElement) && drawBench(), 0));

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
      return body.replaceChildren(h("p", { class: "empty" }, `Nothing saved yet. On ${sites.map((s) => s.name).join(" or ")}, hover a card and press Save, or use Save search in the panel.`));
    }
    // A saved listing goes onto the workbench as a find: its title, price, the free typical price kept on it
    // (TKShared.savedSold) and its parts and note, with the link back to it. Once there, it says so.
    const onBench = new Set(Object.values(finds).map((f) => f?.k).filter(Boolean));
    const toBench = (k, r) => {
      const ref = S.savedSold(k, {}, r);
      const find = S.cleanFind({ t: r.t || siteName(k), ask: r.p, parts: r.parts, note: r.note, ...(ref && { sold: ref.sold, ship: ref.ship, sa: ref.at || Date.now() }), k, u: r.u, a0: Date.now() });
      if (find) edit({ set: { [S.newFindKey()]: find }, cap: { max: S.FIND_MAX, by: "a0" } }).catch(() => {});
    };
    const listRows = items.map(([k, r]) => {
      const cheaper = S.dropped(r);
      return h(
        "div",
        { class: "row" },
        h("span", { class: "tag" }, siteName(k)),
        h("div", { class: "t" }, h("a", { href: S.savedItemUrl(k, r), target: "_blank", rel: "noopener" }, r.t || S.savedItemUrl(k, r)), cheaper ? h("small", {}, `↓ ${money(r.p0 - r.p)} since you saved it`) : null),
        r.p != null ? h("div", { class: "pr" }, money(r.p)) : null,
        onBench.has(k)
          ? h("span", { class: "on-bench" }, "On the workbench")
          : h("button", { type: "button", class: "to-bench", title: "Weigh it up on the workbench, then mark it bought and sold", onclick: () => toBench(k, r) }, "To workbench")
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
  $("#home-css").textContent = TKHome.CSS + TKTheme.glyphCss(".read b");
  let mode = "buyer";
  chrome.storage.local.get("lens").then(({ lens }) => (mode = lens === "project" ? "reseller" : "buyer"));
  // An update's new features, waiting to be turned on, go at the top, where the popup opens (Home is further down).
  const news = TKHome.news($("#news"), { send, isShown: () => document.visibilityState === "visible" });
  news.refresh().catch(() => {});
  const home = TKHome.mount($("#home"), {
    send,
    withNews: false,
    go: () => $("#saved").scrollIntoView({ behavior: "smooth", block: "start" }),
    showSpend: () => chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html#sec-spending") }),
    getMode: () => mode,
    isShown: () => document.visibilityState === "visible",
    onAlerts: () => {},
  });
  home.refresh().then(home.seen).catch(() => {});
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && (news.seen(), home.wake().catch(() => {})));

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

// The header mark: the same tire as the panel and the toolbar (lib/theme.js), drawn for its size.
document.querySelector("svg.mark")?.insertAdjacentHTML("beforeend", TKTheme.logoMark(18, 17.6, 36));
